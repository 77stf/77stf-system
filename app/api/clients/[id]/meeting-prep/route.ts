import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase'
import { callClaude } from '@/lib/claude'
import { getModel } from '@/lib/ai-config'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'

interface RouteContext {
  params: Promise<{ id: string }>
}

// GET /api/clients/[id]/meeting-prep — generate an AI meeting brief
export async function GET(_req: NextRequest, { params }: RouteContext) {
  // Auth check
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { limit, windowMs } = RATE_LIMITS.AI_BRIEF
  if (!rateLimit(`brief:${user.id}`, limit, windowMs)) {
    return NextResponse.json({ error: 'Za dużo zapytań. Odczekaj chwilę.' }, { status: 429 })
  }

  const { id } = await params
  const supabase = createSupabaseAdminClient()

  // Fetch all relevant client data in parallel
  const [
    { data: client },
    { data: notes },
    { data: meetings },
    { data: projects },
    { data: automations },
    { data: latestAudit },
  ] = await Promise.all([
    supabase
      .from('clients')
      .select('name, industry, status, owner_email, owner_name, notes')
      .eq('id', id)
      .single(),
    supabase
      .from('client_notes')
      .select('content, source, tags, importance, created_at')
      .eq('client_id', id)
      .order('importance', { ascending: true })
      .order('created_at', { ascending: false }),
    supabase
      .from('meetings')
      .select('date, summary_ai, decisions, tasks, promises_us')
      .eq('client_id', id)
      .order('date', { ascending: false })
      .limit(5),
    supabase
      .from('projects')
      .select('type, status, value_netto, notes')
      .eq('client_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('automations')
      .select('name, status, transactions_this_month')
      .eq('client_id', id),
    supabase
      .from('audits')
      .select('score, findings, financial_summary, quote_id, completed_at, title')
      .eq('client_id', id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (!client) {
    return NextResponse.json({ error: 'Klient nie istnieje' }, { status: 404 })
  }

  // Build prompt sections
  const notesText =
    notes && notes.length > 0
      ? notes
          .map(
            (n) =>
              `[${n.importance?.toUpperCase() ?? 'MEDIUM'} | ${n.source}] ${n.content}${n.tags?.length ? ` (tagi: ${n.tags.join(', ')})` : ''}`
          )
          .join('\n')
      : 'Brak notatek.'

  const meetingsText =
    meetings && meetings.length > 0
      ? meetings
          .map((m) => {
            const parts: string[] = [`Data: ${m.date}`]
            if (m.summary_ai) parts.push(`Podsumowanie: ${m.summary_ai}`)
            if (m.decisions && Array.isArray(m.decisions) && m.decisions.length > 0)
              parts.push(`Decyzje: ${m.decisions.join('; ')}`)
            return parts.join(' | ')
          })
          .join('\n')
      : 'Brak historii spotkań.'

  const projectsText =
    projects && projects.length > 0
      ? projects
          .map((p) => {
            const label = p.type ?? 'Projekt'
            return `${label} — status: ${p.status}${p.notes ? ` — ${p.notes}` : ''}${p.value_netto ? ` — ${p.value_netto} PLN` : ''}`
          })
          .join('\n')
      : 'Brak projektów.'

  const automationsText =
    automations && automations.length > 0
      ? automations
          .map((a) => `${a.name} (${a.status}) — ${a.transactions_this_month} transakcji`)
          .join('\n')
      : 'Brak automatyzacji.'

  // Build audit section if a completed audit exists
  let auditSection = ''
  if (latestAudit) {
    const auditDate = latestAudit.completed_at
      ? new Date(latestAudit.completed_at).toLocaleDateString('pl-PL')
      : 'brak daty'
    const findings = Array.isArray(latestAudit.findings) ? latestAudit.findings : []
    const topFindings = findings
      .slice(0, 3)
      .map((f: unknown) => (f && typeof f === 'object' && 'finding' in f ? String((f as { finding: unknown }).finding) : String(f)))
      .filter(Boolean)
      .join(', ')
    const financial = latestAudit.financial_summary as Record<string, number> | null
    const roi = financial?.total_addressable_roi_pln
      ? `${financial.total_addressable_roi_pln.toLocaleString('pl-PL')} PLN/rok`
      : null
    const quoteStatus = latestAudit.quote_id ? 'wycena wysłana' : 'brak wyceny'

    auditSection = `
## Wyniki Audytu Operacyjnego (${auditDate}):
Wynik: ${latestAudit.score ?? '—'}/100${topFindings ? ` | Kluczowe problemy: ${topFindings}` : ''}${roi ? ` | Obiecany ROI: ${roi}` : ''}
Status wyceny: ${quoteStatus}
`
  }

  const prompt = `Jesteś doświadczonym polskim konsultantem sprzedaży B2B. Piszesz brief przed spotkaniem handlowym.
Twoje briefy są znane z precyzji, naturalnego języka i konkretnych wskazówek — zero korporacyjnych ogólników.

KONTEKST 77STF — zewnętrzny dział IT dla polskich MŚP (10-50 osób):
- Automatyzacja procesów przez RPA (wchodzimy w stary ERP bez API, bez zgody dostawcy systemu)
- Asystent głosowy AI z prawdziwym sklonowanym głosem pracownika firmy klienta
- Social media automation z realnego contentu firmy
- Guardian Agent — proaktywnie skanuje rynek i proponuje optymalizacje zanim klient zauważy problem
- Panel klienta z real-time ROI każdej automatyzacji

${auditSection}## DANE O KLIENCIE: ${client.name}
Branża: ${client.industry ?? 'nieznana'}
Status CRM: ${client.status}
Decydent: ${client.owner_name ?? 'nieznany'}
Email: ${client.owner_email ?? 'brak'}
${client.notes ? `Notatki: ${client.notes}` : ''}

## Notatki i wywiad:
${notesText}

## Historia spotkań:
${meetingsText}

## Projekty:
${projectsText}

## Automatyzacje:
${automationsText}

---
ZASADY JĘZYKA — SPRAWDŹ KAŻDE ZDANIE (naruszenie dyskwalifikuje brief):

Błędne → Poprawne (przykłady obowiązkowe do przestrzegania):
✗ "Jaki integracja ERP używacie" → ✓ "Z jakiego systemu ERP korzystacie?"
✗ "pull danych z systemu" → ✓ "pobieranie danych z systemu"
✗ "To nasze codzienne chleb" → ✓ "To nasza specjalność, robimy to regularnie"
✗ "Manualny monitoring" → ✓ "Ręczne monitorowanie" lub "monitoring prowadzony ręcznie"
✗ "Brak raportu CEO" → ✓ "Właściciel codziennie traci 45 minut na ręczne zbieranie danych"
✗ "Brak automatyzacji social media" → ✓ "Każdy post publikowany jest ręcznie — praca na godziny"
✗ pytanie "Czy macie API?" → ✓ "Czy wasz system ERP posiada API lub możliwość eksportu danych?"
✗ pytanie bez podmiotu "Kiedy raport?" → ✓ "O której godzinie chciałbyś otrzymywać dzienny raport?"

Zasady treści:
- Używaj konkretnych danych z briefu — NIE WYMYŚLAJ faktów których nie ma w danych
- Imię decydenta jeśli jest w danych — używaj go naturalnie (nie "klient", nie "DM")
- pain_points = konkretne zdarzenia kosztujące czas lub pieniądze, max 12 słów, zacznij od rzeczownika
- questions_to_ask = otwarte pytania odkrywające głębię bólu (Jak / Ile / Kiedy / Co / Opowiedz mi)
- ŻADNE pytanie nie może być odpowiedzią TAK/NIE

---
INSTRUKCJA GENEROWANIA — DWIE FAZY:

FAZA 1 — pole "_scratchpad" (OBOWIĄZKOWE):
Napisz max 3 zdania: co wiesz o tej firmie, kto konkretnie decyduje i jaki jeden fakt jest najważniejszy dla tej rozmowy. To jest twoje myślenie przed briefem — dzięki temu reszta będzie precyzyjna.

FAZA 2 — wypełnij pola zgodnie z poniższą specyfikacją:

executive_summary — DOKŁADNIE 4-5 zdań (nie skracaj, nie wydłużaj):
  Zdanie 1: Kim jest ta firma i czym konkretnie się zajmuje
  Zdanie 2: Gdzie jesteśmy w relacji — historia kontaktu, ile spotkań, co ustalono
  Zdanie 3: Najważniejszy ból operacyjny z danych — konkretnie co ich kosztuje
  Zdanie 4: Największa szansa sprzedażowa 77STF u tego klienta
  Zdanie 5: Jak podejść do decydenta — konkretna taktyka na tę osobę

decision_maker_profile — max 2 zdania:
  Poziom techniczny DM, jak podejmuje decyzje, co go motywuje lub irytuje

conversation_tone — DOKŁADNIE 1 zdanie:
  Konkretne pytanie lub obserwacja którą otwierasz rozmowę (nie "zaproponuj demo", nie "bądź partnerem")

pain_points — DOKŁADNIE 4, każdy max 12 słów:
  Konkretne straty, nie slogany. Zacznij od rzeczownika lub czasownika.

opportunities — DOKŁADNIE 4, każdy max 12 słów:
  Konkretna usługa 77STF + konkretny benefit tej firmy. Zacznij od nazwy usługi.

proposed_solutions — DOKŁADNIE 2 obiekty:
  title: krótka nazwa rozwiązania
  description: 2 zdania — co konkretnie robimy, jaki mierzalny efekt
  estimated_roi_pln: realistyczna liczba w PLN (nie 0, oblicz na podstawie danych)
  implementation_time: realny czas wdrożenia
  why_them: 1 zdanie — dlaczego TO rozwiązanie pasuje do TEJ firmy (użyj jej specyfiki z danych)

questions_to_ask — DOKŁADNIE 4 pytania:
  Pełne zdania. Otwarte. Odkrywcze. Poprawna polska odmiana. Każde ujawnia głębię bólu lub priorytety.

objections_to_handle — DOKŁADNIE 3 obiekty:
  Realne obiekcje tej branży i tej osoby (nie generyczne)
  response: 2 konkretne zdania, pewne siebie, z przykładem lub liczbą

closing_strategy — DOKŁADNIE 2 zdania:
  Konkretna propozycja z datą lub terminem. Nie "zaproponuj next steps".

next_steps — DOKŁADNIE 4 kroki, każdy max 12 słów:
  Zaczynają od czasownika. Konkretne i mierzalne. Z osobą odpowiedzialną jeśli znasz.

---
Odpowiadaj WYŁĄCZNIE JSON. Zero tekstu przed ani po. Zero markdown. Zero backticks.

{
  "_scratchpad": "3 zdania analizy przed briefem",
  "executive_summary": "4-5 zdań",
  "decision_maker_profile": "2 zdania",
  "conversation_tone": "1 zdanie",
  "pain_points": ["ból 1","ból 2","ból 3","ból 4"],
  "opportunities": ["usługa + benefit 1","usługa + benefit 2","usługa + benefit 3","usługa + benefit 4"],
  "proposed_solutions": [
    {"title":"nazwa","description":"2 zdania","estimated_roi_pln":0,"implementation_time":"X tygodni","why_them":"1 zdanie"},
    {"title":"nazwa","description":"2 zdania","estimated_roi_pln":0,"implementation_time":"X tygodni","why_them":"1 zdanie"}
  ],
  "questions_to_ask": ["Pełne pytanie?","Pełne pytanie?","Pełne pytanie?","Pełne pytanie?"],
  "objections_to_handle": [
    {"objection":"konkretna obiekcja","response":"2 zdania"},
    {"objection":"konkretna obiekcja","response":"2 zdania"},
    {"objection":"konkretna obiekcja","response":"2 zdania"}
  ],
  "closing_strategy": "2 zdania z konkretnym terminem",
  "next_steps": ["Czasownik + co + kiedy","Czasownik + co + kiedy","Czasownik + co + kiedy","Czasownik + co + kiedy"]
}`

  // Check for API key — return mock so UI works even without key
  if (!process.env.ANTHROPIC_API_KEY) {
    const mock = {
      executive_summary: `${client.name} to firma z branży ${client.industry ?? 'ogólnej'} zatrudniająca kilkudziesięciu pracowników, gdzie właściciel podejmuje wszystkie kluczowe decyzje samodzielnie. Obecnie są na etapie "${client.status}" w naszym pipeline — mamy już nawiązany kontakt, teraz trzeba pokazać konkretną wartość. Firma traci czas na powtarzalne zadania manualne, które blokują wzrost. Największa szansa to wdrożenie automatyzacji obiegu dokumentów i asystenta głosowego, które zwrócą się w ciągu 3-4 miesięcy. Podejdź partnersko — jako zewnętrzny CTO, nie sprzedawca.`,
      decision_maker_profile: `Właściciel firmy, decyduje sam i szybko — liczy się konkret i liczby, nie prezentacje. Poziom techniczny umiarkowany, rozumie korzyści ale nie szczegóły implementacji.`,
      conversation_tone: `Zacznij od pytania o największy problem operacyjny tygodnia — pokaż że znasz branżę zanim zaproponujesz cokolwiek.`,
      pain_points: [
        'Ręczne przepisywanie danych między systemami',
        'Brak automatycznych powiadomień i raportów',
        'Obsługa klienta ograniczona godzinami pracy',
        'Trudności z monitorowaniem KPI w czasie rzeczywistym',
      ],
      opportunities: [
        'Automatyzacja obiegu dokumentów przez RPA',
        'Asystent głosowy AI na infolinie 24/7',
        'Automatyczny reporting dla zarządu',
        'Integracja danych ze starego ERP bez API',
      ],
      proposed_solutions: [
        {
          title: 'Automatyzacja procesów operacyjnych',
          description: 'Wdrożenie workflow automatyzującego powtarzalne zadania — przepływ dokumentów, powiadomienia, raporty.',
          estimated_roi_pln: 24000,
          implementation_time: '3-4 tygodnie',
          why_them: `Firma ${client.name} zyska natychmiastową redukcję pracy ręcznej i błędów ludzkich.`,
        },
        {
          title: 'Asystent głosowy AI — infolinia 24/7',
          description: 'Wdrożenie bota głosowego ze sklonowanym głosem pracownika — odbiera połączenia, odpowiada na FAQ, przekierowuje.',
          estimated_roi_pln: 18000,
          implementation_time: '2-3 tygodnie',
          why_them: 'Obsługa klienta poza godzinami pracy bez dodatkowych etatów.',
        },
      ],
      questions_to_ask: [
        'Ile czasu tygodniowo tracicie na powtarzalne zadania administracyjne?',
        'Z jakiego ERP/systemu korzystacie i czy ma API?',
        'Jak wygląda obecna obsługa klienta — ile połączeń dziennie?',
        'Jakie dane chcielibyście widzieć na bieżąco jako właściciel?',
        'Co jest największym wąskim gardłem w firmie teraz?',
      ],
      objections_to_handle: [
        {
          objection: 'To za drogie dla nas',
          response: 'Rozumiemy. Pokażemy ROI na konkretnych liczbach — ile godzin tygodniowo automatyzacja oszczędza i co to daje w PLN miesięcznie. Zazwyczaj zwrot w ciągu 3-6 miesięcy.',
        },
        {
          objection: 'Mamy stary system, nie da się zintegrować',
          response: 'Specjalizujemy się właśnie w tym — wchodzimy w stare ERP bez API przez RPA (robotyczne klikanie). Nie potrzebujemy zgody dostawcy systemu.',
        },
        {
          objection: 'Nie mamy zasobów na wdrożenie',
          response: 'My jesteśmy Waszym zewnętrznym działem IT. Robimy wszystko my — od A do Z. Od Was potrzebujemy 2-3 godzin na onboarding i dostęp do systemów.',
        },
      ],
      closing_strategy: 'Zaproponuj demo na żywo z danymi klienta — pokaż konkretny workflow zautomatyzowany w 48h. Oferta ważna 14 dni z bonusem onboardingowym (pierwsze spotkanie wdrożeniowe gratis).',
      next_steps: [
        'Wyślij podsumowanie z proponowanymi rozwiązaniami po calli (do 24h)',
        'Zaproponuj termin demo technicznego (10 dni)',
        'Przygotuj wstępną wycenę na podstawie informacji z calla',
        'Dodaj do pipeline — etap: demo1',
      ],
    }
    return NextResponse.json({ brief: mock, client_name: client.name, is_mock: true })
  }

  try {
    const { text } = await callClaude({
      feature: 'meetingBrief',
      model: getModel('meetingBrief'),
      system: 'Jesteś polskim konsultantem sprzedaży B2B. Odpowiadaj WYŁĄCZNIE w JSON — zero tekstu poza JSON, zero markdown, zero backticks. Polskie zdania muszą być gramatycznie poprawne. Zwróć kompletny, poprawny JSON — upewnij się że wszystkie nawiasy i cudzysłowy są zamknięte.',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4096,
      client_id: id,
    })

    let brief: unknown
    try {
      // 1. Direct parse
      brief = JSON.parse(text)
    } catch {
      // 2. Extract JSON block
      const match = text.match(/\{[\s\S]*\}/)
      const candidate = match?.[0] ?? text
      try {
        brief = JSON.parse(candidate)
      } catch {
        // 3. Truncated JSON repair — close open arrays/objects
        const repaired = (() => {
          let s = candidate.trimEnd()
          // Count unclosed brackets
          let braces = 0, brackets = 0, inStr = false, esc = false
          for (const ch of s) {
            if (esc) { esc = false; continue }
            if (ch === '\\' && inStr) { esc = true; continue }
            if (ch === '"') { inStr = !inStr; continue }
            if (inStr) continue
            if (ch === '{') braces++
            if (ch === '}') braces--
            if (ch === '[') brackets++
            if (ch === ']') brackets--
          }
          // Remove trailing comma before closing
          s = s.replace(/,\s*$/, '')
          // Close open structures
          while (brackets > 0) { s += ']'; brackets-- }
          while (braces > 0) { s += '}'; braces-- }
          return s
        })()
        try {
          brief = JSON.parse(repaired)
        } catch {
          return NextResponse.json(
            { error: 'Nie udało się sparsować odpowiedzi AI. Spróbuj ponownie.' },
            { status: 500 }
          )
        }
      }
    }

    return NextResponse.json({ brief, client_name: client.name, model: getModel('meetingBrief') })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Nieznany błąd'
    // callClaude() already logged to error_log — return fallback so UI doesn't break
    const fallback = {
      executive_summary: 'Nie udało się wygenerować briefu AI. Sprawdź klucz API.',
      pain_points: ['Dane niedostępne'],
      opportunities: [],
      proposed_solutions: [],
      questions_to_ask: ['Co jest największym wyzwaniem operacyjnym?'],
      objections_to_handle: [],
      closing_strategy: 'Zaproponuj demo z danymi klienta.',
      next_steps: ['Wyślij follow-up email po calli'],
      _error: true,
    }
    return NextResponse.json({ brief: fallback, client_name: client.name, is_mock: true, error: message })
  }
}
