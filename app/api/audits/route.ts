import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase'
import { CreateAuditSchema } from '@/lib/validation'

// GET /api/audits — list all audits, optionally filtered by client_id
export async function GET(req: NextRequest) {
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })

  const supabase = createSupabaseAdminClient()
  const clientId = req.nextUrl.searchParams.get('client_id')

  try {
    let query = supabase
      .from('audits')
      .select('id, client_id, title, status, score, ai_summary, quote_id, created_at, updated_at, completed_at, client:clients(id, name, industry, status)')
      .order('created_at', { ascending: false })

    if (clientId) query = query.eq('client_id', clientId)

    const { data, error } = await query

    if (error) {
      if (error.code === '42P01') return NextResponse.json({ audits: [], table_missing: true })
      return NextResponse.json({ error: 'Wewnętrzny błąd serwera' }, { status: 500 })
    }

    return NextResponse.json({ audits: data ?? [] })
  } catch {
    return NextResponse.json({ audits: [], table_missing: true })
  }
}

// POST /api/audits — create new audit
export async function POST(req: NextRequest) {
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })

  let rawBody: unknown
  try { rawBody = await req.json() }
  catch { return NextResponse.json({ error: 'Nieprawidłowy format danych' }, { status: 400 }) }

  const parsed = CreateAuditSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Nieprawidłowe dane', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { client_id, title } = parsed.data
  const supabase = createSupabaseAdminClient()

  try {
    const { data, error } = await supabase
      .from('audits')
      .insert({
        client_id,
        title: title || 'Audyt Operacyjny',
        status: 'draft',
        answers: {},
      })
      .select('*, client:clients(id, name, industry, status)')
      .single()

    if (error) {
      if (error.code === '42P01') return NextResponse.json({ error: 'Tabela audytów nie istnieje' }, { status: 503 })
      void supabase.from('error_log').insert({ source: 'api/audits POST', message: error.message, metadata: { client_id } })
      return NextResponse.json({ error: 'Wewnętrzny błąd serwera' }, { status: 500 })
    }

    return NextResponse.json({ audit: data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Wewnętrzny błąd serwera' }, { status: 500 })
  }
}
