import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase'
import { z } from 'zod'

const createSchema = z.object({
  client_id: z.string().uuid(),
  title:     z.string().min(1).max(200),
  status:    z.enum(['draft', 'ready', 'presented', 'follow_up'] as const).optional(),
  canva_url: z.string().url().optional(),
})

export async function GET() {
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })

  const admin = createSupabaseAdminClient()
  const { data, error } = await admin
    .from('presentations')
    .select('*, clients(id, name, industry)')
    .order('updated_at', { ascending: false })

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
    .from('presentations')
    .insert({ ...parsed.data, status: parsed.data.status ?? 'draft' })
    .select('*, clients(id, name, industry)')
    .single()

  if (error) return NextResponse.json({ error: 'Błąd zapisu' }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
