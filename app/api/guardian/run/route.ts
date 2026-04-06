import { NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase'
import { callClaude } from '@/lib/claude'
import { AI_MODELS } from '@/lib/ai-config'
import { rateLimit } from '@/lib/rate-limit'

// ─── Alert types ──────────────────────────────────────────────────────────────

export type AlertSeverity = 'critical' | 'warning' | 'info'
export type AlertActionType = 'crm' | 'code' | 'config' | 'manual'

export interface GuardianAlert {
  type: string
  severity: AlertSeverity
  action_type: AlertActionType   // drives which buttons to show
  client_id?: string
  client_name?: string
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

// ─── POST /api/guardian/run ───────────────────────────────────────────────────

export async function POST(req: Request) {
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })

  if (!rateLimit(`guardian:${user.id}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Za dużo zapytań. Odczekaj chwilę.' }, { status: 429 })
  }

  let trigger = 'manual'
  try {
    const body = await req.json() as { trigger?: string }
    trigger = body.trigger ?? 'manual'
  } catch { /* ok */ }

  const supabase = createSupabaseAdminClient()

  const [inactivityAlerts, quotesAlerts, leadsAlerts, costsAlerts, stackAlerts] = await Promise.all([
    checkClientInactivity(supabase),
    checkSentQuotes(supabase),
    checkNewLeads(supabase),
    checkAiCosts(supabase),
    checkStackErrors(supabase),
  ])

  const allAlerts: GuardianAlert[] = [
    ...inactivityAlerts,
    ...quotesAlerts,
    ...leadsAlerts,
    ...costsAlerts,
    ...stackAlerts,
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
      system: `Jesteś Guardian — system monitoringu 77STF.
Napisz JEDNO zdanie (max 120 znaków) — co jest najpilniejsze do zrobienia.
ZASADY: bez markdown, bez bold, bez gwiazdek, bez nagłówków, bez dwukropków na początku.
Zacznij od czasownika lub nazwy klienta. Przykład: "Petro-Lawa czeka 9 dni — zadzwoń dziś."`,
      messages: [{ role: 'user', content: `Alerty:\n${alertsText}` }],
      max_tokens: 80,
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
        checks_run: ['client_inactivity', 'sent_quotes', 'new_leads', 'ai_costs', 'stack_errors'],
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
