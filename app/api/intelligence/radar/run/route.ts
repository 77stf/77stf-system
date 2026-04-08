import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'
import { createSupabaseAdminClient } from '@/lib/supabase'
import { callClaude } from '@/lib/claude'
import { AI_MODELS } from '@/lib/ai-config'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'

// ─── Types ────────────────────────────────────────────────────────────────────

interface RawItem {
  title: string
  url: string
  category: 'ai_tech' | 'crypto' | 'business' | 'saas'
  source: string
}

interface ScoredItem extends RawItem {
  score: number
  reason: string
}

// ─── Fetchers — no API keys needed ───────────────────────────────────────────

async function fetchHackerNews(): Promise<RawItem[]> {
  try {
    const res = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json', { next: { revalidate: 0 } })
    const ids = (await res.json() as number[]).slice(0, 40)

    const stories = await Promise.allSettled(
      ids.map(id =>
        fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, { next: { revalidate: 0 } })
          .then(r => r.json() as Promise<{ title?: string; url?: string; score?: number; type?: string }>)
      )
    )

    return stories
      .filter((r): r is PromiseFulfilledResult<{ title?: string; url?: string; score?: number; type?: string }> =>
        r.status === 'fulfilled' && r.value?.type === 'story' && !!r.value?.title
      )
      .map(r => ({
        title: r.value.title ?? '',
        url: r.value.url ?? `https://news.ycombinator.com`,
        category: 'ai_tech' as const,
        source: 'Hacker News',
      }))
      .filter(i => i.title.length > 5)
  } catch {
    return []
  }
}

async function fetchCoinGeckoNews(): Promise<RawItem[]> {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/news?per_page=15', {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 0 },
    })
    if (!res.ok) return []
    const data = await res.json() as { data?: { title?: string; url?: string }[] }
    return (data.data ?? [])
      .filter(item => item.title && item.url)
      .slice(0, 15)
      .map(item => ({
        title: item.title ?? '',
        url: item.url ?? '',
        category: 'crypto' as const,
        source: 'CoinGecko News',
      }))
  } catch {
    return []
  }
}

// ─── POST /api/intelligence/radar/run ────────────────────────────────────────

export async function POST(req: Request) {
  // Allow n8n cron calls via webhook secret (no session cookie needed)
  const webhookSecret = req.headers.get('x-webhook-secret')?.trim()
  const isValidCron = webhookSecret && webhookSecret === process.env.N8N_WEBHOOK_SECRET?.trim()

  if (!isValidCron) {
    const authClient = await createSupabaseServerClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })

    // Rate limit: max 5 digest runs per hour
    if (!rateLimit(`radar:${user.id}`, 5, 60 * 60 * 1000)) {
      return NextResponse.json({ error: 'Za dużo zapytań. Odczekaj przed następnym digestem.' }, { status: 429 })
    }
  } else {
    // Cron rate limit: max 3 radar runs per hour
    if (!rateLimit('radar:cron', 3, 60 * 60 * 1000)) {
      return NextResponse.json({ error: 'Cron rate limit exceeded.' }, { status: 429 })
    }
  }

  let trigger = 'manual'
  try {
    const body = await req.json() as { trigger?: string }
    trigger = body.trigger ?? 'manual'
  } catch { /* ok, default */ }

  // 1. Fetch sources in parallel
  const [hnItems, cryptoItems] = await Promise.all([
    fetchHackerNews(),
    fetchCoinGeckoNews(),
  ])

  const allItems: RawItem[] = [...hnItems, ...cryptoItems]

  if (allItems.length === 0) {
    return NextResponse.json({ error: 'Nie udało się pobrać danych z żadnego źródła' }, { status: 502 })
  }

  // 2. Haiku scores each item for relevance to 77STF
  const itemListText = allItems
    .map((item, i) => `${i + 1}. [${item.category}] ${item.title}`)
    .join('\n')

  const { text: scoringResponse } = await callClaude({
    feature: 'radarScoring',
    model: AI_MODELS.fast,
    system: `Jesteś Radar — filtrem newsów dla firmy 77STF.
77STF to zewnętrzny dział tech dla polskich MŚP. Budujemy: automatyzacje AI, głosowych agentów, chatboty, social media automation.
Stack: Next.js, Supabase, n8n, Claude API, Vapi.ai.

Oceń każdy news na skali 0-10 pod kątem wartości dla 77STF:
- 8-10: Bezpośrednie zastosowanie (nowe AI tools, automatyzacje, biznes PL)
- 5-7: Warto wiedzieć (crypto >5%, nowe modele AI, SaaS launches)
- 0-4: Nieistotne (polityka, sport, niezwiązane z tech)

Odpowiedz JSON array (bez markdown):
[{"i": 1, "score": 8, "reason": "krótkie uzasadnienie"}]`,
    messages: [{ role: 'user', content: itemListText }],
    max_tokens: 2000,
    triggered_by: 'user',
  })

  let scores: { i: number; score: number; reason: string }[] = []
  try {
    scores = JSON.parse(scoringResponse) as typeof scores
  } catch {
    // If parse fails, give all items score 5
    scores = allItems.map((_, i) => ({ i: i + 1, score: 5, reason: 'Ocena domyślna' }))
  }

  // 3. Filter top items (score >= 6)
  const scoredItems: ScoredItem[] = allItems.map((item, i) => {
    const scored = scores.find(s => s.i === i + 1)
    return { ...item, score: scored?.score ?? 0, reason: scored?.reason ?? '' }
  }).filter(item => item.score >= 6)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)

  if (scoredItems.length === 0) {
    return NextResponse.json({ error: 'Brak istotnych newsów dzisiaj (score < 6). Spróbuj później.' }, { status: 200, headers: { 'X-Empty': '1' } })
  }

  // 4. Sonnet generates digest
  const digestInput = scoredItems
    .map((item, i) => `${i + 1}. [Score: ${item.score}/10] [${item.source}] ${item.title}\n   URL: ${item.url}\n   Dlaczego ważne: ${item.reason}`)
    .join('\n\n')

  const { text: digestText } = await callClaude({
    feature: 'radarDigest',
    model: AI_MODELS.balanced,
    system: `Jesteś Radar — Chief Intelligence Officer dla 77STF.
Twój digest czyta właściciel firmy rano. Ma być zwięzły, konkretny, actionable.
Piszesz PO POLSKU. Skupiasz się na implikacjach dla 77STF i polskich MŚP.

Format odpowiedzi (markdown):
## Radar Digest — [data dziś]

**TL;DR** — 2-3 zdania: co jest najważniejsze dziś dla 77STF

### AI & Tech
[Najważniejsze newsy AI/tech z implikacjami dla 77STF, max 3 bullet points]

### Crypto & Fintech
[Max 2 bullet points jeśli są relevantne]

### Biznes & Narzędzia
[Nowe SaaS, automatyzacje, inne relevantne, max 3 bullet points]

**Akcja na dziś:** [1 konkretna rzecz do zrobienia na podstawie digestu]`,
    messages: [{ role: 'user', content: `Oto newsy na dziś (${new Date().toLocaleDateString('pl-PL')}):\n\n${digestInput}` }],
    max_tokens: 1200,
    triggered_by: 'user',
  })

  // 5. Save to DB
  const supabase = createSupabaseAdminClient()

  const categories = [...new Set(scoredItems.map(i => i.category))]
  const highlights = scoredItems.slice(0, 8).map(item => ({
    title: item.title,
    url: item.url,
    score: item.score,
    category: item.category,
    source: item.source,
    reason: item.reason,
  }))

  const { data: saved, error: saveError } = await supabase
    .from('intelligence_digests')
    .insert({
      digest_text: digestText,
      highlights,
      source_count: allItems.length,
      categories,
      model: AI_MODELS.balanced,
      trigger,
      metadata: { scored_count: scoredItems.length, total_fetched: allItems.length },
    })
    .select('id, generated_at')
    .single()

  if (saveError) {
    await supabase.from('error_log').insert({
      source: 'api/intelligence/radar/run',
      message: saveError.message,
      metadata: { trigger },
    })
    // Still return the digest even if save failed
    return NextResponse.json({
      digest: digestText,
      highlights,
      source_count: allItems.length,
      saved: false,
    })
  }

  return NextResponse.json({
    id: saved.id,
    generated_at: saved.generated_at,
    digest: digestText,
    highlights,
    source_count: allItems.length,
    scored_count: scoredItems.length,
    saved: true,
  })
}
