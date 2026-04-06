import { NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase'
import { z } from 'zod'
import { callClaude } from '@/lib/claude'
import { AI_MODELS } from '@/lib/ai-config'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'

const ContentPostSchema = z.object({
  title:        z.string().min(1).max(200),
  caption:      z.string().max(5000).optional(),
  platform:     z.enum(['instagram', 'linkedin', 'youtube', 'tiktok', 'twitter']).default('instagram'),
  status:       z.enum(['idea', 'draft', 'ready', 'scheduled', 'published']).default('idea'),
  post_type:    z.enum(['post', 'reel', 'story', 'carousel', 'video', 'thread']).default('post'),
  scheduled_at: z.string().datetime().optional().nullable(),
  hashtags:     z.array(z.string()).default([]),
  topics:       z.array(z.string()).default([]),
  notes:        z.string().max(2000).optional(),
  client_id:    z.string().uuid().optional().nullable(),
  ai_generated: z.boolean().default(false),
})

// GET — list posts (with optional filters)
export async function GET(req: Request) {
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status    = searchParams.get('status')
  const platform  = searchParams.get('platform')
  const client_id = searchParams.get('client_id')
  const generate  = searchParams.get('generate') // AI idea generation

  // AI generate ideas
  if (generate === '1') {
    if (!rateLimit(`content-gen:${user.id}`, RATE_LIMITS.AI_ANALYZE.limit, RATE_LIMITS.AI_ANALYZE.windowMs)) {
      return NextResponse.json({ error: 'Za dużo zapytań' }, { status: 429 })
    }

    const topic = searchParams.get('topic') ?? 'AI automatyzacje dla polskich firm'
    const platform_ = searchParams.get('platform') ?? 'instagram'

    const { text } = await callClaude({
      feature: 'contentIdeas',
      model: AI_MODELS.balanced,
      system: `Jesteś ekspertem od content marketingu dla 77STF — firmy tworzącej automatyzacje AI dla polskich MŚP.
Generujesz konkretne pomysły na posty które edukują, angażują i generują leady.
Odpowiedź WYŁĄCZNIE w JSON array (bez markdown):
[{
  "title": "tytuł posta",
  "caption": "gotowy tekst do wklejenia (z emoji, chwytliwy opening hook, CTA na końcu)",
  "hashtags": ["#tag1", "#tag2"],
  "post_type": "post|reel|carousel",
  "topics": ["ai", "business"],
  "hook": "pierwszy akapit który zatrzymuje scrollowanie"
}]`,
      messages: [{ role: 'user', content: `Wygeneruj 5 pomysłów na posty dla platformy ${platform_} na temat: ${topic}` }],
      max_tokens: 2000,
      triggered_by: 'user',
    })

    try {
      const ideas = JSON.parse(text) as unknown[]
      return NextResponse.json({ ideas })
    } catch {
      return NextResponse.json({ ideas: [], raw: text })
    }
  }

  const supabase = createSupabaseAdminClient()
  let query = supabase
    .from('content_posts')
    .select('*, clients(name)')
    .order('scheduled_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (status)    query = query.eq('status', status)
  if (platform)  query = query.eq('platform', platform)
  if (client_id) query = query.eq('client_id', client_id)
  else if (!searchParams.get('all')) query = query.is('client_id', null) // default: internal

  const { data, error } = await query.limit(100)
  if (error) return NextResponse.json({ error: 'Wewnętrzny błąd serwera' }, { status: 500 })
  return NextResponse.json({ posts: data ?? [] })
}

// POST — create post
export async function POST(req: Request) {
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })

  let body: unknown
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Nieprawidłowy format' }, { status: 400 }) }

  const parsed = ContentPostSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Nieprawidłowe dane', details: parsed.error.issues }, { status: 400 })

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.from('content_posts').insert(parsed.data).select('id, title').single()

  if (error) {
    await supabase.from('error_log').insert({ source: 'api/content/posts', message: error.message })
    return NextResponse.json({ error: 'Wewnętrzny błąd serwera' }, { status: 500 })
  }
  return NextResponse.json({ post: data }, { status: 201 })
}

// PATCH — update post
export async function PATCH(req: Request) {
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })

  let body: unknown
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Nieprawidłowy format' }, { status: 400 }) }

  const { id, ...rest } = body as { id: string } & Record<string, unknown>
  if (!id) return NextResponse.json({ error: 'Brak id' }, { status: 400 })

  const supabase = createSupabaseAdminClient()
  const { error } = await supabase.from('content_posts').update(rest).eq('id', id)

  if (error) return NextResponse.json({ error: 'Wewnętrzny błąd serwera' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE — delete post
export async function DELETE(req: Request) {
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Brak id' }, { status: 400 })

  const supabase = createSupabaseAdminClient()
  const { error } = await supabase.from('content_posts').delete().eq('id', id)

  if (error) return NextResponse.json({ error: 'Wewnętrzny błąd serwera' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
