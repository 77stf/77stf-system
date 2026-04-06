import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase'
import { callClaude } from '@/lib/claude'
import { getModel } from '@/lib/ai-config'
import { AUDIT_CATEGORIES, QUESTION_BY_ID } from '@/lib/audit-questions'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import type { AuditContextData } from '@/lib/types'

interface RouteContext { params: Promise<{ id: string }> }

// POST /api/audits/[id]/analyze — run Claude analysis and store results
export async function POST(_req: NextRequest, { params }: RouteContext) {
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { limit, windowMs } = RATE_LIMITS.AI_ANALYZE
  if (!rateLimit(`analyze:${user.id}`, limit, windowMs)) {
    return NextResponse.json({ error: 'Za dużo zapytań. Odczekaj chwilę.' }, { status: 429 })
  }

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

  // Build answers text
  const answers = (audit.answers ?? {}) as Record<string, string>
  const answersText = AUDIT_CATEGORIES.map(cat => {
    const qLines = cat.questions.map(q => {
      const answer = answers[q.id]?.trim() || 'Brak odpowiedzi'
      return `P: ${q.question}\nO: ${answer}`
    }).join('\n\n')
    const consultantNote = cat.consultantOnly ? ' [NOTATKI KONSULTANTA]' : ''
    return `### ${cat.label}${consultantNote}\n${qLines}`
  }).join('\n\n')

  const meetingsText = meetings && meetings.length > 0
    ? meetings.map(m => `- ${m.date}: ${m.summary_ai ?? 'brak podsumowania'}`).join('\n')
    : 'Brak historii spotkań.'

  const client = audit.client as { name: string; industry?: string; size?: string } | null

  // Build financial context from context_data
  const ctx = (audit.context_data ?? {}) as AuditContextData
  const financialContext = buildFinancialContext(ctx)

  const prompt = `Jesteś ekspertem ds. transformacji cyfrowej polskich firm MŚP. Przeprowadź GŁĘBOKĄ analizę audytu dla: ${client?.name ?? 'Nieznana'}
Branża: ${client?.industry ?? 'nieznana'} | Pracownicy: ${client?.size ?? 'nieznana'}

${financialContext}

## Odpowiedzi właściciela/CEO:
${answersText}

## Historia spotkań:
${meetingsText}

## Kontekst 77STF — co oferujemy i w czym się specjalizujemy:
- RPA (PyAutoGUI + Playwright) — wchodzimy w stare systemy BEZ API (Subiekt GT, Comarch, SAP) — to nasz GŁÓWNY wyróżnik, inni tego nie robią
- Voice Agent AI (Vapi.ai + ElevenLabs) — sklonowany głos pracownika firmy, działa 24/7 bez zatrudniania
- Social Media Automation — codzienne propozycje postów + auto-publikacja po akceptacji
- AI Dashboard / CEO Reports — real-time KPI z wszystkich systemów naraz, na telefon
- Email/SMS Automation (n8n) — follow-up B2C, sekwencje powitalne, reaktywacja klientów
- RAG Chatbot (pgvector) — chatbot na własnych dokumentach z przypisami do źródeł
- Analiza Konkurencji (Apify + Claude) — automatyczny monitoring cen i oferty konkurencji
- Guardian Agent — proaktywnie skanuje rynek, alerty zanim klient zauważy problem

## INSTRUKCJA ANALIZY — TRZY FAZY:

FAZA 1 (_scratchpad): Napisz 4-5 zdań analizy PRZED generowaniem JSON:
- Jaka jest NAJWIĘKSZA szansa ROI dla tej firmy?
- Które procesy generują NAJWIĘKSZE straty (godziny × stawka z danych)?
- Co właściciel czuje jako najgorszy ból — nawet jeśli to nie jest największa szansa?
- Który produkt 77STF pasuje NAJLEPIEJ do tej firmy i dlaczego?
- Jaki budżet jest realny na podstawie kontekstu — i ile wdrożeń to obsłuży?

FAZA 2: Wygeneruj analizę. WYŁĄCZNIE JSON po scratchpadzie, bez backticks.

FAZA 3 (wbudowana w JSON): Dla każdego wdrożenia generuj 2-3 WARIANTY z różnymi kosztami i zakresem.

{
  "_scratchpad": "4-5 zdań analizy przed briefem",
  "summary": "3-4 zdania: stan cyfryzacji tej firmy, konkretne liczby PLN z odpowiedzi, największa szansa dla 77STF",
  "overall_score": 0,
  "scores": { "procesy": 0, "technologia": 0, "sprzedaz": 0, "obsluga": 0, "dane": 0 },
  "findings": [
    {
      "category": "procesy|technologia|sprzedaz|obsluga|dane",
      "finding": "konkretna obserwacja z CYTATEM lub LICZBĄ z odpowiedzi CEO",
      "severity": "high|medium|low",
      "annual_cost_pln": 0,
      "recommendation": "konkretna usługa 77STF + mechanizm + mierzalny efekt"
    }
  ],
  "implementations": [
    {
      "name": "nazwa wdrożenia",
      "priority": 1,
      "problem_solved": "1 zdanie — jaki konkretny ból rozwiązuje",
      "annual_roi_pln": 0,
      "roi_calculation": "skąd ta liczba — np. 200h/mies × 35 PLN/h × 12",
      "payback_months": 0,
      "pricing_rationale": "Setup X PLN = Y% rocznego ROI (Z PLN). Zwrot: X / (ROI/12) = N mies.",
      "variants": [
        {
          "name": "Wariant A — Podstawowy",
          "scope": "co dokładnie robimy w tym wariancie",
          "setup_pln": 0,
          "monthly_pln": 0,
          "timeline_weeks": 0,
          "what_you_get": ["konkretna funkcja 1", "konkretna funkcja 2"],
          "limitations": "czego NIE ma w tym wariancie"
        },
        {
          "name": "Wariant B — Pełny",
          "scope": "rozszerzony zakres",
          "setup_pln": 0,
          "monthly_pln": 0,
          "timeline_weeks": 0,
          "what_you_get": ["wszystko z A plus...", "dodatkowa funkcja"],
          "limitations": "czego NIE ma w tym wariancie"
        },
        {
          "name": "Wariant C — Enterprise",
          "scope": "pełny zakres z AI i integracjami",
          "setup_pln": 0,
          "monthly_pln": 0,
          "timeline_weeks": 0,
          "what_you_get": ["pełen zakres"],
          "limitations": null
        }
      ],
      "recommended_variant": "A|B|C",
      "recommendation_reason": "dlaczego ten wariant jest najlepszy dla tej firmy — odwołaj się do budżetu z kontekstu"
    }
  ],
  "ecosystem_roadmap": [
    {
      "phase": 1,
      "name": "Fundament (miesiąc 1-2)",
      "implementations": ["nazwa wdrożenia 1", "nazwa wdrożenia 2"],
      "rationale": "dlaczego od tego zaczynamy — najszybszy ROI lub eliminacja blokera"
    },
    {
      "phase": 2,
      "name": "Wzrost (miesiąc 3-6)",
      "implementations": ["nazwa wdrożenia 3"],
      "rationale": "co odblokuje faza 1"
    },
    {
      "phase": 3,
      "name": "Optymalizacja (miesiąc 7-12)",
      "implementations": ["nazwa wdrożenia 4"],
      "rationale": "long-term value"
    }
  ],
  "financial_summary": {
    "total_annual_waste_pln": 0,
    "total_addressable_roi_pln": 0,
    "recommended_budget_setup_pln": 0,
    "recommended_budget_monthly_pln": 0,
    "roi_multiple": 0,
    "payback_months_avg": 0
  },
  "quote_items": [
    {
      "name": "nazwa usługi (Wariant B)",
      "description": "zakres — co konkretnie robimy",
      "category": "setup|monthly|onetime",
      "price": 0,
      "priority": 1
    }
  ],
  "tasks": [
    { "title": "Zadanie follow-up", "priority": "high|medium|low", "due_days": 7 }
  ]
}

## ZASADY CENOWE (OBOWIĄZKOWE):
- Setup = 8–15% annual_roi_pln (nie przekraczaj 15% — klient musi widzieć szybki zwrot)
- Monthly = min 800 PLN + 2–4% annual_roi_pln / 12
- Wariant A setup = 40% ceny B | Wariant B = standard | Wariant C = 180% ceny B
- Wariant A monthly = 60% ceny B | Wariant C monthly = 150% ceny B
- payback_months = setup_pln_B / (annual_roi_pln / 12) — oblicz dla rekomendowanego wariantu
${ctx.budget_setup ? `- Budżet jednorazowy z kontekstu: ${ctx.budget_setup} — rekomenduj warianty mieszczące się w tym budżecie` : ''}
${ctx.budget_monthly ? `- Budżet miesięczny z kontekstu: ${ctx.budget_monthly} — uwzględnij w monthly_pln` : ''}

## ZASADY SCORINGU:
0–30 = krytyczne braki = SZANSA dla 77STF | 31–60 = częściowe | 61–80 = dobre podstawy | 81–100 = zaawansowany
Generuj 3–5 wdrożeń. financial_summary.total_annual_waste_pln = suma annual_cost_pln z findings.
financial_summary.roi_multiple = total_addressable_roi_pln / recommended_budget_setup_pln.`

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
    const { text } = await callClaude({
      feature: 'auditAnalysis',
      model: getModel('auditAnalysis'),
      system: 'Jesteś ekspertem ds. transformacji cyfrowej dla polskich firm MŚP. Firma 77STF oferuje automatyzacje AI, asystentów głosowych, social media automation. Wyróżnik: integracja ze starymi ERP przez RPA, sklonowany głos AI. Odpowiadaj WYŁĄCZNIE w JSON bez żadnego dodatkowego tekstu ani backticks.',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 8192,
      client_id: audit.client_id,
    })

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
    await supabase.from('audits').update({ status: 'in_progress' }).eq('id', id)
    return NextResponse.json({ error: 'Błąd analizy AI. Spróbuj ponownie.' }, { status: 500 })
  }
}

// ─── Build financial context string ──────────────────────────────────────────

function buildFinancialContext(ctx: AuditContextData): string {
  if (!ctx || Object.keys(ctx).length === 0) return ''

  const lines: string[] = ['## Profil finansowy klienta (dane od konsultanta):']

  if (ctx.revenue_range) lines.push(`- Przychód miesięczny: ${ctx.revenue_range} PLN`)

  const teamParts: string[] = []
  if (ctx.team_sales) teamParts.push(`${ctx.team_sales} FTE sprzedaż`)
  if (ctx.team_cs) teamParts.push(`${ctx.team_cs} FTE obsługa klienta`)
  if (ctx.team_ops) teamParts.push(`${ctx.team_ops} FTE operacje`)
  if (teamParts.length > 0) lines.push(`- Struktura zespołu: ${teamParts.join(', ')}`)

  if (ctx.hourly_cost_pln) {
    const totalFte = (ctx.team_sales ?? 0) + (ctx.team_cs ?? 0) + (ctx.team_ops ?? 0)
    lines.push(`- Koszt godzinowy brutto: ${ctx.hourly_cost_pln} PLN/h`)
    if (totalFte > 0) {
      const monthlyTeamCost = totalFte * ctx.hourly_cost_pln * 168 // ~168h/mies
      lines.push(`- Szacowany miesięczny koszt zespołu: ~${Math.round(monthlyTeamCost / 1000)}k PLN`)
    }
  }

  if (ctx.budget_setup) lines.push(`- Budżet wdrożeniowy (jednorazowo): ${ctx.budget_setup} PLN`)
  if (ctx.budget_monthly) lines.push(`- Budżet miesięczny (opieka): ${ctx.budget_monthly} PLN`)
  if (ctx.decision_maker) {
    const dm = ctx.decision_maker === 'owner' ? 'właściciel (decyduje sam)'
      : ctx.decision_maker === 'board' ? 'zarząd/wspólnicy'
      : 'inwestor zewnętrzny'
    lines.push(`- Decydent: ${dm}`)
  }
  if (ctx.timeline) {
    const tl = ctx.timeline === 'now' ? 'gotowi teraz'
      : ctx.timeline === '1-3m' ? 'za 1-3 miesiące'
      : 'jeszcze planują'
    lines.push(`- Gotowość wdrożeniowa: ${tl}`)
  }
  if (ctx.external_context) lines.push(`- Kontekst zewnętrzny: ${ctx.external_context}`)

  return lines.join('\n')
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
    implementations: parsed.implementations ?? [],
    financial_summary: parsed.financial_summary ?? {},
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
    summary: `${clientName} to firma z dużym potencjałem automatyzacyjnym. Kluczowe szanse: integracja ERP przez RPA (ROI ~96k PLN/rok), asystent głosowy 24/7 (ROI ~65k PLN/rok) i CEO Dashboard (ROI ~24k PLN/rok). Łączny adresowalny ROI: ~185k PLN/rok.`,
    overall_score: 28,
    scores: { procesy: 20, technologia: 30, sprzedaz: 35, obsluga: 25, dane: 20 },
    findings: [
      { category: 'procesy', finding: '200h/mies na ręczne przepisywanie danych × 35 PLN/h = 7 000 PLN/mies strat', severity: 'high', annual_cost_pln: 84000, recommendation: 'RPA (PyAutoGUI) integrujące ERP ze sklepem i Allegro — eliminacja 80% przepisywania' },
      { category: 'obsluga', finding: '~70 utraconych kontaktów weekendowych × 180 PLN koszyk = 65k PLN/rok', severity: 'high', annual_cost_pln: 65000, recommendation: 'Voice Agent AI (Vapi + ElevenLabs) — sklonowany głos, 24/7 bez zatrudniania' },
      { category: 'dane', finding: 'Raport miesięczny 5-7h z 4 źródeł — właściciel operuje na danych sprzed tygodnia', severity: 'medium', annual_cost_pln: 15000, recommendation: 'CEO Dashboard real-time — KPI z wszystkich systemów naraz, na telefon' },
    ],
    implementations: [
      {
        name: 'Automatyzacja RPA — integracja ERP',
        priority: 1,
        problem_solved: 'Eliminuje 200h/mies ręcznego przepisywania między Subiektem, WooCommerce i Allegro',
        annual_roi_pln: 96000,
        roi_calculation: '200h/mies × 40 PLN/h × 12 = 96 000 PLN/rok',
        payback_months: 1.5,
        pricing_rationale: 'Setup 12 000 PLN = 12.5% ROI (96k PLN). Zwrot: 12k / (96k/12) = 1.5 mies.',
        variants: [
          { name: 'Wariant A — Podstawowy', scope: 'Automatyzacja jednego przepływu (np. WooCommerce → Subiekt)', setup_pln: 4800, monthly_pln: 800, timeline_weeks: 3, what_you_get: ['Automatyzacja zamówień online → Subiekt', 'Raport dzienny'], limitations: 'Tylko jeden kanał, bez Allegro i B2B' },
          { name: 'Wariant B — Pełny', scope: 'Wszystkie kanały: WooCommerce + Allegro + email B2B → Subiekt + raporty', setup_pln: 12000, monthly_pln: 2000, timeline_weeks: 6, what_you_get: ['WooCommerce → Subiekt', 'Allegro → Subiekt', 'Email B2B → Subiekt', 'Raport tygodniowy auto'], limitations: 'Bez integracji reklamacji' },
          { name: 'Wariant C — Enterprise', scope: 'Pełna automatyzacja + reklamacje + stany + CEO Dashboard', setup_pln: 21600, monthly_pln: 3000, timeline_weeks: 10, what_you_get: ['Wszystko z B', 'Automatyzacja reklamacji', 'Real-time stany magazynowe', 'CEO Dashboard'], limitations: null },
        ],
        recommended_variant: 'B',
        recommendation_reason: 'Budżet 30-80k pozwala na Wariant B. Pełna automatyzacja 3 kanałów przy payback 1.5 mies. jest oczywistym wyborem.',
      },
      {
        name: 'Voice Agent AI — infolinia 24/7',
        priority: 2,
        problem_solved: 'Obsługuje wieczorne i weekendowe zapytania klientów bez zatrudniania dodatkowej osoby',
        annual_roi_pln: 65000,
        roi_calculation: '15 kontaktów/tydzień × 50% konwersja × 180 PLN × 52 tygodnie = 70 200 PLN',
        payback_months: 0.7,
        pricing_rationale: 'Setup 5 000 PLN = 7.7% ROI (65k PLN). Zwrot: 5k / (65k/12) = 0.9 mies.',
        variants: [
          { name: 'Wariant A — Podstawowy', scope: 'Voice agent z gotowym głosem + FAQ z 20 odpowiedziami', setup_pln: 2800, monthly_pln: 600, timeline_weeks: 2, what_you_get: ['Gotowy głos AI', 'Obsługa TOP 5 pytań', '24/7 dostępność'], limitations: 'Generyczny głos, bez klonowania głosu pracownika' },
          { name: 'Wariant B — Pełny', scope: 'Sklonowany głos pracownika + knowledge base 50 pytań + przekierowania', setup_pln: 7000, monthly_pln: 1200, timeline_weeks: 4, what_you_get: ['Sklonowany głos (nagranie 5 min)', '50 pytań FAQ', 'Przekierowania do żywej osoby', 'Statystyki połączeń'], limitations: 'Bez integracji z magazynem (dostępność produktu w real-time)' },
          { name: 'Wariant C — Enterprise', scope: 'Pełny agent z integracją z Subiektem — wie o stanach magazynowych', setup_pln: 12600, monthly_pln: 1800, timeline_weeks: 8, what_you_get: ['Wszystko z B', 'Integracja z Subiektem (stany)', 'Automatyczne tworzenie zamówień przez telefon'], limitations: null },
        ],
        recommended_variant: 'B',
        recommendation_reason: 'Klonowanie głosu to kluczowy differentiator — klienci nie wiedzą że rozmawiają z AI. Wariant B mieści się w budżecie i daje natychmiastowy ROI.',
      },
    ],
    ecosystem_roadmap: [
      { phase: 1, name: 'Fundament (mies. 1-2)', implementations: ['Automatyzacja RPA — integracja ERP', 'Voice Agent AI — infolinia 24/7'], rationale: 'Najwyższy ROI w najkrótszym czasie. Payback < 2 miesiące dla obydwu.' },
      { phase: 2, name: 'Wzrost (mies. 3-6)', implementations: ['CEO Dashboard real-time', 'Email Marketing Automation'], rationale: 'Gdy operacje działają automatycznie, właściciel może skupić się na decyzjach' },
      { phase: 3, name: 'Optymalizacja (mies. 7-12)', implementations: ['Analiza Konkurencji AI', 'Social Media Automation'], rationale: 'Skalowanie przychodów gdy fundament jest stabilny' },
    ],
    financial_summary: {
      total_annual_waste_pln: 164000,
      total_addressable_roi_pln: 161000,
      recommended_budget_setup_pln: 19000,
      recommended_budget_monthly_pln: 3200,
      roi_multiple: 8.5,
      payback_months_avg: 1.2,
    },
    quote_items: [
      { name: 'Automatyzacja RPA — integracja ERP (Wariant B)', description: 'WooCommerce + Allegro + email B2B → Subiekt + raporty auto', category: 'setup', price: 12000, priority: 1 },
      { name: 'Voice Agent AI (Wariant B)', description: 'Sklonowany głos + FAQ 50 pytań + przekierowania + statystyki', category: 'setup', price: 7000, priority: 2 },
      { name: 'Pakiet opieki miesięcznej', description: 'Monitoring, aktualizacje, nowe automaty, raportowanie', category: 'monthly', price: 3200, priority: 3 },
    ],
    tasks: [
      { title: 'Przygotuj demo RPA na Subiekt GT (bez API)', priority: 'high', due_days: 5 },
      { title: 'Nagraj próbny Voice Agent z gotowym głosem', priority: 'high', due_days: 7 },
    ],
  }
}
