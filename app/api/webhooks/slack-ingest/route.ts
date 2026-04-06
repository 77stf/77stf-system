import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase'
import { callClaude } from '@/lib/claude'
import { AI_MODELS } from '@/lib/ai-config'
import { SlackIngestSchema } from '@/lib/validation'

// POST /api/webhooks/slack-ingest
// Called by n8n when a message is posted in #quick-notes Slack channel
// Parses free-form text → CRM actions (note + task + optional calendar hint)
export async function POST(req: Request) {
  // Validate webhook secret
  const secret = req.headers.get('x-webhook-secret')
  if (!secret || secret !== process.env.N8N_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = SlackIngestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.issues }, { status: 400 })
  }

  const { text, channel } = parsed.data
  const supabase = createSupabaseAdminClient()

  // Fetch all clients for context (names only, to help AI identify who is mentioned)
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, owner_name, status')
    .order('name')

  const clientList = (clients ?? [])
    .map(c => `- ${c.name}${c.owner_name ? ` (${c.owner_name})` : ''} [${c.status}] id:${c.id}`)
    .join('\n')

  // Haiku parses the message → structured actions
  const systemPrompt = `Jesteś Personal Assistant dla firmy 77STF. Analizujesz wiadomości z Slacka i zamieniasz je na strukturalne akcje CRM.

Lista klientów w systemie:
${clientList || 'Brak klientów w systemie'}

Odpowiedz ZAWSZE w formacie JSON (bez markdown):
{
  "client_id": "uuid lub null jeśli nie rozpoznano klienta",
  "client_name": "nazwa rozpoznanego klienta lub null",
  "note": "treść notatki do zapisania (polskie zdanie opisujące sytuację)",
  "task": {
    "title": "tytuł zadania lub null jeśli brak zadania",
    "priority": "low|medium|high",
    "due_hint": "opis kiedy (np. 'środa 10:00', 'jutro', 'ten tydzień') lub null"
  } | null,
  "calendar_hint": {
    "title": "tytuł wydarzenia lub null",
    "when_hint": "kiedy (np. 'środa 14:00', '2026-04-05') lub null",
    "with_whom": "z kim (imię/firma) lub null"
  } | null,
  "summary": "jedno zdanie podsumowania co zalogowano"
}

Zasady:
- Zawsze zapisuj notatkę (nawet jeśli to tylko przypomnienie)
- Zadanie tylko jeśli wiadomość sugeruje akcję do wykonania
- calendar_hint tylko jeśli jest konkretna data/godzina spotkania
- Jeśli klient nie jest rozpoznany → client_id: null (może to nowy lead)
- due_hint to hint dla człowieka — nie próbuj parsować daty ISO`

  const { text: aiResponse } = await callClaude({
    feature: 'slackIngest',
    model: AI_MODELS.fast,
    system: systemPrompt,
    messages: [{ role: 'user', content: `Wiadomość ze Slacka (kanał: ${channel ?? '#quick-notes'}):\n\n${text}` }],
    max_tokens: 512,
    triggered_by: 'webhook',
  })

  let actions: Record<string, unknown>
  try {
    actions = JSON.parse(aiResponse) as Record<string, unknown>
  } catch {
    // If parse fails, save as raw note
    actions = {
      client_id: null,
      note: text,
      task: null,
      calendar_hint: null,
      summary: 'Zapisano jako notatka bez parsowania',
    }
  }

  const results: string[] = []
  const errors: string[] = []

  // 1. Save note (always)
  if (actions.note && typeof actions.note === 'string') {
    const notePayload: Record<string, unknown> = {
      content: actions.note,
      source: 'slack',
      importance: 'medium',
    }
    if (actions.client_id) notePayload.client_id = actions.client_id

    // If no client, store as a general note in first available client or skip
    if (actions.client_id) {
      const { error } = await supabase.from('client_notes').insert({
        client_id: actions.client_id as string,
        content: actions.note,
        source: 'slack',
        importance: 'medium',
      })
      if (error) {
        errors.push(`Note save failed: ${error.message}`)
        await supabase.from('error_log').insert({ source: 'api/webhooks/slack-ingest', message: error.message, metadata: { note: actions.note } })
      } else {
        results.push(`✓ Notatka zapisana dla ${actions.client_name ?? actions.client_id}`)
      }
    } else {
      // Unknown client — log as error event so we can review
      await supabase.from('error_log').insert({
        source: 'api/webhooks/slack-ingest',
        message: 'Nie rozpoznano klienta — notatka nie zapisana',
        metadata: { text, note: actions.note, ai_response: aiResponse },
      })
      results.push(`⚠️ Klient nierozpoznany — notatka wymaga ręcznego przypisania`)
    }
  }

  // 2. Create task (if detected)
  const task = actions.task as Record<string, unknown> | null | undefined
  if (task && task.title && actions.client_id) {
    const { error } = await supabase.from('tasks').insert({
      title: task.title as string,
      client_id: actions.client_id as string,
      priority: (task.priority as string) ?? 'medium',
      status: 'todo',
      description: `Utworzone ze Slacka: ${text}${task.due_hint ? `\nTermin: ${task.due_hint}` : ''}`,
    })
    if (error) {
      errors.push(`Task save failed: ${error.message}`)
    } else {
      results.push(`✓ Zadanie: "${task.title}"${task.due_hint ? ` (${task.due_hint})` : ''}`)
    }
  }

  // 3. Calendar hint — return for n8n to handle via Google Calendar MCP
  const calendarHint = actions.calendar_hint as Record<string, unknown> | null | undefined
  const calendarData = calendarHint?.title ? {
    title: calendarHint.title,
    when_hint: calendarHint.when_hint,
    with_whom: calendarHint.with_whom,
    client_id: actions.client_id,
    client_name: actions.client_name,
  } : null

  return NextResponse.json({
    ok: true,
    summary: actions.summary ?? 'Zalogowano',
    results,
    errors,
    calendar_hint: calendarData,
    client_id: actions.client_id ?? null,
    raw_text: text,
  })
}
