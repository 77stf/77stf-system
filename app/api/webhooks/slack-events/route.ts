import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase'
import { callClaude } from '@/lib/claude'
import { AI_MODELS } from '@/lib/ai-config'
import { verifySlackSignature, buildConfirmationBlock, sendSlackBlocks } from '@/lib/slack'

// POST /api/webhooks/slack-events
// Slack Events API — receives messages from subscribed channels
// Setup: https://api.slack.com/apps → Event Subscriptions → Request URL: /api/webhooks/slack-events
// Subscribe to: message.channels (for public channels), message.im (for DMs to bot)

export async function POST(req: Request) {
  const rawBody = await req.text()

  // Verify Slack signature
  const timestamp = req.headers.get('x-slack-request-timestamp') ?? ''
  const signature = req.headers.get('x-slack-signature') ?? ''

  if (!verifySlackSignature(rawBody, timestamp, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let event: Record<string, unknown>
  try {
    event = JSON.parse(rawBody) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Slack URL verification challenge (one-time setup)
  if (event.type === 'url_verification') {
    return NextResponse.json({ challenge: event.challenge })
  }

  if (event.type !== 'event_callback') {
    return NextResponse.json({ ok: true })
  }

  const inner = event.event as Record<string, unknown> | undefined
  if (!inner) return NextResponse.json({ ok: true })

  // Ignore bot messages, edited messages, file shares
  if (inner.bot_id || inner.subtype || inner.type !== 'message') {
    return NextResponse.json({ ok: true })
  }

  const text = (inner.text as string | undefined)?.trim()
  const channel = inner.channel as string | undefined
  const userId = inner.user as string | undefined

  if (!text || text.length < 3) return NextResponse.json({ ok: true })

  // Only process messages from configured channels
  const allowedChannels = (process.env.SLACK_CHANNELS ?? '').split(',').map(c => c.trim()).filter(Boolean)
  if (allowedChannels.length > 0 && channel && !allowedChannels.includes(channel)) {
    return NextResponse.json({ ok: true })
  }

  // Process async — Slack expects 200 within 3 seconds
  void processSlackMessage(text, channel, userId)

  return NextResponse.json({ ok: true })
}

async function processSlackMessage(text: string, channel?: string, userId?: string) {
  const supabase = createSupabaseAdminClient()

  // Fetch clients for context
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, owner_name, status')
    .order('name')

  const clientList = (clients ?? [])
    .map(c => `- ${c.name}${c.owner_name ? ` (${c.owner_name})` : ''} [${c.status}] id:${c.id}`)
    .join('\n')

  const systemPrompt = `Jesteś Personal Assistant dla firmy 77STF. Analizujesz wiadomości ze Slacka i zamieniasz je na akcje CRM.

Lista klientów:
${clientList || 'Brak klientów'}

Odpowiedź WYŁĄCZNIE w JSON:
{
  "client_id": "uuid lub null",
  "client_name": "nazwa lub null",
  "note": "treść notatki do zapisania",
  "task": { "title": "tytuł", "priority": "low|medium|high", "due_hint": "kiedy lub null" } | null,
  "calendar_hint": { "title": "tytuł eventu", "when_hint": "kiedy", "with_whom": "z kim" } | null,
  "summary": "jedno zdanie co zalogowano",
  "skip": false
}

Ustaw skip:true tylko jeśli wiadomość to spam/reakcja emoji/przypadkowa treść bez biznesowego kontekstu.`

  const { text: aiResponse } = await callClaude({
    feature: 'slackIngest',
    model: AI_MODELS.fast,
    system: systemPrompt,
    messages: [{ role: 'user', content: `Slack [${channel ?? 'dm'}]: ${text}` }],
    max_tokens: 512,
    triggered_by: 'webhook',
  })

  let actions: Record<string, unknown>
  try {
    actions = JSON.parse(aiResponse) as Record<string, unknown>
  } catch {
    actions = { note: text, summary: 'Zapisano jako surową notatkę', skip: false }
  }

  if (actions.skip === true) return

  const results: string[] = []

  // Save note
  if (actions.note && actions.client_id) {
    const { error } = await supabase.from('client_notes').insert({
      client_id: actions.client_id as string,
      content: actions.note as string,
      source: 'slack',
      importance: 'medium',
    })
    if (!error) results.push(`✓ Notatka → ${actions.client_name ?? actions.client_id}`)
    else {
      await supabase.from('error_log').insert({ source: 'webhooks/slack-events', message: error.message, metadata: { text } })
    }
  } else if (actions.note && !actions.client_id) {
    // Unknown client — save to error log for manual review
    await supabase.from('error_log').insert({
      source: 'webhooks/slack-events',
      message: 'Nierozpoznany klient w wiadomości Slack',
      metadata: { text, note: actions.note, ai_summary: actions.summary },
    })
    results.push(`⚠️ Klient nierozpoznany — sprawdź Error Log`)
  }

  // Create task
  const task = actions.task as Record<string, unknown> | null | undefined
  if (task?.title && actions.client_id) {
    await supabase.from('tasks').insert({
      title: task.title as string,
      client_id: actions.client_id as string,
      priority: (task.priority as string) ?? 'medium',
      status: 'todo',
      description: `Ze Slacka: ${text}${task.due_hint ? `\nTermin: ${task.due_hint}` : ''}`,
    })
    results.push(`✓ Zadanie: "${task.title}"`)
  }

  // Send confirmation back to Slack
  const summary = actions.summary as string ?? 'Zalogowano'
  if (results.length > 0) {
    const payload = buildConfirmationBlock(summary, results)
    await sendSlackBlocks(payload.blocks, 'crm')
  }
}
