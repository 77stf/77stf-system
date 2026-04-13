import { NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase'
import { callClaude } from '@/lib/claude'
import { AI_MODELS } from '@/lib/ai-config'
import { rateLimit } from '@/lib/rate-limit'
import { sendSlackMessage } from '@/lib/slack'

// ─── Alert types ──────────────────────────────────────────────────────────────

export type AlertSeverity = 'critical' | 'warning' | 'info'
export type AlertActionType = 'crm' | 'code' | 'config' | 'manual'

export interface GuardianAlert {
  type: string
  severity: AlertSeverity
  action_type: AlertActionType   // drives which buttons to show
  client_id?: string
  client_name?: string
  quote_id?: string
  title: string
  detail: string
  action: string                 // short human-readable next step
  action_link?: string           // direct URL if action is a page navigation
  recommend_prompt?: string      // fed to /api/guardian/recommend if user clicks "Pobierz rekomendację"
  days_overdue?: number
}

// ─── Monitoring checks ────────────────────────────────────────────────────────

async function checkClientInactivity(supabase: ReturnType<typeof createSupabaseAdminClient>): Promise<GuardianAlert[]> {
  const alerts: GuardianAlert[] = []

  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, status, updated_at')
    .in('status', ['active', 'partner'])

  if (!clients) return alerts

  const now = new Date()

  for (const client of clients) {
    const [{ data: recentNotes }, { data: recentTasks }] = await Promise.all([
      supabase
        .from('client_notes')
        .select('created_at')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false })
        .limit(1),
      supabase
        .from('tasks')
        .select('updated_at')
        .eq('client_id', client.id)
        .order('updated_at', { ascending: false })
        .limit(1),
    ])

    const lastNoteDate = recentNotes?.[0]?.created_at ? new Date(recentNotes[0].created_at) : null
    const lastTaskDate = recentTasks?.[0]?.updated_at ? new Date(recentTasks[0].updated_at) : null
    const lastClientUpdate = new Date(client.updated_at)

    const lastActivity = [lastNoteDate, lastTaskDate, lastClientUpdate]
      .filter((d): d is Date => d !== null)
      .sort((a, b) => b.getTime() - a.getTime())[0]

    if (!lastActivity) continue

    const days = Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24))

    if (days >= 30) {
      alerts.push({
        type: 'client_inactivity',
        severity: days >= 60 ? 'critical' : 'warning',
        action_type: 'crm',
        client_id: client.id,
        client_name: client.name,
        title: `${client.name} — ${days} dni bez kontaktu`,
        detail: `Ostatnia aktywność: ${lastActivity.toLocaleDateString('pl-PL')}. Klient może czuć się zapomniany — to ryzyko churn.`,
        action: `Zadzwoń lub napisz do ${client.name} — przypomnij o sobie`,
        action_link: `/dashboard/clients/${client.id}`,
        days_overdue: days,
      })
    }
  }

  return alerts
}

async function checkSentQuotes(supabase: ReturnType<typeof createSupabaseAdminClient>): Promise<GuardianAlert[]> {
  const alerts: GuardianAlert[] = []

  const { data: quotes } = await supabase
    .from('quotes')
    .select('id, title, client_id, updated_at, clients(name)')
    .eq('status', 'sent')

  if (!quotes) return alerts

  const now = new Date()

  for (const quote of quotes) {
    const days = Math.floor((now.getTime() - new Date(quote.updated_at).getTime()) / (1000 * 60 * 60 * 24))
    if (days >= 7) {
      const clientName = (quote.clients as { name?: string } | null)?.name ?? 'Nieznany klient'
      alerts.push({
        type: 'quote_no_response',
        severity: days >= 14 ? 'critical' : 'warning',
        action_type: 'crm',
        client_id: quote.client_id ?? undefined,
        client_name: clientName,
        quote_id: quote.id,
        title: `Wycena "${quote.title}" czeka ${days} dni`,
        detail: `${clientName} nie odpowiedział na wycenę. Po 14 dniach szanse na konwersję spadają o 60%.`,
        action: `Follow up do ${clientName} — zapytaj czy mają pytania`,
        action_link: quote.client_id ? `/dashboard/clients/${quote.client_id}` : '/dashboard/quotes',
        days_overdue: days,
      })
    }
  }

  return alerts
}

async function checkNewLeads(supabase: ReturnType<typeof createSupabaseAdminClient>): Promise<GuardianAlert[]> {
  const alerts: GuardianAlert[] = []

  const { data: leads } = await supabase
    .from('clients')
    .select('id, name, created_at')
    .eq('status', 'lead')

  if (!leads) return alerts

  const now = new Date()

  for (const lead of leads) {
    const days = Math.floor((now.getTime() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60 * 24))
    if (days < 2) continue

    const { data: tasks } = await supabase
      .from('tasks')
      .select('id')
      .eq('client_id', lead.id)
      .limit(1)

    if (!tasks || tasks.length === 0) {
      alerts.push({
        type: 'lead_no_followup',
        severity: days >= 7 ? 'critical' : 'warning',
        action_type: 'crm',
        client_id: lead.id,
        client_name: lead.name,
        title: `Lead ${lead.name} — ${days} dni bez zadania`,
        detail: `Nowy lead bez planu działania. Im dłużej czekasz, tym zimniejszy kontakt.`,
        action: `Dodaj zadanie "Pierwszy kontakt" i zadzwoń dziś`,
        action_link: `/dashboard/clients/${lead.id}`,
        days_overdue: days,
      })
    }
  }

  return alerts
}

async function checkAiCosts(supabase: ReturnType<typeof createSupabaseAdminClient>): Promise<GuardianAlert[]> {
  const alerts: GuardianAlert[] = []

  const budget = parseFloat(process.env.AI_MONTHLY_BUDGET_USD ?? '50')
  const rate = parseFloat(process.env.USD_PLN_RATE ?? '4.0')

  const startOfMonth = new Date()
  startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0)

  const { data: usage } = await supabase
    .from('ai_usage_log')
    .select('cost_usd')
    .gte('created_at', startOfMonth.toISOString())

  if (!usage) return alerts

  const totalCostUsd = usage.reduce((s, r) => s + (r.cost_usd ?? 0), 0)
  const pct = budget > 0 ? (totalCostUsd / budget) * 100 : 0

  if (pct >= 80) {
    alerts.push({
      type: 'ai_budget_alert',
      severity: pct >= 95 ? 'critical' : 'warning',
      action_type: 'config',
      title: `Koszty AI: ${pct.toFixed(0)}% budżetu wykorzystane`,
      detail: `Wydano $${totalCostUsd.toFixed(2)} z $${budget} (${(totalCostUsd * rate).toFixed(0)} PLN). ${pct >= 95 ? 'Przy 100% część funkcji przestanie działać.' : 'Masz jeszcze margines, ale warto zadziałać.'}`,
      action: 'Sprawdź które funkcje zużywają najwięcej i ogranicz lub zwiększ budżet',
      action_link: '/dashboard/ai-costs',
      recommend_prompt: `Koszty AI osiągnęły ${pct.toFixed(0)}% budżetu ($${totalCostUsd.toFixed(2)} / $${budget}). Jak zoptymalizować koszty Claude API w systemie 77STF? Które endpointy można przełączyć na tańszy model Haiku? Jakie ustawienia zmienić?`,
    })
  }

  return alerts
}

async function checkStackErrors(supabase: ReturnType<typeof createSupabaseAdminClient>): Promise<GuardianAlert[]> {
  const alerts: GuardianAlert[] = []

  const { data: errorItems } = await supabase
    .from('stack_items')
    .select('id, name, client_id, updated_at, clients(name)')
    .eq('status', 'error')

  if (!errorItems) return alerts

  const now = new Date()

  for (const item of errorItems) {
    const hours = Math.floor((now.getTime() - new Date(item.updated_at).getTime()) / (1000 * 60 * 60))
    if (hours >= 24) {
      const clientName = (item.clients as { name?: string } | null)?.name ?? 'Nieznany klient'
      alerts.push({
        type: 'stack_error',
        severity: hours >= 72 ? 'critical' : 'warning',
        action_type: 'code',
        client_id: item.client_id,
        client_name: clientName,
        title: `"${item.name}" nie działa od ${Math.floor(hours / 24)} dni`,
        detail: `Wdrożenie klienta ${clientName} w stanie ERROR. Klient może nie wiedzieć — to ryzyko dla relacji.`,
        action: 'Sprawdź stack klienta i zaktualizuj status',
        action_link: item.client_id ? `/dashboard/clients/${item.client_id}/stack` : undefined,
        recommend_prompt: `Wdrożenie "${item.name}" klienta ${clientName} jest w stanie ERROR od ${Math.floor(hours / 24)} dni w systemie CRM 77STF. To może być integracja, automatyzacja lub agent AI. Jak podejść do diagnozy i naprawy? Jakie kroki podjąć?`,
      })
    }
  }

  return alerts
}

// ─── NEW: Overdue high-priority tasks ─────────────────────────────────────────

async function checkOverdueTasks(supabase: ReturnType<typeof createSupabaseAdminClient>): Promise<GuardianAlert[]> {
  const alerts: GuardianAlert[] = []
  const today = new Date().toISOString().split('T')[0]

  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, title, priority, due_date, client_id, clients(name)')
    .in('status', ['todo', 'in_progress'])
    .in('priority', ['high', 'critical'])
    .lt('due_date', today)
    .order('due_date')
    .limit(10)

  if (!tasks) return alerts

  const now = new Date()
  for (const task of tasks) {
    const days = Math.floor((now.getTime() - new Date(task.due_date).getTime()) / 86400000)
    const clientName = (task.clients as { name?: string } | null)?.name
    alerts.push({
      type: 'overdue_task',
      severity: days >= 3 ? 'critical' : 'warning',
      action_type: 'crm',
      client_id: task.client_id ?? undefined,
      client_name: clientName,
      title: `Zaległe zadanie: "${task.title}" (${days}d)`,
      detail: `Zadanie o priorytecie ${task.priority} przeterminowane o ${days} ${days === 1 ? 'dzień' : 'dni'}.${clientName ? ` Klient: ${clientName}.` : ''}`,
      action: `Oznacz jako zrobione lub przesuń termin`,
      action_link: task.client_id ? `/dashboard/tasks` : '/dashboard/tasks',
      days_overdue: days,
    })
  }
  return alerts
}

// ─── NEW: Pipeline stagnation — leads stuck too long ──────────────────────────

async function checkPipelineStagnation(supabase: ReturnType<typeof createSupabaseAdminClient>): Promise<GuardianAlert[]> {
  const alerts: GuardianAlert[] = []

  // Expected max days per stage before it's considered stagnant
  const stageLimits: Record<string, number> = {
    discovery: 7,
    audit: 14,
    proposal: 10,
    negotiation: 21,
    onboarding: 30,
  }

  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, pipeline_stage, last_activity_at')
    .not('status', 'eq', 'closed')
    .not('pipeline_stage', 'in', '("active","partner")')

  if (!clients) return alerts
  const now = new Date()

  for (const client of clients) {
    const stage = client.pipeline_stage ?? 'discovery'
    const limit = stageLimits[stage]
    if (!limit) continue
    const lastActivity = client.last_activity_at ? new Date(client.last_activity_at) : null
    if (!lastActivity) continue
    const days = Math.floor((now.getTime() - lastActivity.getTime()) / 86400000)
    if (days >= limit) {
      alerts.push({
        type: 'pipeline_stagnation',
        severity: days >= limit * 2 ? 'critical' : 'warning',
        action_type: 'crm',
        client_id: client.id,
        client_name: client.name,
        title: `${client.name} stoi w etapie "${stage}" od ${days}d`,
        detail: `Klient utknął w etapie ${stage}. Brak postępu przez ${days} dni (limit: ${limit}d). Ryzyko utraty leada.`,
        action: `Sprawdź status i zrób następny krok — zadzwoń, wyślij ofertę lub zamknij`,
        action_link: `/dashboard/roadmap`,
        days_overdue: days,
        recommend_prompt: `Klient "${client.name}" z branży utknął w etapie "${stage}" pipeline 77STF od ${days} dni. Jakie konkretne akcje podjąć żeby ruszyć sprawę? Jakie pytania zadać na następnym kontakcie?`,
      })
    }
  }
  return alerts
}

// ─── NEW: Error log spike ──────────────────────────────────────────────────────

async function checkErrorSpike(supabase: ReturnType<typeof createSupabaseAdminClient>): Promise<GuardianAlert[]> {
  const alerts: GuardianAlert[] = []

  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const last1h  = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  const [{ count: errors24h }, { count: errors1h }] = await Promise.all([
    supabase.from('error_log').select('*', { count: 'exact', head: true }).gte('created_at', last24h),
    supabase.from('error_log').select('*', { count: 'exact', head: true }).gte('created_at', last1h),
  ])

  if ((errors1h ?? 0) >= 10) {
    alerts.push({
      type: 'error_spike',
      severity: 'critical',
      action_type: 'code',
      title: `Spike błędów: ${errors1h} w ostatniej godzinie`,
      detail: `System generuje dużo błędów — coś może być poważnie zepsute. ${errors24h} błędów w ciągu 24h.`,
      action: 'Sprawdź logi błędów w Ustawieniach',
      action_link: '/dashboard/settings',
      recommend_prompt: `System 77STF wygenerował ${errors1h} błędów w ostatniej godzinie (${errors24h} w 24h). Jak diagnozować takie spiki? Co może być przyczyną i jakie kroki podjąć?`,
    })
  } else if ((errors24h ?? 0) >= 20) {
    alerts.push({
      type: 'error_high',
      severity: 'warning',
      action_type: 'code',
      title: `Podwyższona liczba błędów: ${errors24h} w 24h`,
      detail: `Więcej niż zwykle — warto sprawdzić czy to normalny ruch czy problem z integracją.`,
      action: 'Przejrzyj logi błędów',
      action_link: '/dashboard/settings',
    })
  }

  return alerts
}

// ─── NEW: Active clients missing monthly check-in ─────────────────────────────

async function checkActiveClientsHealth(supabase: ReturnType<typeof createSupabaseAdminClient>): Promise<GuardianAlert[]> {
  const alerts: GuardianAlert[] = []
  const cutoff30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: activeClients } = await supabase
    .from('clients')
    .select('id, name, last_activity_at')
    .eq('status', 'active')

  if (!activeClients) return alerts
  const now = new Date()

  for (const client of activeClients) {
    if (!client.last_activity_at || client.last_activity_at < cutoff30d) {
      const days = client.last_activity_at
        ? Math.floor((now.getTime() - new Date(client.last_activity_at).getTime()) / 86400000)
        : 999
      alerts.push({
        type: 'active_client_no_checkin',
        severity: 'warning',
        action_type: 'crm',
        client_id: client.id,
        client_name: client.name,
        title: `${client.name} — brak miesięcznego check-inu (${days}d)`,
        detail: `Aktywny klient bez kontaktu przez ${days} dni. Miesięczna opieka to podstawa retencji — brak kontaktu = ryzyko wypowiedzenia.`,
        action: 'Wyślij raport miesięczny lub zadzwoń z proaktywną aktualizacją',
        action_link: `/dashboard/clients/${client.id}`,
        days_overdue: days,
      })
    }
  }
  return alerts
}

// ─── POST /api/guardian/run ───────────────────────────────────────────────────

export async function POST(req: Request) {
  // Allow n8n cron calls via webhook secret (no session cookie needed)
  const webhookSecret = req.headers.get('x-webhook-secret')?.trim()
  const isValidCron = webhookSecret && webhookSecret === process.env.N8N_WEBHOOK_SECRET?.trim()

  if (!isValidCron) {
    const authClient = await createSupabaseServerClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })

    if (!rateLimit(`guardian:${user.id}`, 10, 60 * 60 * 1000)) {
      return NextResponse.json({ error: 'Za dużo zapytań. Odczekaj chwilę.' }, { status: 429 })
    }
  } else {
    // Cron rate limit: max 5 guardian runs per hour
    if (!rateLimit('guardian:cron', 5, 60 * 60 * 1000)) {
      return NextResponse.json({ error: 'Cron rate limit exceeded.' }, { status: 429 })
    }
  }

  let trigger = 'manual'
  try {
    const body = await req.json() as { trigger?: string }
    trigger = body.trigger ?? 'manual'
  } catch { /* ok */ }

  const supabase = createSupabaseAdminClient()

  const [
    inactivityAlerts, quotesAlerts, leadsAlerts, costsAlerts, stackAlerts,
    overdueAlerts, stagnationAlerts, errorAlerts, healthAlerts,
  ] = await Promise.all([
    checkClientInactivity(supabase),
    checkSentQuotes(supabase),
    checkNewLeads(supabase),
    checkAiCosts(supabase),
    checkStackErrors(supabase),
    checkOverdueTasks(supabase),
    checkPipelineStagnation(supabase),
    checkErrorSpike(supabase),
    checkActiveClientsHealth(supabase),
  ])

  const allAlerts: GuardianAlert[] = [
    ...inactivityAlerts,
    ...quotesAlerts,
    ...leadsAlerts,
    ...costsAlerts,
    ...stackAlerts,
    ...overdueAlerts,
    ...stagnationAlerts,
    ...errorAlerts,
    ...healthAlerts,
  ].sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 }
    return order[a.severity] - order[b.severity]
  })

  const critical = allAlerts.filter(a => a.severity === 'critical').length
  const warnings = allAlerts.filter(a => a.severity === 'warning').length

  // Generate summary via Haiku
  let summary = ''
  if (allAlerts.length > 0) {
    const alertsText = allAlerts
      .map(a => `[${a.severity.toUpperCase()}] ${a.title} → ${a.action}`)
      .join('\n')

    const { text } = await callClaude({
      feature: 'guardianReport',
      model: AI_MODELS.fast,
      system: `Jesteś Guardian — Opiekun Systemu 77STF. Monitoring działa i właśnie wykrył alerty.
Napisz JEDNO zdanie (max 140 znaków) — najważniejsza akcja do podjęcia TERAZ.
ZASADY ABSOLUTNE: bez markdown, zero gwiazdek, zero bold, zero nagłówków, zero emoji, zero dwukropków na początku.
Mów po ludzku, jak partner do partnera. Przykład: "Avvlo czeka 12 dni na follow-up — to priorytet na dziś."
Jeśli jest kilka pilnych — wybierz jedno, najważniejsze dla biznesu.`,
      messages: [{ role: 'user', content: `Znalezione alerty (${allAlerts.length} łącznie, ${critical} krytycznych):\n${alertsText}` }],
      max_tokens: 100,
      triggered_by: 'guardian',
    })
    summary = text.replace(/\*\*/g, '').replace(/\*/g, '').trim()
  } else {
    summary = 'Wszystko działa sprawnie. Żadnych pilnych spraw do załatwienia.'
  }

  const { data: saved, error: saveError } = await supabase
    .from('guardian_reports')
    .insert({
      alerts: allAlerts,
      summary,
      alert_count: allAlerts.length,
      critical,
      warnings,
      trigger,
      metadata: {
        checks_run: ['client_inactivity', 'sent_quotes', 'new_leads', 'ai_costs', 'stack_errors', 'overdue_tasks', 'pipeline_stagnation', 'error_spike', 'active_client_health'],
      },
    })
    .select('id, generated_at')
    .single()

  if (saveError) {
    await supabase.from('error_log').insert({
      source: 'api/guardian/run',
      message: saveError.message,
    })
  }

  // Slack digest — send if called from cron or if there are critical alerts
  if (trigger === 'cron' || critical > 0) {
    const criticalAlerts = allAlerts.filter(a => a.severity === 'critical')
    const warningAlerts = allAlerts.filter(a => a.severity === 'warning')
    const lines = [
      `🛡️ *Guardian — Raport dzienny 77STF*`,
      `${summary}`,
      '',
      critical > 0 ? `🔴 *Krytyczne (${critical}):*\n${criticalAlerts.map(a => `• ${a.title}`).join('\n')}` : '',
      warnings > 0 ? `⚠️ *Ostrzeżenia (${warnings}):*\n${warningAlerts.slice(0, 3).map(a => `• ${a.title}`).join('\n')}` : '',
      allAlerts.length === 0 ? '✅ Wszystko działa sprawnie.' : '',
    ].filter(Boolean).join('\n')
    void sendSlackMessage(lines, 'brief')
  }

  return NextResponse.json({
    id: saved?.id,
    generated_at: saved?.generated_at,
    alerts: allAlerts,
    summary,
    alert_count: allAlerts.length,
    critical,
    warnings,
  })
}
