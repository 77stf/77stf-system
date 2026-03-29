import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase'
import { QuoteItemCategory } from '@/lib/types'

// GET /api/quotes — list all quotes, optionally filtered by client_id
export async function GET(req: NextRequest) {
  // Auth check
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })
  }

  const supabase = createSupabaseAdminClient()
  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get('client_id')

  try {
    let query = supabase
      .from('quotes')
      .select(`
        *,
        client:clients ( id, name, industry, status ),
        items:quote_items ( * )
      `)
      .order('created_at', { ascending: false })

    if (clientId) {
      query = query.eq('client_id', clientId)
    }

    const { data, error } = await query

    if (error) {
      // Gracefully handle missing tables
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json({ quotes: [], table_missing: true })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ quotes: data ?? [] })
  } catch {
    return NextResponse.json({ quotes: [], table_missing: true })
  }
}

// POST /api/quotes — create new quote with items
export async function POST(req: NextRequest) {
  // Auth check
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowy JSON' }, { status: 400 })
  }

  const {
    client_id,
    title,
    valid_until,
    discount_pct,
    notes,
    items,
  } = body as {
    client_id?: string
    title?: string
    valid_until?: string
    discount_pct?: number
    notes?: string
    items?: Array<{
      name: string
      description?: string
      category: QuoteItemCategory
      price: number
      quantity?: number
      sort_order?: number
    }>
  }

  // Validation
  if (!client_id || typeof client_id !== 'string' || client_id.trim().length === 0) {
    return NextResponse.json({ error: 'client_id jest wymagany' }, { status: 400 })
  }
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return NextResponse.json({ error: 'Tytuł wyceny jest wymagany' }, { status: 400 })
  }
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'Wycena musi zawierać co najmniej jedną pozycję' }, { status: 400 })
  }

  // Compute fees
  const setup_fee = items.reduce((sum, item) => {
    if (item.category === 'setup') {
      return sum + (item.price * (item.quantity ?? 1))
    }
    return sum
  }, 0)

  const monthly_fee = items.reduce((sum, item) => {
    if (item.category === 'monthly') {
      return sum + (item.price * (item.quantity ?? 1))
    }
    return sum
  }, 0)

  const supabase = createSupabaseAdminClient()

  try {
    // Insert quote
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .insert({
        client_id: client_id.trim(),
        title: title.trim(),
        status: 'draft',
        valid_until: valid_until ?? null,
        setup_fee,
        monthly_fee,
        discount_pct: discount_pct ?? 0,
        notes: notes?.trim() ?? null,
      })
      .select()
      .single()

    if (quoteError) {
      if (quoteError.code === '42P01' || quoteError.message?.includes('does not exist')) {
        return NextResponse.json({ error: 'Tabela wycen nie istnieje' }, { status: 503 })
      }
      supabase.from('error_log').insert({
        source: 'api/quotes POST',
        message: quoteError.message,
        metadata: { client_id, title },
      })

      return NextResponse.json({ error: quoteError.message }, { status: 500 })
    }

    // Insert all items with quote_id
    const itemRows = items.map((item, index) => ({
      quote_id: quote.id,
      name: item.name,
      description: item.description ?? null,
      category: item.category,
      price: item.price,
      quantity: item.quantity ?? 1,
      sort_order: item.sort_order ?? index,
    }))

    const { error: itemsError } = await supabase
      .from('quote_items')
      .insert(itemRows)

    if (itemsError) {
      // Attempt to clean up the orphaned quote
      await supabase.from('quotes').delete().eq('id', quote.id)
      supabase.from('error_log').insert({
        source: 'api/quotes POST (items)',
        message: itemsError.message,
        metadata: { quote_id: quote.id },
      })

      return NextResponse.json({ error: itemsError.message }, { status: 500 })
    }

    // Re-fetch full quote with joined data
    const { data: fullQuote, error: fetchError } = await supabase
      .from('quotes')
      .select(`
        *,
        client:clients ( id, name, industry, status ),
        items:quote_items ( * )
      `)
      .eq('id', quote.id)
      .single()

    if (fetchError) {
      // Return minimal quote — insert succeeded
      return NextResponse.json({ quote }, { status: 201 })
    }

    return NextResponse.json({ quote: fullQuote }, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Nieznany błąd serwera'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
