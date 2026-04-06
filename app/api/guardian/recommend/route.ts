import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'
import { callClaude } from '@/lib/claude'
import { AI_MODELS } from '@/lib/ai-config'
import { rateLimit } from '@/lib/rate-limit'

// POST /api/guardian/recommend
// Returns structured JSON action plan — rendered as UI steps, never raw markdown

export interface RecommendStep {
  step: string    // short action label, 1 sentence
  detail: string  // optional extra context, 1 sentence max
}

export interface RecommendResult {
  title: string           // problem name, 3-5 words
  steps: RecommendStep[]  // 3-5 concrete steps
  why: string             // 1 sentence: ROI or risk if ignored
}

export async function POST(req: Request) {
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })

  if (!rateLimit(`guardian-recommend:${user.id}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Za dużo zapytań. Odczekaj chwilę.' }, { status: 429 })
  }

  let body: { prompt: string; alert_type: string }
  try { body = await req.json() as typeof body }
  catch { return NextResponse.json({ error: 'Nieprawidłowy format' }, { status: 400 }) }

  if (!body.prompt) return NextResponse.json({ error: 'Brak treści zapytania' }, { status: 400 })

  const { text } = await callClaude({
    feature: 'guardianRecommend',
    model: AI_MODELS.balanced,
    system: `Jesteś Guardian — system operacyjny 77STF.
Zwróć TYLKO czysty JSON bez żadnego markdown, bez backtick, bez komentarzy.

Format:
{
  "title": "3-5 słów opisujących problem",
  "steps": [
    { "step": "Krótka akcja — co konkretnie zrobić", "detail": "Jedno zdanie dlaczego lub jak" },
    { "step": "...", "detail": "..." }
  ],
  "why": "Jedno zdanie: co ryzykujesz jeśli nie zadziałasz"
}

Zasady:
- 3-5 kroków, każdy realny i konkretny
- Bez markdown, bez bold, bez gwiazdek, bez numerów w step
- Pisz po polsku
- step to akcja (zacznij od czasownika)
- detail to dodatkowy kontekst (opcjonalny ale pomocny)`,
    messages: [{ role: 'user', content: body.prompt }],
    max_tokens: 500,
    triggered_by: 'user',
  })

  // Parse JSON — strip any accidental markdown wrapping
  let result: RecommendResult
  try {
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    result = JSON.parse(clean) as RecommendResult
  } catch {
    // Fallback: wrap raw text as single step
    result = {
      title: 'Plan działania',
      steps: [{ step: text.slice(0, 100), detail: '' }],
      why: '',
    }
  }

  return NextResponse.json(result)
}
