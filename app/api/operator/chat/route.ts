import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase'
import { AI_MODELS, APPROX_COST_PER_1K } from '@/lib/ai-config'
import { rateLimit } from '@/lib/rate-limit'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// ─── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: 'list_clients',
    description: 'Pobierz listę klientów z podstawowymi info. Opcjonalnie filtruj po statusie.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string', enum: ['lead', 'active', 'partner', 'closed'], description: 'Filtruj po statusie (opcjonalnie)' },
      },
    },
  },
  {
    name: 'get_client_details',
    description: 'Pobierz szczegóły klienta: dane + ostatnie notatki + otwarte zadania + audyty.',
    input_schema: {
      type: 'object' as const,
      properties: {
        client_id: { type: 'string', description: 'UUID klienta' },
      },
      required: ['client_id'],
    },
  },
  {
    name: 'create_task',
    description: 'Utwórz nowe zadanie w CRM.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title:       { type: 'string', description: 'Tytuł zadania' },
        client_id:   { type: 'string', description: 'UUID klienta (opcjonalnie)' },
        priority:    { type: 'string', enum: ['low', 'medium', 'high'], description: 'Priorytet (domyślnie medium)' },
        description: { type: 'string', description: 'Opis zadania (opcjonalnie)' },
        due_date:    { type: 'string', description: 'Termin ISO 8601 (opcjonalnie)' },
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
        client_id:  { type: 'string', description: 'UUID klienta' },
        content:    { type: 'string', description: 'Treść notatki' },
        importance: { type: 'string', enum: ['high', 'medium', 'low'], description: 'Ważność (domyślnie medium)' },
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
        client_id: { type: 'string', description: 'UUID klienta' },
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
        client_id: { type: 'string', description: 'Filtruj po kliencie (opcjonalnie)' },
        status:    { type: 'string', enum: ['todo', 'in_progress', 'done'], description: 'Filtruj po statusie (opcjonalnie)' },
      },
    },
  },
  {
    name: 'get_system_stats',
    description: 'Pobierz statystyki systemu: liczba klientów, zadań, koszty AI tego miesiąca.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'search_clients',
    description: 'Wyszukaj klienta po nazwie lub branży.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Fraza wyszukiwania (nazwa lub branża)' },
      },
      required: ['query'],
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
        let query = supabase.from('clients').select('id, name, status, industry, owner_name, owner_phone, created_at')
        if (input.status) query = query.eq('status', input.status as string)
        const { data } = await query.order('name').limit(50)
        return JSON.stringify(data ?? [])
      }

      case 'get_client_details': {
        const [{ data: client }, { data: notes }, { data: tasks }, { data: audits }] = await Promise.all([
          supabase.from('clients').select('*').eq('id', input.client_id as string).single(),
          supabase.from('client_notes').select('content, importance, source, created_at').eq('client_id', input.client_id as string).order('created_at', { ascending: false }).limit(10),
          supabase.from('tasks').select('title, status, priority, due_date').eq('client_id', input.client_id as string).neq('status', 'done').order('created_at', { ascending: false }).limit(10),
          supabase.from('audits').select('title, status, created_at').eq('client_id', input.client_id as string).order('created_at', { ascending: false }).limit(3),
        ])
        return JSON.stringify({ client, notes: notes ?? [], open_tasks: tasks ?? [], audits: audits ?? [] })
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
        const { data } = await supabase.from('clients').select('id, name, status, industry, owner_name').or(`name.ilike.${q},industry.ilike.${q}`).limit(10)
        return JSON.stringify(data ?? [])
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

  let body: { messages: Anthropic.Messages.MessageParam[] }
  try { body = await req.json() as typeof body }
  catch { return NextResponse.json({ error: 'Nieprawidłowy format' }, { status: 400 }) }

  const supabase = createSupabaseAdminClient()
  const conversationMessages = body.messages.slice(-20) // keep last 20 turns

  // Fetch live system snapshot to give Operator full context
  let snapshotContext = ''
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const snap = await fetch(`${baseUrl}/api/system/snapshot`, {
      headers: { 'Cookie': req.headers.get('cookie') ?? '' },
    })
    if (snap.ok) {
      const data = await snap.json() as Record<string, unknown>
      snapshotContext = `\n\n## AKTUALNY STAN SYSTEMU (live data, ${new Date().toLocaleString('pl-PL')})\n${JSON.stringify(data, null, 2)}`
    }
  } catch { /* snapshot is best-effort, don't block */ }

  const systemPrompt = `Jesteś Agent Operator — główny AI asystent firmy 77STF.
77STF to zewnętrzny dział tech dla polskich MŚP: automatyzacje AI, voice agents, chatboty, social media automation.
Stack: Next.js, Supabase, Claude API, n8n, Vapi.ai, ElevenLabs, Vercel.

Twoja rola: pomagasz właścicielowi zarządzać całą firmą — CRM, klientami, zadaniami, finansami AI, systemem.
Masz dostęp do narzędzi CRM oraz PEŁNY KONTEKST systemu w sekcji poniżej.

Zasady:
- Odpowiadasz PO POLSKU, zwięźle i konkretnie
- Gdy pytają "kto / ile / jakie / kiedy" → sprawdź snapshot lub użyj narzędzia, potem odpowiedz
- Gdy mówią "dodaj / zanotuj / zmień" → wykonaj natychmiast narzędziem
- Po wykonaniu → potwierdź + zaproponuj co dalej
- Nie pytaj o potwierdzenie prostych akcji — działaj
- Możesz analizować i interpretować dane ze snapshotu — to twój główny kontekst
- Znasz roadmapę, pending tasks, zdrowie systemu — używaj tej wiedzy aktywnie
- Dla destructive actions (usuń klienta, etc.) → powiedz że to wymaga ręcznej akcji w dashboard
${snapshotContext}`

  let messages = [...conversationMessages]
  let totalInputTokens = 0
  let totalOutputTokens = 0
  let finalText = ''
  const toolsUsed: string[] = []

  // Agentic loop — max 5 iterations to prevent runaway
  for (let i = 0; i < 5; i++) {
    const response = await anthropic.messages.create({
      model: AI_MODELS.balanced,
      max_tokens: 1024,
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

      // Execute all tools in parallel
      const toolResults = await Promise.all(
        toolUseBlocks.map(async block => {
          toolsUsed.push(block.name)
          const result = await executeTool(block.name, block.input as Record<string, unknown>, supabase)
          return {
            type: 'tool_result' as const,
            tool_use_id: block.id,
            content: result,
          }
        })
      )

      // Add assistant message and tool results to conversation
      messages = [
        ...messages,
        { role: 'assistant' as const, content: response.content },
        { role: 'user' as const, content: toolResults },
      ]
      continue
    }

    // Unexpected stop reason
    finalText = 'Nie rozumiem. Spróbuj ponownie.'
    break
  }

  // Track usage
  const model = AI_MODELS.balanced
  const outputRate = APPROX_COST_PER_1K[model as keyof typeof APPROX_COST_PER_1K] ?? 0.015
  const costUsd = ((totalInputTokens / 1000) * (outputRate * 0.2)) + ((totalOutputTokens / 1000) * outputRate)

  void supabase.from('ai_usage_log').insert({
    feature: 'operatorChat',
    model,
    input_tokens: totalInputTokens,
    output_tokens: totalOutputTokens,
    cost_usd: costUsd,
    triggered_by: 'user',
    metadata: { tools_used: toolsUsed, iterations: toolsUsed.length + 1 },
  })

  return NextResponse.json({ text: finalText, tools_used: toolsUsed })
}
