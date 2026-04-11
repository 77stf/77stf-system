import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })

  const { id } = await params
  const admin = createSupabaseAdminClient()

  const { data } = await admin
    .from('agent_conversations')
    .select('id, title, messages, updated_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!data) return NextResponse.json({ error: 'Nie znaleziono' }, { status: 404 })

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

  await admin.from('agent_conversations').delete().eq('id', id).eq('user_id', user.id)

  return NextResponse.json({ ok: true })
}
