import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'
import { getModel } from '@/lib/ai-config'
import { AUDIT_CATEGORIES, QUESTION_BY_ID } from '@/lib/audit-questions'

interface RouteContext { params: Promise<{ id: string }> }

// POST /api/audits/[id]/analyze — run Claude analysis and store results
export async function POST(_req: NextRequest, { params }: RouteContext) {
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createSupabaseAdminClient()

  // Mark as analyzing immediately
  await supabase.from('audits').update({ status: 'analyzing' }).eq('id', id)

  // Fetch audit + client + recent meetings in parallel
  const [{ data: audit }, { data: meetings }] = await Promise.all([
    supabase
      .from('audits')
      .select('*, client:clients(id, name, industry, size, status)')
      .eq('id', id)
      .single(),
    supabase
      .from('meetings')
      .select('date, summary_ai, decisions')
      .order('date', { ascending: false })
      .limit(3),
  ])

  if (!audit) {
    return NextResponse.json({ error: 'Audyt nie istnieje' }, { status: 404 })
  }

  // Build the answers section of the prompt
  const answers = (audit.answers ?? {}) as Record<string, string>
  const answersText = AUDIT_CATEGORIES.map(cat => {
    const qLines = cat.questions.map(q => {
      const answer = answers[q.id]?.trim() || 'Brak odpowiedzi'
      return `P: ${q.question}\nO: ${answer}`
    }).join('\n\n')
    return `### ${cat.label}\n${qLines}`
  }).join('\n\n')

  const meetingsText = meetings && meetings.length > 0
    ? meetings.map(m => `- ${m.date}: ${m.summary_ai ?? 'brak podsumowania'}`).join('\n')
    : 'Brak historii spotkań.'

  const client = audit.client as { name: string; industry?: string; size?: string } | null

  const prompt = `Przeprowadź analizę audytu operacyjnego dla firmy: ${client?.name ?? 'Nieznana'}
Branża: ${client?.industry ?? 'nieznana'}
Liczba pracowników: ${client?.size ?? 'nieznana'}

## Odpowiedzi właściciela/CEO:

${answersText}

## Historia spotkań:
${meetingsText}

Wygeneruj kompletną analizę w JSON. Odpowiadaj WYŁĄCZNIE w JSON bez markdown, bez backticks.
{
  "summary": "2-3 zdania executive summary — stan cyfryzacji, największa szansa",
  "overall_score": 0-100,
  "scores": {
    "procesy": 0-100,
    "technologia": 0-100,
    "sprzedaz": 0-100,
    "obsluga": 0-100,
    "dane": 0-100
  },
  "findings": [
    {
      "category": "procesy|technologia|sprzedaz|obsluga|dane",
      "finding": "konkretna obserwacja z odpowiedzi CEO",
      "severity": "high|medium|low",
      "recommendation": "co 77STF może z tym zrobić"
    }
  ],
  "quote_items": [
    {
      "name": "nazwa usługi",
      "description": "krótki opis zakresu",
      "category": "setup|monthly|onetime",
      "price": 0,
      "priority": 1
    }
  ],
  "tasks": [
    {
      "title": "Zadanie follow-up",
      "priority": "high|medium|low",
      "due_days": 7
    }
  ]
}

Zasady scoringu: 0-30 = krytyczne braki (szansa!), 31-60 = częściowe wdrożenia, 61-80 = dobre podstawy, 81-100 = zaawansowany.
Cennik: setup 4000-25000 PLN, monthly 800-3500 PLN. Proponuj 3-6 pozycji dopasowanych do odpowiedzi. Priority 1 = najważniejsze.
Zaproponuj 4-5 zadań follow-up z konkretnym tytułem.`

  // Return mock if no API key
  if (!process.env.ANTHROPIC_API_KEY) {
    const mock = buildMockResult(client?.name ?? 'Klient')
    await storeResults(supabase, id, mock)
    await createAutoTasks(supabase, id, audit.client_id, mock.tasks)
    const { data: updated } = await supabase
      .from('audits')
      .select('*, client:clients(id, name, industry, status)')
      .eq('id', id)
      .single()
    return NextResponse.json({ audit: updated, is_mock: true })
  }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 0, timeout: 45_000 })
    const response = await anthropic.messages.create({
      model: getModel('auditAnalysis'),
      max_tokens: 3000,
      system: 'Jesteś ekspertem ds. transformacji cyfrowej dla polskich firm MŚP. Firma 77STF oferuje automatyzacje AI, asystentów głosowych, social media automation. Wyróżnik: integracja ze starymi ERP przez RPA, sklonowany głos AI. Cennik setup 4-25k PLN, miesięcznie 800-3500 PLN. Odpowiadaj WYŁĄCZNIE w JSON bez żadnego dodatkowego tekstu.',
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(text) as Record<string, unknown>
    } catch {
      const match = text.match(/\{[\s\S]*\}/)
      if (match) {
        parsed = JSON.parse(match[0]) as Record<string, unknown>
      } else {
        await supabase.from('audits').update({ status: 'in_progress' }).eq('id', id)
        return NextResponse.json({ error: 'Nie udało się sparsować odpowiedzi AI. Spróbuj ponownie.' }, { status: 500 })
      }
    }

    await storeResults(supabase, id, parsed)
    await createAutoTasks(supabase, id, audit.client_id, parsed.tasks as TaskItem[] | undefined)

    const { data: updated } = await supabase
      .from('audits')
      .select('*, client:clients(id, name, industry, status)')
      .eq('id', id)
      .single()

    return NextResponse.json({ audit: updated, model: getModel('auditAnalysis') })
  } catch (err: unknown) {
    // Revert status on error
    await supabase.from('audits').update({ status: 'in_progress' }).eq('id', id)
    const message = err instanceof Error ? err.message : 'Nieznany błąd'
    await supabase.from('error_log').insert({
      source: 'api/audits/analyze',
      message,
      metadata: { audit_id: id },
    })
    return NextResponse.json({ error: 'Błąd analizy AI. Spróbuj ponownie.' }, { status: 500 })
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface TaskItem { title: string; priority?: string; due_days?: number }

async function storeResults(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  auditId: string,
  parsed: Record<string, unknown>
) {
  await supabase.from('audits').update({
    status: 'completed',
    score: parsed.overall_score ?? null,
    ai_summary: parsed.summary ?? null,
    findings: parsed.findings ?? [],
    recommendations: parsed.quote_items ?? [],
    completed_at: new Date().toISOString(),
  }).eq('id', auditId)
}

async function createAutoTasks(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  auditId: string,
  clientId: string,
  tasks?: TaskItem[]
) {
  const now = new Date()
  const rows = [
    // Always create these fixed tasks
    {
      client_id: clientId,
      title: `[Audyt] Wyślij wycenę po audycie`,
      priority: 'high',
      status: 'todo',
      due_date: new Date(now.getTime() + 3 * 86400000).toISOString().split('T')[0],
    },
    {
      client_id: clientId,
      title: `[Audyt] Follow-up po Audycie Operacyjnym`,
      priority: 'medium',
      status: 'todo',
      due_date: new Date(now.getTime() + 7 * 86400000).toISOString().split('T')[0],
    },
    // AI-suggested tasks
    ...(tasks ?? []).slice(0, 4).map(t => ({
      client_id: clientId,
      title: `[Audyt] ${t.title}`,
      priority: t.priority ?? 'medium',
      status: 'todo' as const,
      due_date: new Date(now.getTime() + (t.due_days ?? 7) * 86400000).toISOString().split('T')[0],
    })),
  ]
  await supabase.from('tasks').insert(rows)
}

function buildMockResult(clientName: string) {
  return {
    summary: `${clientName} to firma z dużym potencjałem automatyzacyjnym. Kluczowe szanse: integracja ERP przez RPA, automatyzacja follow-up sprzedażowego i asystent głosowy 24/7.`,
    overall_score: 38,
    scores: { procesy: 25, technologia: 40, sprzedaz: 45, obsluga: 35, dane: 30 },
    findings: [
      { category: 'procesy', finding: 'Wiele procesów wykonywanych ręcznie — duże straty czasu', severity: 'high', recommendation: 'Automatyzacja workflow przez n8n + RPA' },
      { category: 'technologia', finding: 'Systemy nie rozmawiają ze sobą', severity: 'high', recommendation: 'Integracja przez API lub RPA bez zmiany ERP' },
      { category: 'obsluga', finding: 'Brak obsługi klienta poza godzinami pracy', severity: 'medium', recommendation: 'Asystent głosowy AI na infolinie 24/7' },
      { category: 'sprzedaz', finding: 'Brak automatycznego follow-up z leadami', severity: 'medium', recommendation: 'Automatyzacja sekwencji mailowych i przypomnień' },
      { category: 'dane', finding: 'Raporty tworzone ręcznie, brak danych real-time', severity: 'medium', recommendation: 'Dashboard KPI z automatycznym zbieraniem danych' },
    ],
    quote_items: [
      { name: 'Automatyzacja procesów operacyjnych', description: 'Workflow n8n + integracja ERP przez RPA', category: 'setup', price: 8000, priority: 1 },
      { name: 'Asystent głosowy AI — infolinia 24/7', description: 'Vapi.ai + ElevenLabs sklonowany głos', category: 'setup', price: 5000, priority: 2 },
      { name: 'Pakiet opieki miesięcznej', description: 'Monitoring, aktualizacje, nowe automaty', category: 'monthly', price: 1500, priority: 3 },
    ],
    tasks: [
      { title: 'Przygotuj demo automatyzacji dla klienta', priority: 'high', due_days: 5 },
      { title: 'Zbadaj API systemu ERP klienta', priority: 'medium', due_days: 7 },
    ],
  }
}
