import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase'
import { callClaude } from '@/lib/claude'
import { AI_MODELS } from '@/lib/ai-config'
import { verifySlackSignature, postToSlack, buildBriefBlock, buildStatusBlock, buildErrorBlock } from '@/lib/slack'

// POST /api/slack/commands
// Handles Slack slash commands: /77brief /77crm /77status /77radar /77task
// Setup: api.slack.com → Slash Commands → Request URL: /api/slack/commands

export async function POST(req: Request) {
  const rawBody = await req.text()
  const timestamp = req.headers.get('x-slack-request-timestamp') ?? ''
  const signature = req.headers.get('x-slack-signature') ?? ''

  if (!verifySlackSignature(rawBody, timestamp, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const params = new URLSearchParams(rawBody)
  const command = params.get('command') ?? ''
  const text = params.get('text')?.trim() ?? ''
  const responseUrl = params.get('response_url') ?? ''
  const userId = params.get('user_id') ?? ''
  const userName = params.get('user_name') ?? ''

  // Return immediately — Slack requires <3s response
  // Process async and post back via response_url
  void handleCommand(command, text, responseUrl, userId, userName)

  // Instant ack
  const acks: Record<string, string> = {
    '/77brief':  '⏳ Przygotowuję brief...',
    '/77crm':    '⏳ Pytam CRM...',
    '/77status': '⏳ Sprawdzam system...',
    '/77radar':  '⏳ Ładuję Radar...',
    '/77task':   '⏳ Tworzę zadanie...',
    '/77media':  '⏳ Sprawdzam kanały...',
    '/77quote':  '⏳ Sprawdzam wyceny...',
  }
  return NextResponse.json({ response_type: 'ephemeral', text: acks[command] ?? '⏳ Przetwarzam...' })
}

async function handleCommand(command: string, text: string, responseUrl: string, userId: string, userName: string) {
  try {
    switch (command) {
      case '/77brief':  await cmdBrief(text, responseUrl, userName); break
      case '/77crm':    await cmdCrm(text, responseUrl, userName); break
      case '/77status': await cmdStatus(responseUrl); break
      case '/77radar':  await cmdRadar(responseUrl); break
      case '/77task':   await cmdTask(text, responseUrl, userName); break
      case '/77media':  await cmdMedia(responseUrl); break
      case '/77quote':  await cmdQuote(text, responseUrl); break
      default:
        await postToSlack(responseUrl, buildErrorBlock(`Nieznana komenda: ${command}`))
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await postToSlack(responseUrl, buildErrorBlock(`Błąd: ${msg}`))
  }
}

// ─── /77brief [nazwa klienta] ─────────────────────────────────────────────────
async function cmdBrief(clientQuery: string, responseUrl: string, userName: string) {
  const supabase = createSupabaseAdminClient()

  if (!clientQuery) {
    await postToSlack(responseUrl, buildErrorBlock('Użycie: `/77brief Avvlo` — podaj nazwę klienta'))
    return
  }

  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, owner_name, status, industry, notes')
    .ilike('name', `%${clientQuery}%`)
    .limit(3)

  if (!clients?.length) {
    await postToSlack(responseUrl, buildErrorBlock(`Klient "${clientQuery}" nie znaleziony w CRM`))
    return
  }

  const client = clients[0]

  // Fetch notes + tasks for context
  const [{ data: notes }, { data: tasks }, { data: audits }] = await Promise.all([
    supabase.from('client_notes').select('content, created_at').eq('client_id', client.id).order('created_at', { ascending: false }).limit(5),
    supabase.from('tasks').select('title, status, priority, due_date').eq('client_id', client.id).neq('status', 'done').limit(5),
    supabase.from('audits').select('score, created_at, recommendations').eq('client_id', client.id).order('created_at', { ascending: false }).limit(1),
  ])

  const context = [
    `Klient: ${client.name} (${client.owner_name ?? 'brak właściciela'}) [${client.status}]`,
    client.industry ? `Branża: ${client.industry}` : '',
    notes?.length ? `Ostatnie notatki:\n${notes.map(n => `- ${n.content}`).join('\n')}` : '',
    tasks?.length ? `Otwarte zadania:\n${tasks.map(t => `- [${t.priority}] ${t.title}`).join('\n')}` : '',
    audits?.length ? `Ostatni audyt: score ${audits[0].score}/100` : '',
  ].filter(Boolean).join('\n\n')

  const { text } = await callClaude({
    feature: 'slackBrief',
    model: AI_MODELS.balanced,
    system: `Jesteś asystentem spotkań dla 77STF. Tworzysz zwięzły brief na spotkanie z klientem.
Format odpowiedzi (używaj emoji, krótko i konkretnie, max 300 słów):
🎯 **Cel spotkania** — co chcemy osiągnąć
📊 **Status klienta** — gdzie jesteśmy
⚡ **Kluczowe tematy** — 3 najważniejsze punkty do omówienia
🚨 **Uwagi** — red flagi lub szanse
✅ **Następny krok** — co konkretnie proponujemy`,
    messages: [{ role: 'user', content: `Przygotuj brief na spotkanie z klientem:\n\n${context}` }],
    max_tokens: 600,
    client_id: client.id,
    triggered_by: 'user',
  })

  await postToSlack(responseUrl, buildBriefBlock(client.name, text, userName))
}

// ─── /77crm [zapytanie w natural language] ───────────────────────────────────
async function cmdCrm(query: string, responseUrl: string, userName: string) {
  const supabase = createSupabaseAdminClient()

  if (!query) {
    await postToSlack(responseUrl, buildErrorBlock('Użycie: `/77crm status Avvlo` lub `/77crm lista klientów`'))
    return
  }

  const { data: clients } = await supabase.from('clients').select('id, name, owner_name, status, industry').order('name')
  const { data: tasks } = await supabase.from('tasks').select('title, status, priority, client_id').neq('status', 'done').order('priority')

  const clientList = (clients ?? []).map(c => `- ${c.name} [${c.status}] id:${c.id}`).join('\n')
  const taskList = (tasks ?? []).slice(0, 20).map(t => `- [${t.priority}] ${t.title}`).join('\n')

  const { text } = await callClaude({
    feature: 'slackCrm',
    model: AI_MODELS.fast,
    system: `Jesteś asystentem CRM dla 77STF. Odpowiadasz na pytania o klientów i zadania.
Dane systemu:
Klienci:
${clientList || 'brak'}

Otwarte zadania:
${taskList || 'brak'}

Odpowiadaj krótko i konkretnie (max 150 słów). Używaj emoji. Jeśli pytanie dotyczy konkretnego klienta, daj konkretną odpowiedź.`,
    messages: [{ role: 'user', content: query }],
    max_tokens: 300,
    triggered_by: 'user',
  })

  await postToSlack(responseUrl, {
    response_type: 'in_channel',
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text: `🤖 *CRM — odpowiedź na: "${query}"*` } },
      { type: 'section', text: { type: 'mrkdwn', text } },
      { type: 'context', elements: [{ type: 'mrkdwn', text: `Zapytał: @${userName}` }] },
    ],
  })
}

// ─── /77status ────────────────────────────────────────────────────────────────
async function cmdStatus(responseUrl: string) {
  const supabase = createSupabaseAdminClient()

  const startOfMonth = new Date()
  startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0)
  const budget = parseFloat(process.env.AI_MONTHLY_BUDGET_USD ?? '50')

  const [
    { count: clientCount },
    { count: taskCount },
    { count: msgCount },
    { data: recentErrors },
    { data: aiUsage },
  ] = await Promise.all([
    supabase.from('clients').select('*', { count: 'exact', head: true }),
    supabase.from('tasks').select('*', { count: 'exact', head: true }).neq('status', 'done'),
    supabase.from('telegram_messages').select('*', { count: 'exact', head: true }).gte('sent_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
    supabase.from('error_log').select('source, created_at').order('created_at', { ascending: false }).limit(3),
    supabase.from('ai_usage_log').select('cost_usd').gte('created_at', startOfMonth.toISOString()),
  ])

  const aiCostUsd = (aiUsage ?? []).reduce((s, r) => s + (r.cost_usd ?? 0), 0)
  const aiPct = budget > 0 ? Math.round((aiCostUsd / budget) * 100) : 0

  await postToSlack(responseUrl, buildStatusBlock({
    clients: clientCount ?? 0,
    openTasks: taskCount ?? 0,
    telegramToday: msgCount ?? 0,
    errors: recentErrors ?? [],
    aiCostPct: aiPct,
  }))
}

// ─── /77radar ─────────────────────────────────────────────────────────────────
async function cmdRadar(responseUrl: string) {
  const supabase = createSupabaseAdminClient()

  const { data: digest } = await supabase
    .from('intelligence_digests')
    .select('items, created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!digest?.items) {
    await postToSlack(responseUrl, buildErrorBlock('Brak danych Radar. Uruchom skan w Intelligence Hub.'))
    return
  }

  type RadarItem = { title: string; score: number; category: string; reason: string; url?: string }
  const items = (digest.items as RadarItem[]).slice(0, 5)
  const lines = items.map(i => `*${i.score}/10* ${i.category ? `[${i.category}]` : ''} ${i.title}\n_${i.reason}_`)

  await postToSlack(responseUrl, {
    response_type: 'in_channel',
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: '📡 Radar — Top 5 News' } },
      ...lines.map(line => ({ type: 'section', text: { type: 'mrkdwn', text: line } })),
      { type: 'context', elements: [{ type: 'mrkdwn', text: `Aktualizacja: ${new Date(digest.created_at).toLocaleString('pl')}` }] },
    ],
  })
}

// ─── /77task [tytuł] dla [klient] ────────────────────────────────────────────
async function cmdTask(text: string, responseUrl: string, userName: string) {
  if (!text) {
    await postToSlack(responseUrl, buildErrorBlock('Użycie: `/77task Zadzwoń do Avvlo w sprawie oferty`'))
    return
  }

  const supabase = createSupabaseAdminClient()

  // Extract client name from text with AI
  const { data: clients } = await supabase.from('clients').select('id, name').order('name')
  const clientList = (clients ?? []).map(c => `${c.name} id:${c.id}`).join(', ')

  const { text: aiResp } = await callClaude({
    feature: 'slackTask',
    model: AI_MODELS.fast,
    system: `Wyciągnij z tekstu dane zadania. Odpowiedź TYLKO JSON:
{"title": "tytuł zadania", "client_id": "uuid lub null", "priority": "low|medium|high", "due_hint": "kiedy lub null"}
Klienci: ${clientList}`,
    messages: [{ role: 'user', content: text }],
    max_tokens: 120,
    triggered_by: 'user',
  })

  let parsed: { title?: string; client_id?: string; priority?: string } = {}
  try { parsed = JSON.parse(aiResp) } catch { /* use defaults */ }

  const { error } = await supabase.from('tasks').insert({
    title: parsed.title ?? text,
    client_id: parsed.client_id ?? null,
    priority: parsed.priority ?? 'medium',
    status: 'todo',
    description: `Dodano przez Slack przez @${userName}`,
  })

  if (error) {
    await postToSlack(responseUrl, buildErrorBlock('Błąd zapisu zadania'))
    return
  }

  await postToSlack(responseUrl, {
    response_type: 'in_channel',
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text: `✅ *Zadanie dodane*\n📋 ${parsed.title ?? text}\nPriorytet: ${parsed.priority ?? 'medium'} · Dodał: @${userName}` } },
    ],
  })
}

// ─── /77quote [klient] — Status wycen ────────────────────────────────────────
async function cmdQuote(clientQuery: string, responseUrl: string) {
  const supabase = createSupabaseAdminClient()

  let query = supabase
    .from('quotes')
    .select('id, title, status, updated_at, clients(name)')
    .in('status', ['sent', 'draft'])
    .order('updated_at', { ascending: true })
    .limit(10)

  if (clientQuery) {
    const { data: found } = await supabase
      .from('clients')
      .select('id')
      .ilike('name', `%${clientQuery}%`)
      .limit(1)
    if (found?.[0]) {
      query = query.eq('client_id', found[0].id)
    }
  }

  const { data: quotes } = await query

  if (!quotes?.length) {
    await postToSlack(responseUrl, buildErrorBlock(
      clientQuery ? `Brak wycen dla "${clientQuery}"` : 'Brak aktywnych wycen (sent/draft)'
    ))
    return
  }

  const now = Date.now()
  const lines = quotes.map(q => {
    const days = Math.floor((now - new Date(q.updated_at).getTime()) / (1000 * 60 * 60 * 24))
    const client = (q.clients as { name?: string } | null)?.name ?? '—'
    const icon = q.status === 'sent' ? (days >= 14 ? '🔴' : days >= 7 ? '⚠️' : '📤') : '📝'
    return `${icon} *${q.title}* — ${client} — ${days}d [${q.status}]`
  })

  await postToSlack(responseUrl, {
    response_type: 'in_channel',
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: `💰 Wyceny${clientQuery ? ` — ${clientQuery}` : ''} (${quotes.length})` } },
      { type: 'section', text: { type: 'mrkdwn', text: lines.join('\n') } },
      { type: 'context', elements: [{ type: 'mrkdwn', text: '🔴 ≥14 dni · ⚠️ ≥7 dni · 📤 sent · 📝 draft' }] },
    ],
  })
}

// ─── /77media — Telegram stats dla 77STF Media ───────────────────────────────
async function cmdMedia(responseUrl: string) {
  const supabase = createSupabaseAdminClient()

  const { data: msgs } = await supabase
    .from('telegram_messages')
    .select('channel_name, ai_flag, ai_score, sent_at')
    .gte('sent_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('sent_at', { ascending: false })

  const total = msgs?.length ?? 0
  const urgent = msgs?.filter(m => m.ai_flag === 'urgent').length ?? 0
  const opportunities = msgs?.filter(m => m.ai_flag === 'opportunity').length ?? 0

  const byChannel: Record<string, number> = {}
  msgs?.forEach(m => { byChannel[m.channel_name] = (byChannel[m.channel_name] ?? 0) + 1 })
  const topChannels = Object.entries(byChannel).sort((a, b) => b[1] - a[1]).slice(0, 5)

  await postToSlack(responseUrl, {
    response_type: 'in_channel',
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: '📊 77STF Media — Telegram 24h' } },
      { type: 'section', fields: [
        { type: 'mrkdwn', text: `*Wiadomości:*\n${total}` },
        { type: 'mrkdwn', text: `*🔴 Pilne:*\n${urgent}` },
        { type: 'mrkdwn', text: `*🟢 Szanse:*\n${opportunities}` },
        { type: 'mrkdwn', text: `*Kanały aktywne:*\n${Object.keys(byChannel).length}` },
      ]},
      ...(topChannels.length > 0 ? [{
        type: 'section',
        text: { type: 'mrkdwn', text: `*Top kanały:*\n${topChannels.map(([ch, n]) => `• ${ch}: ${n}`).join('\n')}` },
      }] : []),
    ],
  })
}
