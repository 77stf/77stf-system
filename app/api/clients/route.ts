import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import { CreateClientSchema } from '@/lib/validation'

// POST /api/clients — create a new client
export async function POST(request: Request) {
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })

  let rawBody: unknown
  try { rawBody = await request.json() }
  catch { return NextResponse.json({ error: 'Nieprawidłowy format danych' }, { status: 400 }) }

  const parsed = CreateClientSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Nieprawidłowe dane', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { name, industry, size, owner_name, owner_email, owner_phone, status, source, notes } = parsed.data
  const client_token = crypto.randomUUID()

  const supabase = createSupabaseAdminClient()

  const { data, error } = await supabase
    .from('clients')
    .insert({
      name: name.trim(),
      industry: industry?.trim() || null,
      size: size?.trim() || null,
      owner_name: owner_name?.trim() || null,
      owner_email: owner_email?.trim() || null,
      owner_phone: owner_phone?.trim() || null,
      status,
      source: source?.trim() || null,
      notes: notes?.trim() || null,
      client_token,
    })
    .select()
    .single()

  if (error) {
    void supabase.from('error_log').insert({ source: 'api/clients POST', message: error.message })
    return NextResponse.json({ error: 'Wewnętrzny błąd serwera' }, { status: 500 })
  }

  return NextResponse.json({ client: data }, { status: 201 })
}
