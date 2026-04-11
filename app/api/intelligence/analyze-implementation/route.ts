import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase'
import { rateLimit } from '@/lib/rate-limit'
import Anthropic from '@anthropic-ai/sdk'
import { AI_MODELS, APPROX_COST_PER_1K } from '@/lib/ai-config'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// ─── 77STF system context (injected into every analysis) ─────────────────────

const SYSTEM_CONTEXT = `
## SYSTEM 77STF — AKTUALNY STACK I USŁUGI

### Usługi które oferujemy klientom:
- Automatyzacje AI (n8n + Claude API)
- Voice agents (Vapi.ai + ElevenLabs — klonowanie głosu)
- Chatboty RAG (NotebookLM, własne implementacje)
- Social media automation (auto-postowanie, AI content)
- Scraping i monitoring opinii (Google Maps, Ceneo)
- CEO Reports (agregacja danych, PDF, alerty branżowe)
- Analiza konkurencji (scraping, social monitoring)
- Nagrania z drona (DJI)
- CRM i systemy operacyjne (Next.js + Supabase)

### Aktywni klienci i ich potrzeby:
- **Avvlo** (farmacja): chatbot RAG dla badań klinicznych, voice agent demo, monitoring opinii, CEO Reports, social media automation, analiza konkurencji, mailing B2C
- **Petro-Lawa** (paliwo/transport): automatyzacje operacyjne
- **Galenos HK** (farmacja): te same potrzeby co Avvlo

### Nasz tech stack:
- Frontend: Next.js 16, TypeScript, Supabase
- AI: Claude API (Haiku/Sonnet/Opus), ElevenLabs, Vapi.ai
- Automatyzacje: n8n (Hetzner VPS)
- Deploy: Vercel + Railway
- Integracje: Gmail, Google Calendar, Canva, Notion, Slack
- Monitoring: Fireflies.ai (transkrypcje), Guardian (system monitoring)

### Już mamy wdrożone (nie trzeba budować od nowa):
- CRM z pipeline lead-to-client
- Audit Wizard (29 pytań, AI analiza, wyceny)
- Quote Builder
- AI Meeting Brief
- Stack Intelligence (mapa wdrożeń per klient)
- Guardian Agent (monitoring systemu)
- Intelligence Hub (Radar, Zwiadowca, Analizator)
- Roadmap Pipeline (kanban 7 etapów)
- Prezentacje z AI generowaniem slajdów
`

// ─── Content fetcher ──────────────────────────────────────────────────────────

async function fetchUrlContent(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; 77STF-Analyzer/1.0)' },
      signal: AbortSignal.timeout(8000),
    })
    const html = await res.text()
    // Strip HTML tags, keep text
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 8000) // limit to 8k chars
    return text
  } catch {
    return ''
  }
}

function detectSourceType(input: string): string {
  if (!input) return 'text'
  const lower = input.toLowerCase()
  if (lower.includes('instagram.com') || lower.includes('instagr.am')) return 'ig_reel'
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'yt_short'
  if (lower.includes('facebook.com') || lower.includes('fb.com')) return 'fb_post'
  if (lower.includes('tiktok.com')) return 'tiktok'
  if (lower.includes('reddit.com')) return 'text' // fetch as URL
  if (lower.startsWith('http://') || lower.startsWith('https://')) return 'text' // generic URL
  return 'text'
}

// ─── POST /api/intelligence/analyze-implementation ────────────────────────────

export async function POST(req: NextRequest) {
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })

  if (!rateLimit(`analyzer:${user.id}`, 15, 60 * 1000)) {
    return NextResponse.json({ error: 'Za dużo zapytań — odczekaj chwilę.' }, { status: 429 })
  }

  const body = await req.json() as {
    input: string          // URL, text, or base64 image
    input_type: 'url' | 'text' | 'image'
    save_to_ideas?: boolean
  }

  if (!body.input?.trim()) {
    return NextResponse.json({ error: 'Brak treści do analizy.' }, { status: 400 })
  }

  const admin = createSupabaseAdminClient()
  const sourceType = detectSourceType(body.input)

  // Fetch content for URLs
  let contentForAnalysis = body.input
  let fetchedFromUrl = false

  if (body.input_type === 'url' || body.input.startsWith('http')) {
    const fetched = await fetchUrlContent(body.input)
    if (fetched.length > 100) {
      contentForAnalysis = `URL: ${body.input}\n\nTreść strony:\n${fetched}`
      fetchedFromUrl = true
    }
  }

  // Load current stack_items for deeper comparison
  const { data: stackItems } = await admin
    .from('stack_items')
    .select('name, category, status, description')
    .limit(60)

  const stackSummary = (stackItems ?? [])
    .map(s => `- ${s.name} (${s.category}, ${s.status})${s.description ? ': ' + s.description : ''}`)
    .join('\n')

  // ─── Build analysis prompt ────────────────────────────────────────────────

  const analysisPrompt = `Jesteś Intelligence Analyst firmy 77STF — zewnętrznego działu tech dla polskich MŚP.

${SYSTEM_CONTEXT}

### Wdrożenia w systemie (stack_items ze wszystkich klientów):
${stackSummary || 'Brak danych'}

---

## ZADANIE: Głęboka analiza wdrożenia

Przeanalizuj poniższą treść i wygeneruj strukturalny raport.

### TREŚĆ DO ANALIZY:
${contentForAnalysis.slice(0, 6000)}

---

## FORMAT ODPOWIEDZI — zwróć WYŁĄCZNIE JSON:

{
  "what_is_it": {
    "name": "nazwa narzędzia/technologii/wdrożenia",
    "category": "ai_agent | automation | voice | chatbot | analytics | social | crm | other",
    "description": "2-3 zdania co to jest i jak działa",
    "official_url": "link do strony narzędzia jeśli znany, lub null"
  },
  "relevance_score": 7,
  "relevance_reasoning": "2 zdania dlaczego taki score — konkretnie dla 77STF",
  "quick_verdict": "WDROZ | MONITORUJ | POMIN",
  "system_comparison": {
    "already_have": ["co już mamy w systemie co robi to samo lub podobne"],
    "gap": "czego nam brakuje, co to uzupełnia",
    "replaces_or_extends": "zastępuje | rozszerza | nowe_terytorium"
  },
  "client_matrix": {
    "avvlo": { "fit": true, "reason": "dlaczego pasuje lub nie", "roi_estimate": "szacunkowy ROI w PLN/mies lub null" },
    "petro_lawa": { "fit": false, "reason": "...", "roi_estimate": null },
    "galenos_hk": { "fit": true, "reason": "...", "roi_estimate": null },
    "new_clients": { "fit": true, "reason": "dla jakich branż to pasuje", "roi_estimate": null }
  },
  "pros": ["zaleta 1", "zaleta 2", "zaleta 3"],
  "cons": ["wada 1", "wada 2", "wada 3"],
  "alternatives": [
    { "name": "alternatywa 1", "why_better": "dlaczego może być lepsza", "pricing": "darmowe/płatne/open-source" },
    { "name": "alternatywa 2", "why_better": "...", "pricing": "..." },
    { "name": "alternatywa 3", "why_better": "...", "pricing": "..." }
  ],
  "is_implementation_best": {
    "verdict": "tak | nie | zależy",
    "explanation": "Czy to najlepszy sposób na osiągnięcie tego efektu? Build vs buy? Alternatywne podejście?",
    "better_approach": "opis lepszego podejścia jeśli istnieje, lub null"
  },
  "recommendation": {
    "decision": "WDROZ | MONITORUJ | POMIN",
    "reasoning": "2-3 zdania uzasadnienia",
    "effort_hours": 8,
    "next_steps": ["krok 1", "krok 2", "krok 3"],
    "connect_with": ["z czym połączyć w systemie 77STF"]
  },
  "idea_upgrade": null
}

WAŻNE:
- relevance_score: 1-10 (1=zupełnie nieprzydatne, 10=game-changer dla 77STF)
- Jeśli score < 4, wypełnij tylko: what_is_it, relevance_score, relevance_reasoning, quick_verdict = "POMIN" i pomiń resztę (ustaw null)
- Bądź konkretny i brutalnie szczery — nie pisz "może warto rozważyć"
- alternatives muszą być REALNE narzędzia (nie wymyślone)
- client_matrix: myśl o realnych potrzebach tych klientów`

  // If it's an idea (not a URL/tool), use idea-upgrade mode
  const isOwnIdea = body.input_type === 'text' && !fetchedFromUrl && !body.input.startsWith('http') && body.input.length > 30

  const ideaUpgradePrompt = isOwnIdea ? `

DODATKOWE ZADANIE — tryb "Ulepsz mój pomysł":
Właściciel opisał własny pomysł. Oprócz standardowego raportu, wypełnij pole "idea_upgrade":
{
  "idea_upgrade": {
    "what_owner_really_wants": "Co naprawdę chce osiągnąć (głębszy cel za pomysłem)",
    "exists_as_tool": "czy istnieje gotowe narzędzie które to robi? nazwa lub null",
    "variant_simple": { "description": "wersja 1-2h", "effort": "1-2h" },
    "variant_medium": { "description": "wersja 4-8h z więcej możliwościami", "effort": "4-8h" },
    "variant_advanced": { "description": "wersja 20h+ enterprise", "effort": "20h+" },
    "pomysl_2_0": "Rozbudowana wersja pomysłu — wszystko co można do niego dodać, z czym połączyć, jaki potencjał",
    "roi_estimate": "szacunkowy ROI: X PLN/mies i Y godzin oszczędności per klient"
  }
}` : ''

  const fullPrompt = analysisPrompt + ideaUpgradePrompt

  // ─── Run analysis ─────────────────────────────────────────────────────────

  let analysisResult: Record<string, unknown> | null = null
  let inputTokens = 0
  let outputTokens = 0

  try {
    // For images, use vision
    let messages: Anthropic.Messages.MessageParam[]

    if (body.input_type === 'image') {
      messages = [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/jpeg',
              data: body.input.replace(/^data:image\/[a-z]+;base64,/, ''),
            },
          },
          { type: 'text', text: fullPrompt },
        ],
      }]
    } else {
      messages = [{ role: 'user', content: fullPrompt }]
    }

    const response = await anthropic.messages.create({
      model: AI_MODELS.balanced,
      max_tokens: 2500,
      system: 'Jesteś Intelligence Analyst 77STF. Odpowiadasz WYŁĄCZNIE w JSON. Żadnego tekstu poza JSON.',
      messages,
    })

    inputTokens = response.usage.input_tokens
    outputTokens = response.usage.output_tokens

    const rawText = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      analysisResult = JSON.parse(jsonMatch[0]) as Record<string, unknown>
    }
  } catch {
    return NextResponse.json({ error: 'Błąd analizy AI — spróbuj ponownie.' }, { status: 500 })
  }

  if (!analysisResult) {
    return NextResponse.json({ error: 'Nie udało się sparsować odpowiedzi AI.' }, { status: 500 })
  }

  // ─── Save to implementation_analyses ─────────────────────────────────────

  const { data: saved } = await admin.from('implementation_analyses').insert({
    source_type:      sourceType,
    source_url:       body.input.startsWith('http') ? body.input : null,
    source_text:      body.input.startsWith('http') ? null : body.input.slice(0, 2000),
    analysis:         analysisResult,
    recommendation:   (analysisResult.recommendation as Record<string, unknown>)?.decision as string ?? 'monitor',
    relevance_score:  analysisResult.relevance_score as number ?? null,
  }).select('id').single()

  // ─── Auto-save to ideas if requested or score >= 7 ────────────────────────

  let ideaId: string | null = null
  const score = analysisResult.relevance_score as number ?? 0
  const whatIsIt = analysisResult.what_is_it as Record<string, unknown> | null
  const recommendation = analysisResult.recommendation as Record<string, unknown> | null

  if ((body.save_to_ideas || score >= 8) && recommendation?.decision === 'WDROZ') {
    const { data: idea } = await admin.from('offline_ideas').insert({
      title:        whatIsIt?.name as string ?? 'Analiza wdrożenia',
      category:     'implementation',
      description:  whatIsIt?.description as string ?? '',
      priority:     score >= 9 ? 'high' : 'medium',
      status:       'new',
      source_agent: 'analyzer',
      source_url:   body.input.startsWith('http') ? body.input : null,
      roi_notes:    (recommendation?.reasoning as string ?? ''),
      metadata:     { analysis_id: saved?.id, relevance_score: score },
    }).select('id').single()
    ideaId = idea?.id ?? null
  }

  // ─── Track AI cost ─────────────────────────────────────────────────────────

  const model = AI_MODELS.balanced
  const rate = APPROX_COST_PER_1K[model as keyof typeof APPROX_COST_PER_1K] ?? 0.015
  const costUsd = ((inputTokens / 1000) * (rate * 0.2)) + ((outputTokens / 1000) * rate)

  void admin.from('ai_usage_log').insert({
    feature: 'implementationAnalyzer',
    model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cost_usd: costUsd,
    triggered_by: 'user',
  })

  return NextResponse.json({
    analysis: analysisResult,
    analysis_id: saved?.id ?? null,
    idea_id: ideaId,
    source_type: sourceType,
    is_own_idea: isOwnIdea,
  })
}

// ─── GET — historia analiz ────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })

  const admin = createSupabaseAdminClient()
  const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '20')

  const { data } = await admin
    .from('implementation_analyses')
    .select('id, source_type, source_url, source_text, recommendation, relevance_score, created_at, analysis')
    .order('created_at', { ascending: false })
    .limit(limit)

  return NextResponse.json({ data: data ?? [] })
}
