import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase'
import { rateLimit } from '@/lib/rate-limit'
import { callClaude } from '@/lib/claude'
import { AI_MODELS } from '@/lib/ai-config'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlanSession {
  session_number: number
  title: string
  goal: string
  idea_ids: string[]
  idea_titles: string[]
  idea_scores: { id: string; score: number; score_reason: string }[]
  duration_hours: number
  complexity: 'low' | 'medium' | 'high'
  prerequisites: string[]
  steps: string[]
  suggested_date: string   // YYYY-MM-DD
  suggested_time: string   // HH:MM
  session_type: 'weekday' | 'weekend'
}

interface DevelopmentPlan {
  plan_title: string
  generated_at: string
  total_sessions: number
  total_hours: number
  priority_reasoning: string
  openrouter_tip: string | null
  sessions: PlanSession[]
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function getNextSessions(count: number): { date: string; time: string; type: 'weekday' | 'weekend' }[] {
  const sessions: { date: string; time: string; type: 'weekday' | 'weekend' }[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const cursor = new Date(today)
  // Start from day after tomorrow to give some breathing room
  cursor.setDate(cursor.getDate() + 2)

  while (sessions.length < count) {
    const dow = cursor.getDay() // 0=Sun, 6=Sat
    const isWeekend = dow === 0 || dow === 6
    const isWeekday = !isWeekend && dow !== 1 // skip Monday (usually packed)

    if (isWeekday || (isWeekend && dow === 6)) { // weekdays Tue-Fri, Saturday
      const yyyy = cursor.getFullYear()
      const mm = String(cursor.getMonth() + 1).padStart(2, '0')
      const dd = String(cursor.getDate()).padStart(2, '0')
      sessions.push({
        date: `${yyyy}-${mm}-${dd}`,
        time: isWeekend ? '10:00' : '16:30',
        type: isWeekend ? 'weekend' : 'weekday',
      })
    }
    cursor.setDate(cursor.getDate() + 1)
  }

  return sessions
}

// ─── POST /api/ideas/plan ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })

  if (!rateLimit(`ideas-plan:${user.id}`, 5, 60 * 1000)) {
    return NextResponse.json({ error: 'Za dużo zapytań — odczekaj chwilę.' }, { status: 429 })
  }

  const body = await req.json() as { idea_ids: string[] }
  const { idea_ids } = body

  if (!Array.isArray(idea_ids) || idea_ids.length === 0) {
    return NextResponse.json({ error: 'Wybierz co najmniej jeden pomysł.' }, { status: 400 })
  }
  if (idea_ids.length > 10) {
    return NextResponse.json({ error: 'Maksymalnie 10 pomysłów na raz.' }, { status: 400 })
  }

  const admin = createSupabaseAdminClient()

  // Fetch selected ideas
  const { data: ideas } = await admin
    .from('offline_ideas')
    .select('id, title, category, description, priority, status, source_agent, roi_notes, effort_hours, metadata')
    .in('id', idea_ids)

  if (!ideas || ideas.length === 0) {
    return NextResponse.json({ error: 'Nie znaleziono wybranych pomysłów.' }, { status: 404 })
  }

  // Pre-generate date slots for sessions (up to 10)
  const dateSlots = getNextSessions(10)
  const todayStr = new Date().toLocaleDateString('pl-PL', { year: 'numeric', month: 'long', day: 'numeric' })

  // Build prompt
  const ideasText = ideas.map((idea, i) => {
    const meta = idea.metadata as Record<string, unknown> | null
    const existingScore = meta?.relevance_score as number | undefined
    return `${i + 1}. **${idea.title}**
   - Kategoria: ${idea.category}
   - Priorytet: ${idea.priority}
   - Opis: ${idea.description ?? '(brak)'}
   - ROI: ${idea.roi_notes ?? '(brak)'}
   - Szacowany nakład: ${idea.effort_hours ? `${idea.effort_hours}h` : '(nieznany)'}
   - Istniejący score AI: ${existingScore ?? 'brak — oceń samodzielnie'}`
  }).join('\n\n')

  const dateSlotsText = dateSlots.slice(0, 8).map((s, i) =>
    `Slot ${i + 1}: ${s.date} ${s.time} (${s.type === 'weekend' ? 'weekend' : 'dzień roboczy po szkole'})`
  ).join('\n')

  const prompt = `Jesteś architektem systemu 77STF — zewnętrznego działu tech dla polskich MŚP. Masz zaplanować konkretne sesje kodowania dla właściciela (17 lat, uczy się AI development).

Dzisiaj jest: ${todayStr}
Właściciel koduje: dni robocze 16:30-19:30 (3h), weekendy 10:00-13:00 (3h)

## Wybrane pomysły do wdrożenia:
${ideasText}

## Dostępne sloty na sesje:
${dateSlotsText}

## ZADANIE:
1. Oceń każdy pomysł w kontekście systemu 77STF (score 1-10) jeśli nie ma oceny
2. Pogrupuj powiązane pomysły w logiczne sesje robocze
3. Posortuj wg priorytetów i zależności
4. Stwórz plan konkretnych sesji z dokładnymi krokami

## FORMAT — zwróć WYŁĄCZNIE JSON:

{
  "plan_title": "Plan wdrożeń 77STF — [miesiąc rok]",
  "total_sessions": 3,
  "total_hours": 9,
  "priority_reasoning": "Dlaczego w tej kolejności — konkretne uzasadnienie zależności",
  "openrouter_tip": "Wskazówka o OpenRouter jeśli widzisz optymalizację kosztów AI, lub null",
  "sessions": [
    {
      "session_number": 1,
      "title": "Krótki tytuł sesji",
      "goal": "Konkretny, mierzalny efekt: 'Po tej sesji system X robi Y, co oszczędza Z'",
      "idea_ids": ["id1", "id2"],
      "idea_titles": ["Tytuł pomysłu 1", "Tytuł pomysłu 2"],
      "idea_scores": [
        { "id": "id1", "score": 8, "score_reason": "Dlaczego taki score — konkretnie dla 77STF" }
      ],
      "duration_hours": 3,
      "complexity": "medium",
      "prerequisites": ["Co mieć gotowe PRZED sesją — konkretnie"],
      "steps": [
        "Krok 1 — konkretna akcja z plikiem/narzędziem",
        "Krok 2 — ...",
        "Krok 3 — ...",
        "Krok 4 — test i weryfikacja"
      ],
      "suggested_date": "YYYY-MM-DD",
      "suggested_time": "16:30",
      "session_type": "weekday"
    }
  ]
}

WAŻNE:
- Każda sesja = 3h (1 slot kodowania)
- Jeśli coś zajmuje 6h → rozbij na 2 sesje z logicznym podziałem
- Steps muszą być BARDZO konkretne: "Otwórz lib/ai-config.ts i dodaj..." nie "Zaktualizuj konfigurację"
- idea_ids muszą być prawdziwymi ID z listy
- Dates z dostępnych slotów powyżej
- Bądź realistyczny — 17-latek z 3h/sesję, nie zakładaj wcześniejszej wiedzy`

  let plan: DevelopmentPlan | null = null

  try {
    const result = await callClaude({
      feature: 'ideaPlan',
      model: AI_MODELS.balanced,
      system: 'Jesteś architektem systemu 77STF. Odpowiadasz WYŁĄCZNIE w JSON. Żadnego tekstu poza JSON.',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 3000,
    })

    const jsonMatch = result.text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const raw = JSON.parse(jsonMatch[0]) as DevelopmentPlan
      plan = {
        ...raw,
        generated_at: new Date().toISOString(),
      }
    }
  } catch {
    return NextResponse.json({ error: 'Błąd generowania planu — spróbuj ponownie.' }, { status: 500 })
  }

  if (!plan) {
    return NextResponse.json({ error: 'Nie udało się wygenerować planu.' }, { status: 500 })
  }

  // Update idea statuses to 'planned'
  await admin
    .from('offline_ideas')
    .update({ status: 'planned' })
    .in('id', idea_ids)

  // Generate markdown for export
  const markdown = generateMarkdown(plan)

  return NextResponse.json({ plan, markdown })
}

// ─── Markdown generator ───────────────────────────────────────────────────────

function generateMarkdown(plan: DevelopmentPlan): string {
  const date = new Date(plan.generated_at).toLocaleDateString('pl-PL', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  const complexityEmoji: Record<string, string> = {
    low: '🟢', medium: '🟡', high: '🔴',
  }

  const sessions = plan.sessions.map(s => {
    const dateFormatted = new Date(s.suggested_date + 'T12:00:00').toLocaleDateString('pl-PL', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })

    const prerequisites = s.prerequisites.length > 0
      ? `\n### Przed sesją przygotuj:\n${s.prerequisites.map(p => `- [ ] ${p}`).join('\n')}`
      : ''

    const steps = s.steps.map((step, i) => `${i + 1}. ${step}`).join('\n')
    const scoreInfo = s.idea_scores.map(sc =>
      `- **${sc.score}/10** — ${s.idea_titles[s.idea_ids.indexOf(sc.id)] ?? 'Pomysł'}: ${sc.score_reason}`
    ).join('\n')

    return `---

## Sesja ${s.session_number} — ${s.title} ${complexityEmoji[s.complexity] ?? '🟡'} (${s.duration_hours}h)
📅 ${dateFormatted}, ${s.suggested_time}
🎯 **Cel:** ${s.goal}

### Wdrażane pomysły:
${scoreInfo || s.idea_titles.map(t => `- ${t}`).join('\n')}
${prerequisites}

### Kroki:
${steps}

`
  }).join('\n')

  const tip = plan.openrouter_tip ? `\n> 💡 **OpenRouter tip:** ${plan.openrouter_tip}\n` : ''

  return `# ${plan.plan_title}
Wygenerowano: ${date} | Łącznie: **${plan.total_hours}h** w **${plan.total_sessions} sesjach**

${tip}
## Dlaczego ta kolejność?
${plan.priority_reasoning}

${sessions}
---
*Plan wygenerowany przez 77STF Development Planner*
`
}
