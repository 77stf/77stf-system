import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'
import { callClaude } from '@/lib/claude'
import { AI_MODELS } from '@/lib/ai-config'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'

// POST /api/content/carousel
// Generates a full Instagram carousel for 77STF brand
// Input: { topic: string, format: string, platform: string }
// Output: { slides: CarouselSlide[], caption: string, hashtags: string[], bio_cta: string }

export interface CarouselSlide {
  slide_number: number
  headline: string      // big bold text (1-2 lines max)
  body: string[]        // 4-8 list items OR paragraph text
  style: 'hook' | 'list' | 'cta'
  bg: 'white' | 'dark'  // white = Oskar style, dark = 77STF brand
}

export interface CarouselResult {
  title: string
  slides: CarouselSlide[]
  caption: string        // full Instagram caption with emojis
  hashtags: string[]     // 20-25 hashtags
  bio_cta: string        // suggested bio update for this campaign
  format: string
  topic: string
}

const CAROUSEL_FORMATS = {
  hook_list: 'HOOK + LISTA — zatrzymuje scroll, lista konkretnych wartości',
  problem_solution: 'PROBLEM → ROZWIĄZANIE — agitacja bólu + nasz produkt',
  how_to: 'HOW TO — krok po kroku jak wdrożyć AI w firmie',
  social_proof: 'SOCIAL PROOF — efekty klientów, liczby, cytaty',
  myth_fact: 'MIT vs FAKT — obala przekonania o AI',
  value_list: 'LISTA WARTOŚCI — co konkretnie dostają klienci',
} as const

export async function POST(req: Request) {
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })

  if (!rateLimit(`carousel:${user.id}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Za dużo zapytań. Odczekaj chwilę.' }, { status: 429 })
  }

  let body: unknown
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Nieprawidłowy format danych' }, { status: 400 }) }

  const { topic, format = 'hook_list', platform = 'instagram' } = body as {
    topic?: string
    format?: keyof typeof CAROUSEL_FORMATS
    platform?: string
  }

  if (!topic || topic.trim().length < 3) {
    return NextResponse.json({ error: 'Podaj temat karuzeli' }, { status: 400 })
  }

  const formatDesc = CAROUSEL_FORMATS[format] ?? CAROUSEL_FORMATS.hook_list

  const { text } = await callClaude({
    feature: 'carouselGenerator',
    model: AI_MODELS.balanced,
    system: `Jesteś ekspertem od viral content dla polskich przedsiębiorców.
Tworzysz karuzele na Instagram dla marki 77STF — zewnętrznego działu tech dla polskich MŚP (10-50 pracowników).

Co sprzedajemy:
- Automatyzacje AI (n8n, Make)
- Głosowi agenci AI (recepcja, obsługa klienta)
- Chatboty RAG (baza wiedzy firmy)
- Social media automation (posty, komentarze)
- Systemy CRM i analityka

Nasi klienci: właściciele firm usługowych, gabinetów, sklepów, agencji w Polsce.
Ich bóle: brak czasu, przepłacanie za pracowników, chaos operacyjny, utrata klientów przez wolne odpowiedzi.

STYL KARUZELI (wzór: Oskar Lipiński):
- Slajd 1 (HOOK): JEDEN mocny nagłówek, jedno zdanie które zatrzymuje scroll
- Slajdy środkowe: lista konkretnych punktów, każdy = jedna konkretna rzecz
- Ostatni slajd (CTA): prosty call to action, gdzie nas znaleźć
- Tekst: zwięzły, konkretny, zero buzzwordów, po polsku
- Ton: ekspert który naprawdę rozumie polskiego przedsiębiorcę, nie tech-nerd

UWAGA: Pisz jak do właściciela firmy który ma 5 minut rano. Liczby i konkretne fakty > abstrakcja.

FORMAT ODPOWIEDZI — czysty JSON bez markdown:
{
  "title": "tytuł karuzeli (do CMS)",
  "slides": [
    {
      "slide_number": 1,
      "headline": "JEDEN MOCNY NAGŁÓWEK — max 10 słów",
      "body": ["ewentualny podtytuł"],
      "style": "hook",
      "bg": "white"
    },
    {
      "slide_number": 2,
      "headline": "Format: NAZWA FORMATU",
      "body": ["punkt 1", "punkt 2", "punkt 3", "punkt 4", "punkt 5"],
      "style": "list",
      "bg": "white"
    },
    {
      "slide_number": 3,
      "headline": "Chcesz to u siebie?",
      "body": ["Darmowy audyt AI dla Twojej firmy", "@77stf.tech", "link w bio"],
      "style": "cta",
      "bg": "dark"
    }
  ],
  "caption": "pełny caption na Instagram — zacznij od hook, rozwiń wartość, zakończ CTA. Użyj emojis. Max 2200 znaków.",
  "hashtags": ["#automatyzacja", "#ai", "#biznes", "#entrepreneur", ...20 hashtagow],
  "bio_cta": "propozycja zdania do bio na tę kampanię"
}

Generuj 5-7 slajdów łącznie. Pierwsza lista musi mieć min 6 punktów.`,
    messages: [{
      role: 'user',
      content: `Temat: ${topic.trim()}
Format: ${formatDesc}
Platforma: ${platform}

Stwórz pełną karuzelę dla 77STF.`,
    }],
    max_tokens: 2500,
    triggered_by: 'user',
  })

  const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

  try {
    const result = JSON.parse(clean) as CarouselResult
    result.format = format
    result.topic = topic.trim()
    return NextResponse.json({ carousel: result })
  } catch {
    return NextResponse.json({ error: 'Błąd generowania — spróbuj ponownie' }, { status: 500 })
  }
}
