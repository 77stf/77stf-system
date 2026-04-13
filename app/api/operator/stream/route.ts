import Anthropic from '@anthropic-ai/sdk'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase'
import { AI_MODELS, APPROX_COST_PER_1K } from '@/lib/ai-config'
import { rateLimit } from '@/lib/rate-limit'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// ─── TOOLS ────────────────────────────────────────────────────────────────────
// 20 tools — complete business partner toolset

const TOOLS: Anthropic.Messages.Tool[] = [
  // ── CRM core ──
  {
    name: 'list_clients',
    description: 'Pobierz listę klientów. Filtruj po statusie lub etapie pipeline.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status:         { type: 'string', enum: ['lead', 'active', 'partner', 'closed'] },
        pipeline_stage: { type: 'string', enum: ['discovery', 'audit', 'proposal', 'negotiation', 'onboarding', 'active', 'partner'] },
      },
    },
  },
  {
    name: 'get_client_details',
    description: 'Pełne dane klienta: profil + notatki + zadania + audyty + aktywności pipeline + stack wdrożeń.',
    input_schema: {
      type: 'object' as const,
      properties: { client_id: { type: 'string' } },
      required: ['client_id'],
    },
  },
  {
    name: 'create_task',
    description: 'Utwórz zadanie w CRM z priorytetem i terminem.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title:       { type: 'string' },
        client_id:   { type: 'string' },
        priority:    { type: 'string', enum: ['low', 'medium', 'high'] },
        description: { type: 'string' },
        due_date:    { type: 'string', description: 'ISO 8601, np. 2026-04-15' },
      },
      required: ['title'],
    },
  },
  {
    name: 'add_client_note',
    description: 'Zapisz notatkę do profilu klienta.',
    input_schema: {
      type: 'object' as const,
      properties: {
        client_id:  { type: 'string' },
        content:    { type: 'string' },
        importance: { type: 'string', enum: ['high', 'medium', 'low'] },
      },
      required: ['client_id', 'content'],
    },
  },
  {
    name: 'update_client_status',
    description: 'Zmień status klienta.',
    input_schema: {
      type: 'object' as const,
      properties: {
        client_id: { type: 'string' },
        status:    { type: 'string', enum: ['lead', 'active', 'partner', 'closed'] },
      },
      required: ['client_id', 'status'],
    },
  },
  {
    name: 'list_tasks',
    description: 'Pobierz zadania. Filtruj po kliencie, statusie lub priorytecie.',
    input_schema: {
      type: 'object' as const,
      properties: {
        client_id: { type: 'string' },
        status:    { type: 'string', enum: ['todo', 'in_progress', 'done'] },
        priority:  { type: 'string', enum: ['low', 'medium', 'high'] },
      },
    },
  },
  {
    name: 'get_system_stats',
    description: 'Statystyki systemu: klienci, zadania, koszty AI, aktywności.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'search_clients',
    description: 'Wyszukaj klienta po nazwie, branży lub kontakcie.',
    input_schema: {
      type: 'object' as const,
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
  },

  // ── Pipeline ──
  {
    name: 'get_roadmap_overview',
    description: 'Pełny przegląd pipeline: klienci per etap, stagnacje, ostatnie aktywności.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'advance_pipeline_stage',
    description: 'Przesuń klienta do etapu pipeline.',
    input_schema: {
      type: 'object' as const,
      properties: {
        client_id: { type: 'string' },
        stage:     { type: 'string', enum: ['discovery', 'audit', 'proposal', 'negotiation', 'onboarding', 'active', 'partner'] },
        note:      { type: 'string' },
      },
      required: ['client_id', 'stage'],
    },
  },
  {
    name: 'add_roadmap_activity',
    description: 'Dodaj aktywność do klienta w pipeline (rozmowa, email, notatka, demo, itp.).',
    input_schema: {
      type: 'object' as const,
      properties: {
        client_id:     { type: 'string' },
        activity_type: { type: 'string', enum: ['call', 'email', 'meeting', 'note', 'quote_sent', 'research', 'demo', 'document', 'whatsapp'] },
        title:         { type: 'string' },
        description:   { type: 'string' },
        outcome:       { type: 'string' },
      },
      required: ['client_id', 'activity_type', 'title'],
    },
  },

  // ── Intelligence ──
  {
    name: 'get_cost_summary',
    description: 'Koszty AI ten miesiąc + wszystkie aktywne subskrypcje biznesowe z kwotami.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'save_offline_idea',
    description: 'Zapisz pomysł na stronie Pomysły. Użyj gdy właściciel wspomina coś wartego zapamiętania.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title:       { type: 'string' },
        description: { type: 'string' },
        category:    { type: 'string', enum: ['implementation', 'system_upgrade', 'owner_idea', 'tool', 'integration'] },
        priority:    { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
        roi_notes:   { type: 'string' },
      },
      required: ['title', 'category'],
    },
  },
  {
    name: 'get_daily_priorities',
    description: 'Pobierz dane do rankingu "co robić dziś": zaległe zadania, dzisiejsze zadania, stagnujące leady.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'run_guardian_scan',
    description: 'Uruchom skan Opiekuna Systemu — sprawdź czy coś wymaga uwagi.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'generate_meeting_brief',
    description: 'Wygeneruj brief na spotkanie: historia relacji, audyt, otwarte tematy, pytania.',
    input_schema: {
      type: 'object' as const,
      properties: { client_id: { type: 'string' } },
      required: ['client_id'],
    },
  },

  // ── NEW: Business intelligence ──
  {
    name: 'get_client_opportunities',
    description: 'Pobierz dane do analizy możliwości upsell/cross-sell dla klienta: aktualny stack, co nie jest wdrożone, historia.',
    input_schema: {
      type: 'object' as const,
      properties: {
        client_id: { type: 'string' },
      },
      required: ['client_id'],
    },
  },
  {
    name: 'get_recent_ideas',
    description: 'Pobierz ostatnie pomysły i analizy ze strony Pomysły — do przeglądu lub dyskusji.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status:   { type: 'string', enum: ['new', 'considering', 'planned', 'in_progress', 'done', 'rejected'] },
        limit:    { type: 'number', description: 'Ile pomysłów pobrać, domyślnie 10' },
      },
    },
  },
  {
    name: 'get_radar_signals',
    description: 'Pobierz najnowsze sygnały z Radaru (AI, tech, business news) — przydatne gdy właściciel pyta o trendy.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'draft_follow_up',
    description: 'Wygeneruj treść wiadomości follow-up do klienta na podstawie historii relacji.',
    input_schema: {
      type: 'object' as const,
      properties: {
        client_id: { type: 'string' },
        channel:   { type: 'string', enum: ['email', 'whatsapp', 'linkedin'], description: 'Kanał komunikacji' },
        context:   { type: 'string', description: 'Dodatkowy kontekst, np. "po wysłaniu wyceny"' },
      },
      required: ['client_id'],
    },
  },
]

// ─── Tool execution ───────────────────────────────────────────────────────────

async function executeTool(
  name: string,
  input: Record<string, unknown>,
  supabase: ReturnType<typeof createSupabaseAdminClient>
): Promise<string> {
  try {
    switch (name) {

      case 'list_clients': {
        let q = supabase.from('clients').select('id, name, status, pipeline_stage, industry, owner_name, owner_phone, last_activity_at')
        if (input.status)         q = q.eq('status', input.status as string)
        if (input.pipeline_stage) q = q.eq('pipeline_stage', input.pipeline_stage as string)
        const { data } = await q.order('name').limit(50)
        return JSON.stringify(data ?? [])
      }

      case 'get_client_details': {
        const [{ data: client }, { data: notes }, { data: tasks }, { data: audits }, { data: activities }, { data: stack }] = await Promise.all([
          supabase.from('clients').select('*').eq('id', input.client_id as string).single(),
          supabase.from('client_notes').select('content, importance, source, created_at').eq('client_id', input.client_id as string).order('created_at', { ascending: false }).limit(10),
          supabase.from('tasks').select('title, status, priority, due_date').eq('client_id', input.client_id as string).neq('status', 'done').order('due_date').limit(10),
          supabase.from('audits').select('title, status, score, ai_summary, created_at').eq('client_id', input.client_id as string).order('created_at', { ascending: false }).limit(2),
          supabase.from('roadmap_activities').select('activity_type, title, description, outcome, created_at').eq('client_id', input.client_id as string).order('created_at', { ascending: false }).limit(15),
          supabase.from('stack_items').select('name, category, status, monthly_value_pln').eq('client_id', input.client_id as string).in('status', ['live', 'in_progress']).limit(20),
        ])
        return JSON.stringify({ client, notes: notes ?? [], open_tasks: tasks ?? [], audits: audits ?? [], recent_activities: activities ?? [], active_stack: stack ?? [] })
      }

      case 'create_task': {
        const { data, error } = await supabase.from('tasks').insert({
          title:       input.title as string,
          client_id:   (input.client_id as string | undefined) ?? null,
          priority:    (input.priority as string) ?? 'medium',
          status:      'todo',
          description: (input.description as string | undefined) ?? null,
          due_date:    (input.due_date as string | undefined) ?? null,
        }).select('id, title').single()
        if (error) return `Błąd: ${error.message}`
        return `✅ Zadanie utworzone: "${data.title}"`
      }

      case 'add_client_note': {
        const { error } = await supabase.from('client_notes').insert({
          client_id:  input.client_id as string,
          content:    input.content as string,
          importance: (input.importance as string) ?? 'medium',
          source:     'second_brain',
        })
        if (error) return `Błąd: ${error.message}`
        return '✅ Notatka zapisana.'
      }

      case 'update_client_status': {
        const { error } = await supabase.from('clients').update({ status: input.status as string }).eq('id', input.client_id as string)
        if (error) return `Błąd: ${error.message}`
        return `✅ Status zmieniony na "${input.status}".`
      }

      case 'list_tasks': {
        let q = supabase.from('tasks').select('id, title, status, priority, due_date, client_id, clients(name)')
        if (input.client_id) q = q.eq('client_id', input.client_id as string)
        if (input.status)    q = q.eq('status', input.status as string)
        if (input.priority)  q = q.eq('priority', input.priority as string)
        const { data } = await q.order('due_date').limit(30)
        return JSON.stringify(data ?? [])
      }

      case 'get_system_stats': {
        const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0)
        const [{ count: clients }, { count: openTasks }, { count: leads }, { data: usage }] = await Promise.all([
          supabase.from('clients').select('*', { count: 'exact', head: true }),
          supabase.from('tasks').select('*', { count: 'exact', head: true }).neq('status', 'done'),
          supabase.from('clients').select('*', { count: 'exact', head: true }).eq('status', 'lead'),
          supabase.from('ai_usage_log').select('cost_usd').gte('created_at', startOfMonth.toISOString()),
        ])
        const aiCostUsd = (usage ?? []).reduce((s, r) => s + (r.cost_usd ?? 0), 0)
        return JSON.stringify({ clients_total: clients, active_leads: leads, open_tasks: openTasks, ai_cost_this_month_usd: aiCostUsd.toFixed(4) })
      }

      case 'search_clients': {
        const q = `%${input.query as string}%`
        const { data } = await supabase.from('clients').select('id, name, status, pipeline_stage, industry, owner_name, owner_phone').or(`name.ilike.${q},industry.ilike.${q},owner_name.ilike.${q}`).limit(10)
        return JSON.stringify(data ?? [])
      }

      case 'get_roadmap_overview': {
        const stages = ['discovery', 'audit', 'proposal', 'negotiation', 'onboarding', 'active', 'partner']
        const stageLabels: Record<string, string> = { discovery: 'Odkrywanie', audit: 'Audyt', proposal: 'Oferta', negotiation: 'Negocjacje', onboarding: 'Wdrażanie', active: 'Aktywny', partner: 'Partner' }
        const cutoff7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        const { data: clients } = await supabase.from('clients').select('id, name, pipeline_stage, last_activity_at, industry').neq('status', 'closed')
        const { data: recentActivities } = await supabase.from('roadmap_activities').select('client_id, activity_type, title, created_at').order('created_at', { ascending: false }).limit(10)

        const counts = stages.map(s => ({
          stage: s, label: stageLabels[s],
          count: (clients ?? []).filter(c => (c.pipeline_stage ?? 'discovery') === s).length,
          firms: (clients ?? []).filter(c => (c.pipeline_stage ?? 'discovery') === s).map(c => c.name),
        }))
        const stagnant = (clients ?? []).filter(c => !c.last_activity_at || c.last_activity_at < cutoff7d).map(c => ({ name: c.name, stage: c.pipeline_stage, days_inactive: Math.floor((Date.now() - new Date(c.last_activity_at ?? 0).getTime()) / 86400000) }))
        return JSON.stringify({ pipeline: counts, stagnant_firms: stagnant, recent_activities: recentActivities ?? [], total: (clients ?? []).length })
      }

      case 'advance_pipeline_stage': {
        await supabase.from('clients').update({ pipeline_stage: input.stage as string }).eq('id', input.client_id as string)
        await supabase.from('roadmap_activities').insert({ client_id: input.client_id as string, stage_key: input.stage as string, activity_type: 'stage_change', title: `Przejście do etapu: ${input.stage}`, description: (input.note as string | undefined) ?? null })
        return `✅ Klient przesunięty do etapu "${input.stage}".`
      }

      case 'add_roadmap_activity': {
        const { error } = await supabase.from('roadmap_activities').insert({ client_id: input.client_id as string, stage_key: 'discovery', activity_type: input.activity_type as string, title: input.title as string, description: (input.description as string | undefined) ?? null, outcome: (input.outcome as string | undefined) ?? null })
        if (error) return `Błąd: ${error.message}`
        return '✅ Aktywność dodana.'
      }

      case 'get_cost_summary': {
        const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0)
        const [{ data: ai }, { data: subs }] = await Promise.all([
          supabase.from('ai_usage_log').select('feature, model, cost_usd, created_at').gte('created_at', startOfMonth.toISOString()),
          supabase.from('subscription_costs').select('name, category, amount_pln, billing_cycle, vendor, active').eq('active', true).order('amount_pln', { ascending: false }),
        ])
        const aiTotal = (ai ?? []).reduce((s, r) => s + (r.cost_usd ?? 0), 0)
        const monthlyPln = (subs ?? []).filter(s => s.billing_cycle === 'monthly').reduce((s, r) => s + (r.amount_pln ?? 0), 0)
        return JSON.stringify({ ai_cost_usd: aiTotal.toFixed(4), subscriptions: subs ?? [], monthly_total_pln: monthlyPln.toFixed(2) })
      }

      case 'save_offline_idea': {
        const { data, error } = await supabase.from('offline_ideas').insert({ title: input.title as string, category: input.category as string, description: (input.description as string | undefined) ?? null, priority: (input.priority as string) ?? 'medium', status: 'new', source_agent: 'second_brain', roi_notes: (input.roi_notes as string | undefined) ?? null }).select('id').single()
        if (error) return `Błąd: ${error.message}`
        return `✅ Pomysł zapisany na stronie Pomysły (id: ${data.id}).`
      }

      case 'get_daily_priorities': {
        const today = new Date().toISOString().split('T')[0]
        const cutoff7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        const [{ data: overdue }, { data: todayTasks }, { data: stagnant }, { data: openIdeas }] = await Promise.all([
          supabase.from('tasks').select('title, priority, due_date, clients(name)').eq('status', 'todo').lt('due_date', today).order('due_date').limit(5),
          supabase.from('tasks').select('title, priority, clients(name)').eq('status', 'todo').eq('due_date', today).limit(5),
          supabase.from('clients').select('name, pipeline_stage, last_activity_at').neq('status', 'closed').or(`last_activity_at.is.null,last_activity_at.lt.${cutoff7d}`).limit(5),
          supabase.from('offline_ideas').select('title, priority, category').in('status', ['new', 'considering']).order('created_at', { ascending: false }).limit(3),
        ])
        return JSON.stringify({ overdue_tasks: overdue ?? [], todays_tasks: todayTasks ?? [], stagnant_clients: stagnant ?? [], new_ideas: openIdeas ?? [] })
      }

      case 'run_guardian_scan': {
        try {
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
          const res = await fetch(`${baseUrl}/api/guardian/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
          if (res.ok) {
            const data = await res.json() as { summary?: string; findings?: unknown[] }
            return `Guardian: ${data.summary ?? 'Skan zakończony.'} Alertów: ${Array.isArray(data.findings) ? data.findings.length : 0}.`
          }
        } catch { /* ignore */ }
        return 'Guardian scan uruchomiony w tle.'
      }

      case 'generate_meeting_brief': {
        const [{ data: client }, { data: notes }, { data: audits }, { data: activities }, { data: tasks }] = await Promise.all([
          supabase.from('clients').select('*').eq('id', input.client_id as string).single(),
          supabase.from('client_notes').select('content, importance, created_at').eq('client_id', input.client_id as string).order('created_at', { ascending: false }).limit(5),
          supabase.from('audits').select('title, status, score, ai_summary, created_at').eq('client_id', input.client_id as string).order('created_at', { ascending: false }).limit(1),
          supabase.from('roadmap_activities').select('activity_type, title, description, outcome, created_at').eq('client_id', input.client_id as string).order('created_at', { ascending: false }).limit(12),
          supabase.from('tasks').select('title, status, priority').eq('client_id', input.client_id as string).neq('status', 'done').limit(5),
        ])
        return JSON.stringify({ client, recent_notes: notes ?? [], latest_audit: audits?.[0] ?? null, recent_activities: activities ?? [], open_tasks: tasks ?? [] })
      }

      case 'get_client_opportunities': {
        const [{ data: client }, { data: stack }, { data: audit }] = await Promise.all([
          supabase.from('clients').select('name, industry, status, pipeline_stage').eq('id', input.client_id as string).single(),
          supabase.from('stack_items').select('name, category, status, description, monthly_value_pln').eq('client_id', input.client_id as string).order('status'),
          supabase.from('audits').select('ai_summary, status, created_at').eq('client_id', input.client_id as string).order('created_at', { ascending: false }).limit(1),
        ])
        const liveItems = (stack ?? []).filter(s => s.status === 'live')
        const plannedItems = (stack ?? []).filter(s => ['planned', 'idea'].includes(s.status))
        const totalMonthlyValue = liveItems.reduce((s, i) => s + (i.monthly_value_pln ?? 0), 0)
        return JSON.stringify({ client, live_implementations: liveItems, planned_implementations: plannedItems, total_monthly_value_pln: totalMonthlyValue, latest_audit_summary: audit?.[0]?.ai_summary ?? null })
      }

      case 'get_recent_ideas': {
        let q = supabase.from('offline_ideas').select('id, title, category, priority, status, description, roi_notes, created_at, source_agent')
        if (input.status) q = q.eq('status', input.status as string)
        const { data } = await q.order('created_at', { ascending: false }).limit((input.limit as number) ?? 10)
        return JSON.stringify(data ?? [])
      }

      case 'get_radar_signals': {
        const { data } = await supabase.from('intelligence_digests').select('highlights, generated_at, source_count').order('generated_at', { ascending: false }).limit(1)
        if (!data?.length) return 'Brak danych z Radaru — uruchom Radar na stronie Wywiad.'
        const digest = data[0]
        return JSON.stringify({ generated_at: digest.generated_at, source_count: digest.source_count, top_signals: (digest.highlights as unknown[]).slice(0, 5) })
      }

      case 'draft_follow_up': {
        const [{ data: client }, { data: activities }, { data: notes }] = await Promise.all([
          supabase.from('clients').select('name, industry, pipeline_stage, owner_name').eq('id', input.client_id as string).single(),
          supabase.from('roadmap_activities').select('activity_type, title, description, outcome, created_at').eq('client_id', input.client_id as string).order('created_at', { ascending: false }).limit(5),
          supabase.from('client_notes').select('content, created_at').eq('client_id', input.client_id as string).order('created_at', { ascending: false }).limit(3),
        ])
        return JSON.stringify({ client, recent_activities: activities ?? [], recent_notes: notes ?? [], channel: input.channel ?? 'email', extra_context: input.context ?? '', instruction: 'Wygeneruj konkretną wiadomość follow-up w naturalnym tonie, bez korporacyjnego języka. Powołaj się na konkretne rozmowy/tematy z historii.' })
      }

      default:
        return `Nieznane narzędzie: ${name}`
    }
  } catch (err) {
    return `Błąd: ${err instanceof Error ? err.message : String(err)}`
  }
}

// ─── Build system prompt ──────────────────────────────────────────────────────

async function buildSystemPrompt(supabase: ReturnType<typeof createSupabaseAdminClient>): Promise<string> {
  // Fetch live context
  const today = new Date().toLocaleString('pl-PL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  const cutoff7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const todayStr = new Date().toISOString().split('T')[0]
  const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0)

  const [
    { data: clients },
    { data: overdueTasks },
    { data: todayTasks },
    { data: aiUsage },
    { data: latestIdeas },
  ] = await Promise.all([
    supabase.from('clients').select('name, status, pipeline_stage, industry, last_activity_at').neq('status', 'closed').order('name').limit(20),
    supabase.from('tasks').select('title, priority, due_date, clients(name)').eq('status', 'todo').lt('due_date', todayStr).order('due_date').limit(5),
    supabase.from('tasks').select('title, priority, clients(name)').eq('status', 'todo').eq('due_date', todayStr).limit(5),
    supabase.from('ai_usage_log').select('cost_usd').gte('created_at', startOfMonth.toISOString()),
    supabase.from('offline_ideas').select('title, priority').in('status', ['new', 'considering']).order('created_at', { ascending: false }).limit(3),
  ])

  const aiCost = (aiUsage ?? []).reduce((s, r) => s + (r.cost_usd ?? 0), 0)
  const stagnantClients = (clients ?? []).filter(c => !c.last_activity_at || c.last_activity_at < cutoff7d)

  const clientsBlock = (clients ?? []).length
    ? (clients ?? []).map(c => `  - ${c.name} [${c.pipeline_stage ?? 'discovery'} | ${c.status} | ${c.industry ?? '—'}]`).join('\n')
    : '  (brak klientów)'

  const urgentBlock = [
    ...(overdueTasks ?? []).map(t => { const cl = (t.clients as unknown as {name:string}|null); return `  ⚠️ ZALEGŁE: "${t.title}" ${cl?.name ? `→ ${cl.name}` : ''}` }),
    ...(todayTasks ?? []).map(t => { const cl = (t.clients as unknown as {name:string}|null); return `  📌 DZIŚ: "${t.title}" ${cl?.name ? `→ ${cl.name}` : ''}` }),
    ...(stagnantClients).map(c => `  🔴 BRAK KONTAKTU 7d+: ${c.name} [${c.pipeline_stage}]`),
  ].join('\n') || '  ✅ Nic pilnego'

  const ideasBlock = (latestIdeas ?? []).map(i => `  - "${i.title}" [${i.priority}]`).join('\n') || '  (brak nowych pomysłów)'

  return `Jesteś **Drugi Mózg** — główny partner biznesowy i szef działu AI firmy 77STF.
Dzisiaj: ${today}

## KIM JESTEŚ
Nie jesteś asystentem. Jesteś partnerem biznesowym który zna każdy aspekt działalności, inicjuje działania, układa priorytety i prowadzi właściciela przez decyzje jak doświadczony współpracownik. Właściciel ma 17 lat, myśli systemowo i wizjonersko — Twoim zadaniem jest zamieniać jego pomysły w konkretne plany, a nie pytać o szczegóły których możesz się domyślić.

## 77STF — KONTEKST FIRMY
Zewnętrzny dział tech dla polskich MŚP (10-50 osób). Usługi: automatyzacje AI, voice agents (Vapi+ElevenLabs), chatboty RAG, social media automation, content z drona.

## AKTYWNI KLIENCI I LEADY
${clientsBlock}

**Kluczowe leady (z pamięci):**
- Avvlo (farmacja) — Michał Szarycz. Czeka na voice agent DEMO — to go zaskoczy (Vapi+ElevenLabs). Chce: chatbot RAG (pytania kliniczne), analizę konkurencji, CEO raporty.
- Petro-Lawa — paliwo. Follow-up zaległy.
- Galenos HK — Łukasz Horodenski. Z polecenia Michała. Te same potrzeby co Avvlo (farmacja).

## PILNE SPRAWY TERAZ
${urgentBlock}

## POMYSŁY DO PRZEMYŚLENIA (ostatnie)
${ideasBlock}

## KOSZTY AI TEN MIESIĄC
$${aiCost.toFixed(4)} USD

## TWÓJ STYL PRACY
- **Odpowiedź po polsku**, konkretnie i po ludzku — jak partner, nie jak bot
- Po każdej odpowiedzi zaproponuj 2-3 konkretne następne kroki (w formie listy)
- Gdy właściciel wspomina pomysł → ZAWSZE zapisz go przez save_offline_idea
- Gdy mówi o kliencie → sprawdź dane przez get_client_details, zaproponuj konkretną akcję
- Gdy pyta "co robić?" → użyj get_daily_priorities, wygeneruj ranking z uzasadnieniem
- Masz 20 narzędzi — używaj ich proaktywnie, nie pytaj o zgodę na proste akcje
- Nigdy "może warto rozważyć" — zawsze konkretna rekomendacja z uzasadnieniem
- Format: używaj **pogrubień**, list, podziału na sekcje — odpowiedzi muszą być łatwe do przeskanowania wzrokiem
- Jeśli czegoś nie wiesz — używaj narzędzi żeby się dowiedzieć, nie domyślaj się`
}

// ─── Streaming route ──────────────────────────────────────────────────────────

export const maxDuration = 60

export async function POST(req: Request) {
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) {
    return new Response('data: ' + JSON.stringify({ type: 'error', error: 'Brak autoryzacji' }) + '\n\n', {
      status: 401,
      headers: { 'Content-Type': 'text/event-stream' },
    })
  }

  if (!rateLimit(`operator-stream:${user.id}`, 30, 60_000)) {
    return new Response('data: ' + JSON.stringify({ type: 'error', error: 'Za dużo zapytań. Odczekaj chwilę.' }) + '\n\n', {
      status: 429,
      headers: { 'Content-Type': 'text/event-stream' },
    })
  }

  let body: {
    messages: Anthropic.Messages.MessageParam[]
    conversation_id?: string
  }
  try { body = await req.json() as typeof body }
  catch {
    return new Response('data: ' + JSON.stringify({ type: 'error', error: 'Nieprawidłowy format' }) + '\n\n', {
      status: 400,
      headers: { 'Content-Type': 'text/event-stream' },
    })
  }

  const supabase = createSupabaseAdminClient()
  const conversationMessages = body.messages.slice(-30)

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))
      }

      try {
        // Build system prompt with live context
        const systemPrompt = await buildSystemPrompt(supabase)

        let messages = [...conversationMessages]
        let totalInput = 0
        let totalOutput = 0
        let finalText = ''
        const toolsUsed: string[] = []

        // Agentic loop — max 6 iterations
        for (let iter = 0; iter < 6; iter++) {
          let iterText = ''

          if (iter === 0) {
            // First iteration: stream text tokens
            const streamResponse = anthropic.messages.stream({
              model: AI_MODELS.balanced,
              max_tokens: 2000,
              system: systemPrompt,
              tools: TOOLS,
              messages,
            })

            for await (const event of streamResponse) {
              if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                iterText += event.delta.text
                send({ type: 'text', delta: event.delta.text })
              }
            }

            const finalMsg = await streamResponse.finalMessage()
            totalInput += finalMsg.usage.input_tokens
            totalOutput += finalMsg.usage.output_tokens

            if (finalMsg.stop_reason === 'end_turn') {
              finalText = iterText
              break
            }

            if (finalMsg.stop_reason === 'tool_use') {
              const toolBlocks = finalMsg.content.filter((b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use')

              // Execute tools
              const toolResults = await Promise.all(
                toolBlocks.map(async block => {
                  toolsUsed.push(block.name)
                  send({ type: 'tool_start', name: block.name })
                  const result = await executeTool(block.name, block.input as Record<string, unknown>, supabase)
                  send({ type: 'tool_end', name: block.name })
                  return { type: 'tool_result' as const, tool_use_id: block.id, content: result }
                })
              )

              messages = [
                ...messages,
                { role: 'assistant' as const, content: finalMsg.content },
                { role: 'user' as const, content: toolResults },
              ]
              // Continue to next iteration (non-streaming for tool-followup turns)
            }
          } else {
            // Subsequent iterations after tool use: stream again
            const streamResponse = anthropic.messages.stream({
              model: AI_MODELS.balanced,
              max_tokens: 2000,
              system: systemPrompt,
              tools: TOOLS,
              messages,
            })

            for await (const event of streamResponse) {
              if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                iterText += event.delta.text
                send({ type: 'text', delta: event.delta.text })
              }
            }

            const finalMsg = await streamResponse.finalMessage()
            totalInput += finalMsg.usage.input_tokens
            totalOutput += finalMsg.usage.output_tokens

            if (finalMsg.stop_reason === 'end_turn') {
              finalText += iterText
              break
            }

            if (finalMsg.stop_reason === 'tool_use') {
              const toolBlocks = finalMsg.content.filter((b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use')
              const toolResults = await Promise.all(
                toolBlocks.map(async block => {
                  toolsUsed.push(block.name)
                  send({ type: 'tool_start', name: block.name })
                  const result = await executeTool(block.name, block.input as Record<string, unknown>, supabase)
                  send({ type: 'tool_end', name: block.name })
                  return { type: 'tool_result' as const, tool_use_id: block.id, content: result }
                })
              )
              messages = [
                ...messages,
                { role: 'assistant' as const, content: finalMsg.content },
                { role: 'user' as const, content: toolResults },
              ]
            } else {
              finalText += iterText
              break
            }
          }
        }

        // Send done event
        send({ type: 'done', tools_used: toolsUsed })

        // Persist conversation (background)
        void (async () => {
          if (body.conversation_id) {
            const { data: conv } = await supabase.from('agent_conversations').select('messages').eq('id', body.conversation_id).single()
            if (conv) {
              const updated = [
                ...(conv.messages as Anthropic.Messages.MessageParam[]),
                ...body.messages,
                { role: 'assistant' as const, content: finalText },
              ]
              await supabase.from('agent_conversations').update({ messages: updated }).eq('id', body.conversation_id)
            }
          } else if (body.messages.length === 1) {
            const firstMsg = body.messages[0]
            const titleText = typeof firstMsg.content === 'string' ? firstMsg.content.slice(0, 60) : 'Nowa rozmowa'
            await supabase.from('agent_conversations').insert({
              user_id: user.id,
              title: titleText,
              messages: [...body.messages, { role: 'assistant', content: finalText }],
            })
          }

          // Track usage
          const model = AI_MODELS.balanced
          const rate = APPROX_COST_PER_1K[model as keyof typeof APPROX_COST_PER_1K] ?? 0.015
          const costUsd = ((totalInput / 1000) * (rate * 0.2)) + ((totalOutput / 1000) * rate)
          await supabase.from('ai_usage_log').insert({
            feature: 'drugiMozg',
            model,
            input_tokens: totalInput,
            output_tokens: totalOutput,
            cost_usd: costUsd,
            triggered_by: 'user',
            metadata: { tools_used: toolsUsed, streaming: true },
          })
        })()

      } catch (err) {
        send({ type: 'error', error: err instanceof Error ? err.message : 'Błąd wewnętrzny' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
