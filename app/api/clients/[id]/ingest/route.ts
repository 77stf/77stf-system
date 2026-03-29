import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'
import { getModel } from '@/lib/ai-config'

interface RouteContext { params: Promise<{ id: string }> }

// POST /api/clients/[id]/ingest
// Body: { raw_text: string, source?: string }
// Accepts any unstructured text: transcript, WhatsApp export, email, voice notes,
// LinkedIn notes, your own stream-of-consciousness — and fills in all the right fields.
export async function POST(req: NextRequest, { params }: RouteContext) {
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  let body: { raw_text?: string; source?: string }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const raw = body.raw_text?.trim()
  if (!raw) return NextResponse.json({ error: 'raw_text jest wymagany' }, { status: 400 })

  const supabase = createSupabaseAdminClient()

  const { data: client } = await supabase
    .from('clients')
    .select('id, name, industry, status, notes')
    .eq('id', id)
    .single()

  if (!client) return NextResponse.json({ error: 'Klient nie istnieje' }, { status: 404 })

  const prompt = `Przeanalizuj poniższy tekst dotyczący klienta "${client.name}" (branża: ${client.industry ?? 'nieznana'}) i wyciągnij wszystkie użyteczne informacje.

Tekst może być: transkryptem spotkania, rozmowy, wiadomościami WhatsApp/Slack, emailami, notatkami głosowymi, obserwacjami z LinkedIn/Instagrama, lub czymkolwiek innym.

TEKST DO ANALIZY:
${raw}

Wygeneruj WYŁĄCZNIE JSON bez markdown, bez backticks:
{
  "client_updates": {
    "notes": "zaktualizowane notatki o kliencie (max 3 zdania, najważniejsze fakty)",
    "owner_name": "imię i nazwisko właściciela/CEO jeśli znalezione (lub null)",
    "owner_email": "email jeśli znaleziony (lub null)",
    "owner_phone": "telefon jeśli znaleziony (lub null)",
    "industry": "branża jeśli pojawia się lub doprecyzowana (lub null)",
    "size": "liczba pracowników jeśli wspomniana (lub null)"
  },
  "notes_to_add": [
    {
      "content": "konkretna, zwięzła notatka (jedno zdanie lub dwa)",
      "source": "manual|meeting|call|research|instagram|linkedin",
      "importance": "high|medium|low",
      "tags": ["tag1", "tag2"]
    }
  ],
  "tasks_to_create": [
    {
      "title": "konkretne zadanie które wynika z tekstu",
      "priority": "high|medium|low",
      "due_days": 7
    }
  ],
  "meeting_summary": {
    "create": true,
    "date": "YYYY-MM-DD lub null jeśli brak",
    "summary_ai": "2-3 zdania podsumowania rozmowy",
    "decisions": ["lista podjętych decyzji"],
    "promises_us": [{"text": "obietnica 77STF", "deadline": "YYYY-MM-DD lub null"}],
    "promises_client": [{"text": "obietnica klienta", "deadline": "YYYY-MM-DD lub null"}],
    "pain_points": ["lista bólów klienta"],
    "red_flags": ["lista czerwonych flag"],
    "tasks": [{"text": "zadanie", "assignee": "77STF|klient", "deadline": "YYYY-MM-DD lub null"}]
  },
  "summary": "1-2 zdania — co się dowiedziałeś z tego tekstu, co jest najważniejsze"
}

Zasady:
- notes_to_add: wyciągnij KAŻDĄ użyteczną informację jako osobną notatkę (potrzeby, bóle, plany, relacje, konteksty)
- tasks_to_create: tylko zadania które NAPRAWDĘ wynikają z tekstu
- meeting_summary.create: true tylko jeśli tekst wygląda jak transkrypt/notatka ze spotkania lub rozmowy
- Nie wymyślaj informacji — tylko to co jest w tekście
- Jeśli pole nie dotyczy tekstu — pomiń je lub daj null/[]`

  // Mock if no API key
  if (!process.env.ANTHROPIC_API_KEY) {
    const mock = buildMock(raw, body.source)
    const result = await applyIngestResult(supabase, id, client, mock)
    return NextResponse.json({ ...result, is_mock: true })
  }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 0, timeout: 30_000 })
    const response = await anthropic.messages.create({
      model: getModel('noteIngestion'),
      max_tokens: 2000,
      system: 'Jesteś asystentem CRM dla agencji AI. Analizujesz teksty i wyciągasz ustrukturyzowane dane o klientach. Odpowiadaj WYŁĄCZNIE w JSON.',
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    let parsed: IngestResult
    try {
      parsed = JSON.parse(text) as IngestResult
    } catch {
      const match = text.match(/\{[\s\S]*\}/)
      if (match) parsed = JSON.parse(match[0]) as IngestResult
      else return NextResponse.json({ error: 'Błąd parsowania odpowiedzi AI' }, { status: 500 })
    }

    const result = await applyIngestResult(supabase, id, client, parsed)
    return NextResponse.json({ ...result, model: getModel('noteIngestion') })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Nieznany błąd'
    await supabase.from('error_log').insert({
      source: 'api/clients/ingest',
      message,
      metadata: { client_id: id },
    })
    return NextResponse.json({ error: 'Błąd AI. Spróbuj ponownie.' }, { status: 500 })
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface IngestNote {
  content: string
  source: string
  importance: string
  tags?: string[]
}

interface IngestTask {
  title: string
  priority: string
  due_days?: number
}

interface IngestMeeting {
  create: boolean
  date?: string | null
  summary_ai?: string
  decisions?: string[]
  promises_us?: { text: string; deadline?: string | null }[]
  promises_client?: { text: string; deadline?: string | null }[]
  pain_points?: string[]
  red_flags?: string[]
  tasks?: { text: string; assignee: string; deadline?: string | null }[]
}

interface IngestResult {
  client_updates?: Record<string, string | null>
  notes_to_add?: IngestNote[]
  tasks_to_create?: IngestTask[]
  meeting_summary?: IngestMeeting
  summary?: string
}

// ─── Apply result to DB ───────────────────────────────────────────────────────

async function applyIngestResult(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  clientId: string,
  client: { id: string; name: string },
  parsed: IngestResult
) {
  const now = new Date()
  const operations: string[] = []

  // 1. Update client fields
  if (parsed.client_updates) {
    const allowed = ['notes', 'owner_name', 'owner_email', 'owner_phone', 'industry', 'size']
    const update: Record<string, string> = {}
    for (const key of allowed) {
      const val = parsed.client_updates[key]
      if (val && typeof val === 'string' && val.trim()) update[key] = val.trim()
    }
    if (Object.keys(update).length > 0) {
      await supabase.from('clients').update(update).eq('id', clientId)
      operations.push(`Zaktualizowano profil klienta (${Object.keys(update).join(', ')})`)
    }
  }

  // 2. Add notes
  if (parsed.notes_to_add && parsed.notes_to_add.length > 0) {
    const rows = parsed.notes_to_add.map(n => ({
      client_id: clientId,
      content: n.content,
      source: n.source ?? 'manual',
      importance: n.importance ?? 'medium',
      tags: n.tags ?? [],
      created_by: 'ai_ingest',
    }))
    await supabase.from('client_notes').insert(rows)
    operations.push(`Dodano ${rows.length} notatek`)
  }

  // 3. Create tasks
  if (parsed.tasks_to_create && parsed.tasks_to_create.length > 0) {
    const rows = parsed.tasks_to_create.map(task => ({
      client_id: clientId,
      title: task.title,
      priority: task.priority ?? 'medium',
      status: 'todo',
      due_date: new Date(now.getTime() + ((task.due_days ?? 7) * 86400000)).toISOString().split('T')[0],
    }))
    await supabase.from('tasks').insert(rows)
    operations.push(`Dodano ${rows.length} zadań`)
  }

  // 4. Create meeting record if it looks like a meeting transcript
  if (parsed.meeting_summary?.create) {
    const m = parsed.meeting_summary
    await supabase.from('meetings').insert({
      client_id: clientId,
      date: m.date ?? now.toISOString().split('T')[0],
      summary_ai: m.summary_ai ?? '',
      decisions: m.decisions ?? [],
      promises_us: m.promises_us ?? [],
      promises_client: m.promises_client ?? [],
      pain_points: m.pain_points ?? [],
      red_flags: m.red_flags ?? [],
      tasks: m.tasks ?? [],
    })
    operations.push('Dodano rekord spotkania')
  }

  return {
    ok: true,
    summary: parsed.summary ?? '',
    operations,
    notes_added: parsed.notes_to_add?.length ?? 0,
    tasks_created: parsed.tasks_to_create?.length ?? 0,
    meeting_created: parsed.meeting_summary?.create ?? false,
  }
}

function buildMock(raw: string, source?: string): IngestResult {
  return {
    client_updates: {},
    notes_to_add: [
      { content: `Notatka z ingestion: "${raw.slice(0, 120)}..."`, source: source ?? 'manual', importance: 'medium', tags: ['ingest'] },
    ],
    tasks_to_create: [],
    meeting_summary: { create: false },
    summary: 'Brak klucza API — tryb demo. Notatka zapisana ręcznie.',
  }
}
