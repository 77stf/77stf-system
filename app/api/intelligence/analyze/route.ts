import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'
import { callClaude } from '@/lib/claude'
import { AI_MODELS } from '@/lib/ai-config'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'

// ─── URL type detection ───────────────────────────────────────────────────────

type ContentType = 'youtube_video' | 'instagram_post' | 'web' | 'text'

const LOGIN_REQUIRED = ['twitter.com', 'x.com', 'linkedin.com', 'facebook.com']

function detectUrl(str: string): string | null {
  try {
    const url = new URL(str.trim())
    return (url.protocol === 'http:' || url.protocol === 'https:') ? url.href : null
  } catch { return null }
}

function getUrlType(url: string): ContentType {
  const hostname = new URL(url).hostname.replace('www.', '')
  if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) return 'youtube_video'
  if (hostname.includes('instagram.com')) return 'instagram_post'
  return 'web'
}

function extractYoutubeId(url: string): string | null {
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /\/shorts\/([a-zA-Z0-9_-]{11})/,
    /\/embed\/([a-zA-Z0-9_-]{11})/,
  ]
  for (const re of patterns) {
    const m = url.match(re)
    if (m) return m[1]
  }
  return null
}

// ─── YouTube transcript via timedtext API (no key needed) ─────────────────────

async function getYouTubeCaptionsFromPage(videoId: string): Promise<string | null> {
  try {
    const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9,pl;q=0.8',
      },
      signal: AbortSignal.timeout(10000),
    })
    if (!pageRes.ok) return null
    const html = await pageRes.text()

    // Extract caption track URL from embedded player JSON
    const captionMatch = html.match(/"captionTracks":\s*\[.*?"baseUrl":"([^"]+)"/)
    if (!captionMatch) return null

    const captUrl = captionMatch[1]
      .replace(/\\u0026/g, '&')
      .replace(/\\\//g, '/')

    const captRes = await fetch(`${captUrl}&fmt=json3`, { signal: AbortSignal.timeout(8000) })
    if (!captRes.ok) return null

    interface CaptionEvent { segs?: { utf8?: string }[] }
    interface CaptionJson { events?: CaptionEvent[] }
    let json: CaptionJson | null = null
    try { json = await captRes.json() as CaptionJson } catch { /* xml fallback below */ }

    if (json?.events) {
      const transcript = json.events
        .filter((e: CaptionEvent) => e.segs)
        .flatMap((e: CaptionEvent) => (e.segs ?? []).map((s: { utf8?: string }) => s.utf8 ?? ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
      if (transcript.length > 50) return transcript
    }

    // Fallback: XML caption format
    const xmlRes = await fetch(captUrl, { signal: AbortSignal.timeout(8000) })
    if (!xmlRes.ok) return null
    const xml = await xmlRes.text()
    const transcript = xml
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'").replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim()
    return transcript.length > 50 ? transcript : null
  } catch { return null }
}

// ─── YouTube timedtext API (alternative path, no page scrape) ─────────────────

async function getYouTubeCaptionsDirect(videoId: string): Promise<string | null> {
  for (const lang of ['pl', 'en', 'a.pl', 'a.en']) {
    try {
      const url = `https://www.youtube.com/api/timedtext?v=${videoId}&fmt=json3&lang=${lang}`
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
      if (!res.ok) continue
      const data = await res.json() as { events?: { segs?: { utf8?: string }[] }[] }
      if (!data.events?.length) continue
      const transcript = data.events
        .filter(e => e.segs)
        .flatMap(e => (e.segs ?? []).map(s => s.utf8 ?? ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
      if (transcript.length > 50) return transcript
    } catch { continue }
  }
  return null
}

// ─── AssemblyAI audio transcription (requires ASSEMBLYAI_API_KEY) ─────────────
// Accepts any public URL including YouTube. Polls until done (max 55s).

async function transcribeAudioAssemblyAI(audioUrl: string): Promise<string | null> {
  const apiKey = process.env.ASSEMBLYAI_API_KEY
  if (!apiKey) return null

  try {
    // Submit job
    const submitRes = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: { authorization: apiKey, 'content-type': 'application/json' },
      body: JSON.stringify({
        audio_url: audioUrl,
        language_detection: true,
        punctuate: true,
        format_text: true,
      }),
      signal: AbortSignal.timeout(10000),
    })
    if (!submitRes.ok) return null
    const { id } = await submitRes.json() as { id: string }

    // Poll — max 55s (safe for Vercel Pro 60s limit)
    const deadline = Date.now() + 55000
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 3500))
      const pollRes = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
        headers: { authorization: apiKey },
        signal: AbortSignal.timeout(5000),
      })
      if (!pollRes.ok) break
      const data = await pollRes.json() as { status: string; text?: string; error?: string }
      if (data.status === 'completed' && data.text) return data.text
      if (data.status === 'error') return null
    }
    return null
  } catch { return null }
}

// ─── YouTube: full content fetch ──────────────────────────────────────────────

async function fetchYoutubeContent(videoId: string, videoUrl: string): Promise<{
  text: string
  hasTranscript: boolean
  method: string
} | null> {
  // Get metadata (title + description) in parallel with transcript attempts
  const metaFetch = fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`, {
    signal: AbortSignal.timeout(5000),
  }).then(r => r.ok ? r.json() as Promise<{ title?: string; author_name?: string }> : null)
    .catch(() => null)

  // Path 1: AssemblyAI audio (best quality, needs API key)
  const hasAssemblyKey = !!process.env.ASSEMBLYAI_API_KEY

  const [meta, captionsFromPage, captionsDirect] = await Promise.all([
    metaFetch,
    getYouTubeCaptionsFromPage(videoId),
    getYouTubeCaptionsDirect(videoId),
  ])

  const title = (meta as { title?: string } | null)?.title ?? ''
  const author = (meta as { author_name?: string } | null)?.author_name ?? ''

  const metaText = [
    title && `Tytuł: ${title}`,
    author && `Autor: ${author}`,
  ].filter(Boolean).join('\n')

  // Prefer audio if AssemblyAI available AND no quality captions found
  if (hasAssemblyKey) {
    const audioTranscript = await transcribeAudioAssemblyAI(videoUrl)
    if (audioTranscript && audioTranscript.length > 100) {
      return {
        text: [metaText, `Transkrypt (audio):\n${audioTranscript.slice(0, 12000)}`].filter(Boolean).join('\n\n'),
        hasTranscript: true,
        method: 'assemblyai_audio',
      }
    }
  }

  // Fallback: caption extraction
  const transcript = captionsFromPage ?? captionsDirect
  if (transcript) {
    return {
      text: [metaText, `Transkrypt (napisy):\n${transcript.slice(0, 10000)}`].filter(Boolean).join('\n\n'),
      hasTranscript: true,
      method: 'captions',
    }
  }

  // Last resort: metadata only
  if (metaText) {
    return { text: metaText, hasTranscript: false, method: 'metadata_only' }
  }

  return null
}

// ─── Instagram: OG tags extraction ───────────────────────────────────────────

async function fetchInstagramContent(url: string): Promise<{ text: string } | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; 77STF-Scout/1.0)' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const html = await res.text()

    const ogTitle = html.match(/<meta property="og:title" content="([^"]+)"/i)?.[1] ?? ''
    const ogDesc = html.match(/<meta property="og:description" content="([^"]+)"/i)?.[1] ?? ''

    // og:title format: 'Username on Instagram: "caption here"'
    // Use [\s\S] instead of . with s-flag (TS ES2017 target)
    const captionMatch = ogTitle.match(/on Instagram:\s*[""\u201c]([\s\S]+?)[""\u201d]?\s*$/)
    const caption = captionMatch?.[1] ?? ''

    const parts: string[] = []
    if (ogTitle) parts.push(`Post: ${ogTitle}`)
    if (caption && caption.length > 5) parts.push(`Podpis:\n${caption}`)
    if (ogDesc && ogDesc !== caption && ogDesc !== ogTitle) parts.push(`Opis: ${ogDesc}`)

    return parts.length > 0 ? { text: parts.join('\n\n') } : null
  } catch { return null }
}

// ─── Generic web fetch ────────────────────────────────────────────────────────

async function fetchWebContent(url: string): Promise<{ text: string; title?: string } | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; 77STF-Scout/1.0)' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const html = await res.text()
    const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim()
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 8000)
    return text.length > 50 ? { text, title } : null
  } catch { return null }
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildSystemPrompt(contentType: ContentType): string {
  const jsonSchema = `Odpowiedź ZAWSZE jako czysty JSON (zero markdown, zero code blocks):
{
  "summary": "2-3 zdania o czym jest materiał",
  "key_insights": ["insight 1 — konkretna technika/obserwacja", "insight 2", "insight 3"],
  "relevance_score": 1-10,
  "relevance_reason": "jedno zdanie: dlaczego ten score",
  "applicable_to_77stf": ["zastosowanie 1 z przykładem", "zastosowanie 2"],
  "decision": "BUILD" | "UPGRADE_AGENT" | "ADD_TO_ROADMAP" | "SKIP" | "MONITOR",
  "decision_reason": "konkretne uzasadnienie — co konkretnie zrobić i dlaczego",
  "action_items": ["akcja 1", "akcja 2"]
}

Decyzje:
- BUILD → buduj teraz, bezpośredni wpływ na przychód lub klientów 77STF
- UPGRADE_AGENT → popraw Guardian / Scout / Operator / Brief na podstawie tej wiedzy
- ADD_TO_ROADMAP → wartościowe, ale nie na teraz
- SKIP → brak wartości dla 77STF
- MONITOR → obserwuj — potencjalnie wartościowe w przyszłości`

  const base = `Jesteś Scout — Chief Content Analyst dla 77STF.
77STF = zewnętrzny dział tech dla polskich MŚP (10-50 os.). Klienci: sklepy, gabinety, firmy usługowe, producenci.
Budujemy: automatyzacje AI, głosowych agentów AI, chatboty RAG, social media automation, CRM.
Stack: Next.js, Supabase, n8n, Claude API, Vapi.ai, ElevenLabs.

${jsonSchema}`

  if (contentType === 'youtube_video' || contentType === 'instagram_post') {
    return `${base}

─── ANALIZA WIDEO / ROLKI — FRAMEWORK ───────────────────────────────────────

Analizujesz content wideo. Przeprowadź pełną analizę w 5 wymiarach:

1. HOOK (pierwsze 3-5 sekund)
   — Co konkretnie zatrzymało przewijanie? (obietnica/szok/pytanie/kontrast)
   — Czy jest pattern interrupt? Jakie słowo lub obraz?
   — Oceń siłę hooka 1-10

2. STRUKTURA NARRACYJNA
   — Zidentyfikuj łuk: problem → agitacja → rozwiązanie → CTA
   — Gdzie jest punkt kulminacyjny?
   — Czy i jak twórca używa storytellingu?

3. MECHANIKA ALGORYTMICZNA
   — Co powoduje wysokie watch time? (pacing, loop, suspens, wartość)
   — Czy wideo jest "saveable"? Dlaczego ktoś by je zapisał?
   — Elementy generujące komentarze (kontrowersja, pytanie, identyfikacja)

4. POZYCJONOWANIE TWÓRCY
   — Archetyp: ekspert / entertainer / storyteller / peer / transformer
   — Jak buduje zaufanie w tym materiale?
   — Jaki insight o odbiorcach zdradza ten content?

5. ZASTOSOWANIE DLA 77STF
   — Czy 77STF może nagrać analogiczną rolkę dla właścicieli polskich MŚP?
   — Jeśli tak: zaproponuj konkretny tytuł + 2-zdaniowy hook dla 77STF
   — Jaki ból/marzenie polskiego właściciela firmy to adresuje?

W key_insights: wyciągnij 3 techniki do skopiowania natychmiast.
W action_items: podaj co najmniej jeden konkretny temat rolki dla 77STF inspirowany tym materiałem (z tytułem).`
  }

  return base
}

// ─── POST /api/intelligence/analyze ──────────────────────────────────────────

export async function POST(req: Request) {
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })

  const { limit, windowMs } = RATE_LIMITS.AI_ANALYZE
  if (!rateLimit(`scout:${user.id}`, limit, windowMs)) {
    return NextResponse.json({ error: 'Za dużo zapytań. Odczekaj chwilę.' }, { status: 429 })
  }

  let body: unknown
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Nieprawidłowy format danych' }, { status: 400 }) }

  const { content, type = 'text' } = body as { content?: string; type?: string }
  if (!content || typeof content !== 'string' || content.trim().length < 5) {
    return NextResponse.json({ error: 'Treść jest za krótka' }, { status: 400 })
  }

  let contentToAnalyze = content.trim()
  let detectedContentType: ContentType = 'text'
  let transcriptMethod: string | undefined
  const detectedUrl = detectUrl(content.trim()) ?? (type === 'url' ? content.trim() : null)

  if (detectedUrl) {
    const hostname = new URL(detectedUrl).hostname.replace('www.', '')

    if (LOGIN_REQUIRED.some(d => hostname.includes(d))) {
      return NextResponse.json({
        error: `${hostname} wymaga logowania — wklej tekst posta zamiast linku.`,
      }, { status: 422 })
    }

    const urlType = getUrlType(detectedUrl)
    detectedContentType = urlType

    if (urlType === 'youtube_video') {
      const videoId = extractYoutubeId(detectedUrl)
      if (!videoId) return NextResponse.json({ error: 'Nie rozpoznano ID wideo YouTube.' }, { status: 422 })

      const yt = await fetchYoutubeContent(videoId, detectedUrl)
      if (!yt) {
        return NextResponse.json({
          error: 'Nie udało się pobrać transkryptu. Sprawdź czy wideo jest publiczne i ma włączone napisy, lub dodaj ASSEMBLYAI_API_KEY w env.',
        }, { status: 422 })
      }

      transcriptMethod = yt.method
      const methodNote = yt.method === 'assemblyai_audio'
        ? '[YOUTUBE — transkrypt audio (AssemblyAI)]'
        : yt.method === 'captions'
          ? '[YOUTUBE — transkrypt z napisów]'
          : '[YOUTUBE — analiza na podstawie tytułu i opisu (brak napisów)]'

      contentToAnalyze = `${methodNote}\nURL: ${detectedUrl}\n\n${yt.text}`

    } else if (urlType === 'instagram_post') {
      const ig = await fetchInstagramContent(detectedUrl)
      if (!ig) {
        return NextResponse.json({
          error: 'Instagram — wklej tekst podpisu/caption zamiast linku (prywatny profil lub brak dostępu).',
        }, { status: 422 })
      }
      contentToAnalyze = `[INSTAGRAM POST]\nURL: ${detectedUrl}\n\n${ig.text}`

    } else {
      const web = await fetchWebContent(detectedUrl)
      if (!web) {
        return NextResponse.json({
          error: 'Nie udało się pobrać treści strony. Wklej tekst artykułu bezpośrednio.',
        }, { status: 422 })
      }
      contentToAnalyze = web.title
        ? `Tytuł: ${web.title}\nŹródło: ${detectedUrl}\n\n${web.text}`
        : `Źródło: ${detectedUrl}\n\n${web.text}`
    }
  }

  const isVideo = detectedContentType === 'youtube_video' || detectedContentType === 'instagram_post'

  const { text } = await callClaude({
    feature: 'contentScout',
    model: AI_MODELS.balanced,
    system: buildSystemPrompt(detectedContentType),
    messages: [{ role: 'user', content: `Przeanalizuj ten materiał:\n\n${contentToAnalyze}` }],
    max_tokens: isVideo ? 1800 : 1200,
    triggered_by: 'user',
  })

  const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

  try {
    const analysis = JSON.parse(clean) as Record<string, unknown>
    return NextResponse.json({
      analysis,
      model: AI_MODELS.balanced,
      content_type: detectedContentType,
      transcript_method: transcriptMethod,
    })
  } catch {
    return NextResponse.json({
      analysis: { summary: text, decision: 'SKIP', raw: true },
      model: AI_MODELS.balanced,
      content_type: detectedContentType,
    })
  }
}
