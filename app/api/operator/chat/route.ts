import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase'
import { AI_MODELS, APPROX_COST_PER_1K } from '@/lib/ai-config'
import { rateLimit } from '@/lib/rate-limit'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// ─── Tool definitions (16 tools) ─────────────────────────────────────────────

const TOOLS: Anthropic.Messages.Tool[] = [
  // --- CRM (8 existing) ---
  {
    name: 'list_clients',
    description: 'Pobierz listę klientów z podstawowymi info. Opcjonalnie filtruj po statusie lub etapie pipeline.',
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
    description: 'Pobierz szczegóły klienta: dane + ostatnie notatki + otwarte zadania + audyty + aktywności roadmap.',
    input_schema: {
      type: 'object' as const,
      properties: { client_id: { type: 'string', description: 'UUID klienta' } },
      required: ['client_id'],
    },
  },
  {
    name: 'create_task',
    description: 'Utwórz nowe zadanie w CRM.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title:       { type: 'string' },
        client_id:   { type: 'string' },
        priority:    { type: 'string', enum: ['low', 'medium', 'high'] },
        description: { type: 'string' },
        due_date:    { type: 'string', description: 'ISO 8601' },
      },
      required: ['title'],
    },
  },
  {
    name: 'add_client_note',
    description: 'Dodaj notatkę do profilu klienta.',
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
    description: 'Zmień status klienta (lead/active/partner/closed).',
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
    description: 'Pobierz zadania. Opcjonalnie filtruj po kliencie lub statusie.',
    input_schema: {
      type: 'object' as const,
      properties: {
        client_id: { type: 'string' },
        status:    { type: 'string', enum: ['todo', 'in_progress', 'done'] },
      },
    },
  },
  {
    name: 'get_system_stats',
    description: 'Pobierz statystyki systemu: klienci, zadania, koszty AI tego miesiąca.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'search_clients',
    description: 'Wyszukaj klienta po nazwie lub branży.',
    input_schema: {
      type: 'object' as const,
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
  },

  // --- Pipeline (3 new) ---
  {
    name: 'get_roadmap_overview',
    description: 'Pobierz pełny przegląd pipeline: ile firm w każdym etapie, ostatnie aktywności, stagnacje.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'advance_pipeline_stage',
    description: 'Przesuń klienta do konkretnego etapu pipeline.',
    input_schema: {
      type: 'object' as const,
      properties: {
        client_id: { type: 'string' },
        stage:     { type: 'string', enum: ['discovery', 'audit', 'proposal', 'negotiation', 'onboarding', 'active', 'partner'] },
        note:      { type: 'string', description: 'Opcjonalna notatka o powodzie zmiany' },
      },
      required: ['client_id', 'stage'],
    },
  },
  {
    name: 'add_roadmap_activity',
    description: 'Dodaj aktywność do klienta w pipeline (rozmowa, email, notatka, spotkanie, itp.).',
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

  // --- Business intelligence (3 new) ---
  {
    name: 'get_cost_summary',
    description: 'Pobierz podsumowanie wszystkich kosztów: AI (ten miesiąc) oraz subskrypcje biznesowe.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'save_offline_idea',
    description: 'Zapisz pomysł do offline review na stronie Pomysły. Użyj gdy właściciel wspomina o pomyśle który warto zapamiętać.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title:       { type: 'string' },
        description: { type: 'string' },
        category:    { type: 'string', enum: ['implementation', 'system_upgrade', 'owner_idea', 'tool', 'integration'] },
        priority:    { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
        roi_notes:   { type: 'string', description: 'Szacunkowy wpływ lub ROI' },
      },
      required: ['title', 'category'],
    },
  },
  {
    name: 'get_daily_priorities',
    description: 'Wygeneruj ranking "co powinienem dziś zrobić" na podstawie zadań, stagnacji w pipeline i alertów systemu.',
    input_schema: { type: 'object' as const, properties: {} },
  },

  // --- System (2 new) ---
  {
    name: 'run_guardian_scan',
    description: 'Uruchom szybki skan Opiekuna Systemu — sprawdź czy coś jest nie tak.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'generate_meeting_brief',
    description: 'Wygeneruj brief na spotkanie z klientem: kontekst, historia, otwarte tematy, sugerowane pytania.',
    input_schema: {
      type: 'object' as const,
      properties: { client_id: { type: 'string' } },
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
        let query = supabase.from('clients').select('id, name, status, pipeline_stage, industry, owner_name, owner_phone, created_at, last_activity_at')
        if (input.status)         query = query.eq('status', input.status as string)
        if (input.pipeline_stage) query = query.eq('pipeline_stage', input.pipeline_stage as string)
        const { data } = await query.order('name').limit(50)
        return JSON.stringify(data ?? [])
      }

      case 'get_client_details': {
        const [{ data: client }, { data: notes }, { data: tasks }, { data: audits }, { data: activities }] = await Promise.all([
          supabase.from('clients').select('*').eq('id', input.client_id as string).single(),
          supabase.from('client_notes').select('content, importance, source, created_at').eq('client_id', input.client_id as string).order('created_at', { ascending: false }).limit(10),
          supabase.from('tasks').select('title, status, priority, due_date').eq('client_id', input.client_id as string).neq('status', 'done').order('created_at', { ascending: false }).limit(10),
          supabase.from('audits').select('title, status, score, created_at').eq('client_id', input.client_id as string).order('created_at', { ascending: false }).limit(3),
          supabase.from('roadmap_activities').select('activity_type, title, description, created_at').eq('client_id', input.client_id as string).order('created_at', { ascending: false }).limit(10),
        ])
        return JSON.stringify({ client, notes: notes ?? [], open_tasks: tasks ?? [], audits: audits ?? [], recent_activities: activities ?? [] })
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
        return `Zadanie utworzone: "${data.title}" (id: ${data.id})`
      }

      case 'add_client_note': {
        const { error } = await supabase.from('client_notes').insert({
          client_id:  input.client_id as string,
          content:    input.content as string,
          importance: (input.importance as string) ?? 'medium',
          source:     'operator',
        })
        if (error) return `Błąd: ${error.message}`
        return 'Notatka dodana.'
      }

      case 'update_client_status': {
        const { error } = await supabase.from('clients').update({ status: input.status as string }).eq('id', input.client_id as string)
        if (error) return `Błąd: ${error.message}`
        return `Status klienta zmieniony na "${input.status}".`
      }

      case 'list_tasks': {
        let query = supabase.from('tasks').select('id, title, status, priority, due_date, client_id, clients(name)')
        if (input.client_id) query = query.eq('client_id', input.client_id as string)
        if (input.status)    query = query.eq('status', input.status as string)
        const { data } = await query.order('created_at', { ascending: false }).limit(30)
        return JSON.stringify(data ?? [])
      }

      case 'get_system_stats': {
        const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0)
        const [{ count: clientCount }, { count: taskCount }, { data: usage }] = await Promise.all([
          supabase.from('clients').select('*', { count: 'exact', head: true }),
          supabase.from('tasks').select('*', { count: 'exact', head: true }).neq('status', 'done'),
          supabase.from('ai_usage_log').select('cost_usd').gte('created_at', startOfMonth.toISOString()),
        ])
        const aiCostUsd = (usage ?? []).reduce((s, r) => s + (r.cost_usd ?? 0), 0)
        return JSON.stringify({ clients_total: clientCount, open_tasks: taskCount, ai_cost_this_month_usd: aiCostUsd.toFixed(4) })
      }

      case 'search_clients': {
        const q = `%${input.query as string}%`
        const { data } = await supabase.from('clients').select('id, name, status, pipeline_stage, industry, owner_name').or(`name.ilike.${q},industry.ilike.${q}`).limit(10)
        return JSON.stringify(data ?? [])
      }

      case 'get_roadmap_overview': {
        const stages = ['discovery', 'audit', 'proposal', 'negotiation', 'onboarding', 'active', 'partner']
        const stageLabels: Record<string, string> = {
          discovery: 'Odkrywanie', audit: 'Audyt', proposal: 'Oferta',
          negotiation: 'Negocjacje', onboarding: 'Wdrażanie', active: 'Aktywny', partner: 'Partner',
        }
        const { data: clients } = await supabase.from('clients').select('id, name, pipeline_stage, last_activity_at, industry')

        const counts = stages.map(s => ({
          stage: s,
          label: stageLabels[s],
          count: (clients ?? []).filter(c => (c.pipeline_stage ?? 'discovery') === s).length,
          firms: (clients ?? []).filter(c => (c.pipeline_stage ?? 'discovery') === s).map(c => c.name),
        }))

        // Stagnations: no activity in 7+ days
        const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        const stagnant = (clients ?? []).filter(c => !c.last_activity_at || c.last_activity_at < cutoff).map(c => c.name)

        return JSON.stringify({ pipeline: counts, stagnant_firms: stagnant, total: (clients ?? []).length })
      }

      case 'advance_pipeline_stage': {
        await supabase.from('clients').update({ pipeline_stage: input.stage as string }).eq('id', input.client_id as string)
        await supabase.from('roadmap_activities').insert({
          client_id:     input.client_id as string,
          stage_key:     input.stage as string,
          activity_type: 'stage_change',
          title:         `Przejście do etapu: ${input.stage}`,
          description:   (input.note as string | undefined) ?? null,
        })
        await supabase.from('roadmap_stages').insert({ client_id: input.client_id as string, stage_key: input.stage as string, notes: (input.note as string | undefined) ?? null })
        return `Klient przesunięty do etapu "${input.stage}".`
      }

      case 'add_roadmap_activity': {
        const { error } = await supabase.from('roadmap_activities').insert({
          client_id:     input.client_id as string,
          stage_key:     'discovery',
          activity_type: input.activity_type as string,
          title:         input.title as string,
          description:   (input.description as string | undefined) ?? null,
          outcome:       (input.outcome as string | undefined) ?? null,
        })
        if (error) return `Błąd: ${error.message}`
        return 'Aktywność dodana do pipeline.'
      }

      case 'get_cost_summary': {
        const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0)
        const [{ data: aiUsage }, { data: subscriptions }] = await Promise.all([
          supabase.from('ai_usage_log').select('feature, model, cost_usd').gte('created_at', startOfMonth.toISOString()),
          supabase.from('subscription_costs').select('name, category, amount_pln, billing_cycle, vendor, active').eq('active', true),
        ])
        const aiTotal = (aiUsage ?? []).reduce((s, r) => s + (r.cost_usd ?? 0), 0)
        const monthlyPln = (subscriptions ?? [])
          .filter(s => s.billing_cycle === 'monthly')
          .reduce((s, r) => s + (r.amount_pln ?? 0), 0)
        return JSON.stringify({
          ai_cost_usd: aiTotal.toFixed(4),
          subscriptions: subscriptions ?? [],
          monthly_total_pln: monthlyPln.toFixed(2),
        })
      }

      case 'save_offline_idea': {
        const { data, error } = await supabase.from('offline_ideas').insert({
          title:       input.title as string,
          category:    input.category as string,
          description: (input.description as string | undefined) ?? null,
          priority:    (input.priority as string) ?? 'medium',
          status:      'new',
          source_agent: 'second_brain',
          roi_notes:   (input.roi_notes as string | undefined) ?? null,
        }).select('id').single()
        if (error) return `Błąd: ${error.message}`
        return `Pomysł zapisany na stronie Pomysły (id: ${data.id}).`
      }

      case 'get_daily_priorities': {
        const today = new Date().toISOString().split('T')[0]
        const cutoff7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

        const [{ data: overdueTasks }, { data: todayTasks }, { data: stagnantClients }] = await Promise.all([
          supabase.from('tasks').select('title, priority, due_date, clients(name)').eq('status', 'todo').lt('due_date', today).order('due_date').limit(5),
          supabase.from('tasks').select('title, priority, clients(name)').eq('status', 'todo').eq('due_date', today).limit(5),
          supabase.from('clients').select('name, pipeline_stage, last_activity_at').neq('status', 'closed').or(`last_activity_at.is.null,last_activity_at.lt.${cutoff7d}`).limit(5),
        ])

        return JSON.stringify({
          overdue_tasks: overdueTasks ?? [],
          todays_tasks: todayTasks ?? [],
          stagnant_clients: stagnantClients ?? [],
          message: 'Na podstawie tych danych wygeneruj ranking 3-5 najważniejszych rzeczy do zrobienia dziś.',
        })
      }

      case 'run_guardian_scan': {
        try {
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
          const res = await fetch(`${baseUrl}/api/guardian/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
          if (res.ok) {
            const data = await res.json() as { summary?: string; findings?: unknown[] }
            return `Guardian scan zakończony. ${data.summary ?? ''} Znaleziono ${Array.isArray(data.findings) ? data.findings.length : 0} alertów.`
          }
        } catch { /* ignore */ }
        return 'Guardian scan uruchomiony w tle.'
      }

      case 'generate_meeting_brief': {
        const [{ data: client }, { data: notes }, { data: audits }, { data: activities }] = await Promise.all([
          supabase.from('clients').select('*').eq('id', input.client_id as string).single(),
          supabase.from('client_notes').select('content, importance, created_at').eq('client_id', input.client_id as string).order('created_at', { ascending: false }).limit(5),
          supabase.from('audits').select('title, status, score, ai_summary, created_at').eq('client_id', input.client_id as string).order('created_at', { ascending: false }).limit(1),
          supabase.from('roadmap_activities').select('activity_type, title, description, created_at').eq('client_id', input.client_id as string).order('created_at', { ascending: false }).limit(10),
        ])
        return JSON.stringify({
          client,
          recent_notes: notes ?? [],
          latest_audit: audits?.[0] ?? null,
          recent_activities: activities ?? [],
          instruction: 'Wygeneruj brief na spotkanie: kontekst firmy, historia relacji, otwarte tematy, 3-5 pytań do zadania, potencjalne obiekcje.',
        })
      }

      default:
        return `Nieznane narzędzie: ${name}`
    }
  } catch (err) {
    return `Błąd wykonania narzędzia: ${err instanceof Error ? err.message : String(err)}`
  }
}

// ─── POST /api/operator/chat ──────────────────────────────────────────────────

export async function POST(req: Request) {
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })

  if (!rateLimit(`operator:${user.id}`, 30, 60 * 1000)) {
    return NextResponse.json({ error: 'Za dużo zapytań. Odczekaj chwilę.' }, { status: 429 })
  }

  let body: {
    messages: Anthropic.Messages.MessageParam[]
    conversation_id?: string
    title?: string
  }
  try { body = await req.json() as typeof body }
  catch { return NextResponse.json({ error: 'Nieprawidłowy format' }, { status: 400 }) }

  const supabase = createSupabaseAdminClient()
  const conversationMessages = body.messages.slice(-30) // keep last 30 turns

  // Fetch live system snapshot
  let snapshotContext = ''
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const snap = await fetch(`${baseUrl}/api/system/snapshot`, {
      headers: { 'Cookie': req.headers.get('cookie') ?? '' },
    })
    if (snap.ok) {
      const data = await snap.json() as Record<string, unknown>
      snapshotContext = `\n\n## AKTUALNY STAN SYSTEMU (${new Date().toLocaleString('pl-PL')})\n${JSON.stringify(data, null, 2)}`
    }
  } catch { /* best-effort */ }

  const systemPrompt = `Jesteś Drugi Mózg — główny partner biznesowy i AI asystent firmy 77STF.
77STF to zewnętrzny dział tech dla polskich MŚP: automatyzacje AI, voice agents (Vapi+ElevenLabs), chatboty RAG, social media automation, nagrania z drona.
Właściciel ma 17 lat, myśli systemowo, często ma za dużo pomysłów naraz — Twoim zadaniem jest układać priorytety i prowadzić, nie czekać na rozkazy.

Aktywne leady: Avvlo (farmacja, Michał Szarycz — czeka na audyt), Petro-Lawa (paliwo), Galenos HK (Łukasz Horodenski — z polecenia Avvlo, te same potrzeby).

## TWÓJ STYL
- Mów PO POLSKU, konkretnie i po ludzku — jak partner, nie jak bot
- Nie czekaj na pytanie — po każdej odpowiedzi zaproponuj 2-3 konkretne następne kroki
- Gdy właściciel mówi o pomyśle → zapisz go narzędziem save_offline_idea
- Gdy pyta "co robić dziś?" → użyj get_daily_priorities a potem wygeneruj konkretny ranking
- Gdy mówi o kliencie → sprawdź dane, aktywności pipeline, zaproponuj akcję
- Masz 16 narzędzi — używaj ich aktywnie, nie czekaj na zgodę na proste akcje
- Odpowiadaj na przemyślane pytania filozofią "co + dlaczego + jak" w 3-5 zdaniach
- Nigdy nie pisz "może warto rozważyć" — zawsze konkretna rekomendacja
${snapshotContext}`

  let messages = [...conversationMessages]
  let totalInputTokens = 0
  let totalOutputTokens = 0
  let finalText = ''
  const toolsUsed: string[] = []

  // Agentic loop — max 6 iterations
  for (let i = 0; i < 6; i++) {
    const response = await anthropic.messages.create({
      model: AI_MODELS.balanced,
      max_tokens: 1500,
      system: systemPrompt,
      tools: TOOLS,
      messages,
    })

    totalInputTokens += response.usage.input_tokens
    totalOutputTokens += response.usage.output_tokens

    if (response.stop_reason === 'end_turn') {
      finalText = response.content
        .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
        .map(b => b.text)
        .join('')
      break
    }

    if (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use'
      )
      const toolResults = await Promise.all(
        toolUseBlocks.map(async block => {
          toolsUsed.push(block.name)
          const result = await executeTool(block.name, block.input as Record<string, unknown>, supabase)
          return { type: 'tool_result' as const, tool_use_id: block.id, content: result }
        })
      )
      messages = [
        ...messages,
        { role: 'assistant' as const, content: response.content },
        { role: 'user' as const, content: toolResults },
      ]
      continue
    }

    finalText = 'Nie rozumiem. Spróbuj ponownie.'
    break
  }

  // Persist conversation
  if (body.conversation_id) {
    // Append to existing
    const { data: conv } = await supabase.from('agent_conversations').select('messages').eq('id', body.conversation_id).single()
    if (conv) {
      const updatedMessages = [
        ...(conv.messages as Anthropic.Messages.MessageParam[]),
        ...body.messages.slice(-(body.messages.length)),
        { role: 'assistant' as const, content: finalText },
      ]
      await supabase.from('agent_conversations').update({ messages: updatedMessages }).eq('id', body.conversation_id)
    }
  } else if (body.messages.length === 1) {
    // New conversation — auto-title from first message
    const firstUserMsg = body.messages[0]
    const titleText = typeof firstUserMsg.content === 'string'
      ? firstUserMsg.content.slice(0, 60)
      : 'Nowa rozmowa'
    await supabase.from('agent_conversations').insert({
      user_id: user.id,
      title: titleText,
      messages: [
        ...body.messages,
        { role: 'assistant', content: finalText },
      ],
    })
  }

  // Track usage
  const model = AI_MODELS.balanced
  const outputRate = APPROX_COST_PER_1K[model as keyof typeof APPROX_COST_PER_1K] ?? 0.015
  const costUsd = ((totalInputTokens / 1000) * (outputRate * 0.2)) + ((totalOutputTokens / 1000) * outputRate)

  void supabase.from('ai_usage_log').insert({
    feature: 'drugiMozg',
    model,
    input_tokens: totalInputTokens,
    output_tokens: totalOutputTokens,
    cost_usd: costUsd,
    triggered_by: 'user',
    metadata: { tools_used: toolsUsed, iterations: toolsUsed.length + 1 },
  })

  return NextResponse.json({ text: finalText, tools_used: toolsUsed })
}
