import { NextResponse } from 'next/server'
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase'

interface RouteParams { params: Promise<{ id: string }> }

// GET /api/clients/[id]
export async function GET(_req: Request, { params }: RouteParams) {
  const { id } = await params

  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })

  const supabase = createSupabaseAdminClient()
  const { data: client, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !client) {
    return NextResponse.json({ error: 'Klient nie istnieje' }, { status: 404 })
  }

  return NextResponse.json({ client })
}

// PATCH /api/clients/[id] — update client profile fields
export async function PATCH(req: Request, { params }: RouteParams) {
  const { id } = await params

  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })

  let body: unknown
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Nieprawidłowy format danych' }, { status: 400 }) }

  const b = body as Record<string, unknown>
  const validStatuses = ['lead', 'active', 'partner', 'closed']

  const updates: Record<string, unknown> = {}
  if (typeof b.name === 'string' && b.name.trim()) updates.name = b.name.trim()
  if (typeof b.industry === 'string') updates.industry = b.industry.trim() || null
  if (typeof b.size === 'string') updates.size = b.size.trim() || null
  if (typeof b.owner_name === 'string') updates.owner_name = b.owner_name.trim() || null
  if (typeof b.owner_email === 'string') updates.owner_email = b.owner_email.trim() || null
  if (typeof b.owner_phone === 'string') updates.owner_phone = b.owner_phone.trim() || null
  if (typeof b.source === 'string') updates.source = b.source.trim() || null
  if (typeof b.notes === 'string') updates.notes = b.notes.trim() || null
  if (typeof b.status === 'string' && validStatuses.includes(b.status)) updates.status = b.status

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Brak danych do aktualizacji' }, { status: 400 })
  }

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from('clients')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    void supabase.from('error_log').insert({ source: 'api/clients/[id] PATCH', message: error.message })
    return NextResponse.json({ error: 'Wewnętrzny błąd serwera' }, { status: 500 })
  }

  return NextResponse.json({ client: data })
}

// DELETE /api/clients/[id] — permanently delete a client and all related data (CASCADE)
export async function DELETE(_req: Request, { params }: RouteParams) {
  const { id } = await params

  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })

  const supabase = createSupabaseAdminClient()
  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', id)

  if (error) {
    void supabase.from('error_log').insert({ source: 'api/clients/[id] DELETE', message: error.message })
    return NextResponse.json({ error: 'Wewnętrzny błąd serwera' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
