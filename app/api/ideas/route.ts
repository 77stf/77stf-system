import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase'
import { z } from 'zod'

const createSchema = z.object({
  title:        z.string().min(1).max(200),
  category:     z.enum(['implementation', 'system_upgrade', 'owner_idea', 'tool', 'integration'] as const),
  description:  z.string().optional(),
  priority:     z.enum(['critical', 'high', 'medium', 'low'] as const).optional(),
  source_agent: z.enum(['analyzer', 'radar', 'guardian', 'second_brain', 'manual'] as const).optional(),
  source_url:   z.string().optional(),
  effort_hours: z.number().optional(),
  roi_notes:    z.string().optional(),
})

const patchSchema = z.object({
  title:        z.string().min(1).max(200).optional(),
  category:     z.enum(['implementation', 'system_upgrade', 'owner_idea', 'tool', 'integration'] as const).optional(),
  description:  z.string().optional(),
  priority:     z.enum(['critical', 'high', 'medium', 'low'] as const).optional(),
  status:       z.enum(['new', 'considering', 'planned', 'in_progress', 'rejected', 'done'] as const).optional(),
  effort_hours: z.number().optional(),
  roi_notes:    z.string().optional(),
})

export async function GET(req: NextRequest) {
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })

  const admin = createSupabaseAdminClient()
  const status = req.nextUrl.searchParams.get('status')
  const category = req.nextUrl.searchParams.get('category')

  let query = admin.from('offline_ideas').select('*').order('created_at', { ascending: false })
  if (status)   query = query.eq('status', status)
  if (category) query = query.eq('category', category)

  const { data, error } = await query.limit(100)
  if (error) return NextResponse.json({ error: 'Błąd pobierania' }, { status: 500 })

  return NextResponse.json({ data: data ?? [] })
}

export async function POST(req: NextRequest) {
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Nieprawidłowe dane', details: parsed.error.flatten() }, { status: 400 })

  const admin = createSupabaseAdminClient()
  const { data, error } = await admin
    .from('offline_ideas')
    .insert({ ...parsed.data, status: 'new', source_agent: parsed.data.source_agent ?? 'manual' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'Błąd zapisu' }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Brak id' }, { status: 400 })

  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Nieprawidłowe dane' }, { status: 400 })

  const admin = createSupabaseAdminClient()
  const { data, error } = await admin.from('offline_ideas').update(parsed.data).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: 'Błąd aktualizacji' }, { status: 500 })

  return NextResponse.json({ data })
}

export async function DELETE(req: NextRequest) {
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Brak id' }, { status: 400 })

  const admin = createSupabaseAdminClient()
  await admin.from('offline_ideas').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
