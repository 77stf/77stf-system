import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase'
import { CreateQuoteSchema } from '@/lib/validation'

// GET /api/quotes — list all quotes, optionally filtered by client_id
export async function GET(req: NextRequest) {
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })

  const supabase = createSupabaseAdminClient()
  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get('client_id')

  try {
    let query = supabase
      .from('quotes')
      .select(`*, client:clients ( id, name, industry, status ), items:quote_items ( * )`)
      .order('created_at', { ascending: false })

    if (clientId) query = query.eq('client_id', clientId)

    const { data, error } = await query

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json({ quotes: [], table_missing: true })
      }
      return NextResponse.json({ error: 'Wewnętrzny błąd serwera' }, { status: 500 })
    }

    return NextResponse.json({ quotes: data ?? [] })
  } catch {
    return NextResponse.json({ quotes: [], table_missing: true })
  }
}

// POST /api/quotes — create new quote with items
export async function POST(req: NextRequest) {
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })

  let rawBody: unknown
  try { rawBody = await req.json() }
  catch { return NextResponse.json({ error: 'Nieprawidłowy format danych' }, { status: 400 }) }

  const parsed = CreateQuoteSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Nieprawidłowe dane', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { client_id, title, valid_until, discount_pct, items } = parsed.data

  const setup_fee = items.reduce((sum, item) =>
    item.category === 'setup' ? sum + item.price * (item.quantity ?? 1) : sum, 0)
  const monthly_fee = items.reduce((sum, item) =>
    item.category === 'monthly' ? sum + item.price * (item.quantity ?? 1) : sum, 0)

  const supabase = createSupabaseAdminClient()

  try {
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .insert({
        client_id,
        title: title.trim(),
        status: 'draft',
        valid_until: valid_until ?? null,
        setup_fee,
        monthly_fee,
        discount_pct: discount_pct ?? 0,
      })
      .select()
      .single()

    if (quoteError) {
      if (quoteError.code === '42P01' || quoteError.message?.includes('does not exist')) {
        return NextResponse.json({ error: 'Tabela wycen nie istnieje' }, { status: 503 })
      }
      void supabase.from('error_log').insert({ source: 'api/quotes POST', message: quoteError.message, metadata: { client_id, title } })
      return NextResponse.json({ error: 'Wewnętrzny błąd serwera' }, { status: 500 })
    }

    const itemRows = items.map((item, index) => ({
      quote_id: quote.id,
      name: item.name,
      description: item.description ?? null,
      category: item.category,
      price: item.price,
      quantity: item.quantity ?? 1,
      sort_order: item.sort_order ?? index,
    }))

    const { error: itemsError } = await supabase.from('quote_items').insert(itemRows)

    if (itemsError) {
      await supabase.from('quotes').delete().eq('id', quote.id)
      void supabase.from('error_log').insert({ source: 'api/quotes POST (items)', message: itemsError.message, metadata: { quote_id: quote.id } })
      return NextResponse.json({ error: 'Wewnętrzny błąd serwera' }, { status: 500 })
    }

    const { data: fullQuote } = await supabase
      .from('quotes')
      .select(`*, client:clients ( id, name, industry, status ), items:quote_items ( * )`)
      .eq('id', quote.id)
      .single()

    return NextResponse.json({ quote: fullQuote ?? quote }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Wewnętrzny błąd serwera' }, { status: 500 })
  }
}
