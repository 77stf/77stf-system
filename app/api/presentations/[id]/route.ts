import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase'
import { z } from 'zod'

const patchSchema = z.object({
  title:        z.string().min(1).max(200).optional(),
  status:       z.enum(['draft', 'ready', 'presented', 'follow_up'] as const).optional(),
  slides_data:  z.array(z.record(z.string(), z.unknown())).optional(),
  qa_log:       z.array(z.record(z.string(), z.unknown())).optional(),
  feedback:     z.string().optional(),
  canva_url:    z.string().optional(),
  presented_at: z.string().optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })

  const { id } = await params
  const admin = createSupabaseAdminClient()

  const { data, error } = await admin
    .from('presentations')
    .select('*, clients(id, name, industry, owner_name)')
    .eq('id', id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Nie znaleziono' }, { status: 404 })
  return NextResponse.json({ data })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Nieprawidłowe dane' }, { status: 400 })

  const admin = createSupabaseAdminClient()
  const { data, error } = await admin
    .from('presentations')
    .update(parsed.data)
    .eq('id', id)
    .select('*, clients(id, name, industry)')
    .single()

  if (error) return NextResponse.json({ error: 'Błąd aktualizacji' }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })

  const { id } = await params
  const admin = createSupabaseAdminClient()
  await admin.from('presentations').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
