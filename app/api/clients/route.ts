import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import { ClientStatus } from '@/lib/types'

// POST /api/clients — create a new client
export async function POST(request: Request) {
  // Auth check
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()

    const {
      name,
      industry,
      size,
      owner_name,
      owner_email,
      owner_phone,
      status,
      source,
      notes,
    } = body as {
      name: string
      industry?: string
      size?: string
      owner_name?: string
      owner_email?: string
      owner_phone?: string
      status: ClientStatus
      source?: string
      notes?: string
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Nazwa firmy jest wymagana' },
        { status: 400 }
      )
    }

    const validStatuses: ClientStatus[] = ['lead', 'active', 'partner', 'closed']
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Nieprawidłowy status klienta' },
        { status: 400 }
      )
    }

    // Generate a simple client token for portal access (will be used in Etap 4)
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
      console.error('Supabase insert error:', error)
      return NextResponse.json(
        { error: 'Błąd bazy danych: ' + error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ client: data }, { status: 201 })
  } catch (err) {
    console.error('POST /api/clients error:', err)
    return NextResponse.json(
      { error: 'Wewnętrzny błąd serwera' },
      { status: 500 }
    )
  }
}
