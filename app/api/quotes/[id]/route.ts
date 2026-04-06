import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase'
import { QuoteStatus, QuoteItemCategory } from '@/lib/types'

interface RouteContext {
  params: Promise<{ id: string }>
}

// GET /api/quotes/[id] — get single quote with items and client
export async function GET(_req: NextRequest, { params }: RouteContext) {
  // Auth check
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })
  }

  const { id } = await params
  const supabase = createSupabaseAdminClient()

  try {
    const { data, error } = await supabase
      .from('quotes')
      .select(`
        *,
        client:clients ( id, name, industry, status ),
        items:quote_items ( * )
      `)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json({ error: 'Tabela wycen nie istnieje' }, { status: 503 })
      }
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Wycena nie istnieje' }, { status: 404 })
      }
      return NextResponse.json({ error: 'Wewnętrzny błąd serwera' }, { status: 500 })
    }

    return NextResponse.json({ quote: data })
  } catch {
    return NextResponse.json({ error: 'Wewnętrzny błąd serwera' }, { status: 500 })
  }
}

// PATCH /api/quotes/[id] — update quote fields and optionally replace items
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  // Auth check
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })
  }

  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowy JSON' }, { status: 400 })
  }

  const {
    status,
    title,
    valid_until,
    discount_pct,
    notes,
    items,
  } = body as {
    status?: QuoteStatus
    title?: string
    valid_until?: string
    discount_pct?: number
    notes?: string
    items?: Array<{
      id?: string
      name: string
      description?: string
      category: QuoteItemCategory | string
      price: number
      quantity?: number
      sort_order?: number
    }>
  }

  const supabase = createSupabaseAdminClient()

  try {
    // Fetch current quote to check existing timestamps
    const { data: existing, error: fetchErr } = await supabase
      .from('quotes')
      .select('id, status, sent_at, accepted_at')
      .eq('id', id)
      .single()

    if (fetchErr) {
      if (fetchErr.code === '42P01' || fetchErr.message?.includes('does not exist')) {
        return NextResponse.json({ error: 'Tabela wycen nie istnieje' }, { status: 503 })
      }
      if (fetchErr.code === 'PGRST116') {
        return NextResponse.json({ error: 'Wycena nie istnieje' }, { status: 404 })
      }
      return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    }

    // Build the update payload — only include fields that were provided
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (title !== undefined) updatePayload.title = title.trim()
    if (valid_until !== undefined) updatePayload.valid_until = valid_until
    if (discount_pct !== undefined) updatePayload.discount_pct = discount_pct
    if (notes !== undefined) updatePayload.notes = notes.trim()

    if (status !== undefined) {
      const validStatuses: QuoteStatus[] = ['draft', 'sent', 'accepted', 'rejected', 'expired']
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: 'Nieprawidłowy status wyceny' }, { status: 400 })
      }
      updatePayload.status = status

      // Set sent_at on first transition to 'sent'
      if (status === 'sent' && !existing.sent_at) {
        updatePayload.sent_at = new Date().toISOString()
      }

      // Set accepted_at on transition to 'accepted'
      if (status === 'accepted') {
        updatePayload.accepted_at = new Date().toISOString()
      }
    }

    // If items provided: replace all items and recompute fees
    if (Array.isArray(items) && items.length > 0) {
      // Delete existing items
      const { error: deleteErr } = await supabase
        .from('quote_items')
        .delete()
        .eq('quote_id', id)

      if (deleteErr) {
        supabase.from('error_log').insert({
          source: 'api/quotes/[id] PATCH (delete items)',
          message: deleteErr.message,
          metadata: { quote_id: id },
        })

        return NextResponse.json({ error: deleteErr.message }, { status: 500 })
      }

      // Re-insert items
      const itemRows = items.map((item, index) => ({
        quote_id: id,
        name: item.name,
        description: item.description ?? null,
        category: item.category,
        price: item.price,
        quantity: item.quantity ?? 1,
        sort_order: item.sort_order ?? index,
      }))

      const { error: insertErr } = await supabase
        .from('quote_items')
        .insert(itemRows)

      if (insertErr) {
        supabase.from('error_log').insert({
          source: 'api/quotes/[id] PATCH (insert items)',
          message: insertErr.message,
          metadata: { quote_id: id },
        })

        return NextResponse.json({ error: insertErr.message }, { status: 500 })
      }

      // Recompute fees
      updatePayload.setup_fee = items.reduce((sum, item) => {
        if (item.category === 'setup') {
          return sum + (item.price * (item.quantity ?? 1))
        }
        return sum
      }, 0)

      updatePayload.monthly_fee = items.reduce((sum, item) => {
        if (item.category === 'monthly') {
          return sum + (item.price * (item.quantity ?? 1))
        }
        return sum
      }, 0)
    }

    // Apply quote update
    const { error: updateErr } = await supabase
      .from('quotes')
      .update(updatePayload)
      .eq('id', id)

    if (updateErr) {
      supabase.from('error_log').insert({
        source: 'api/quotes/[id] PATCH',
        message: updateErr.message,
        metadata: { quote_id: id },
      })

      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    // Return updated quote with joined data
    const { data: updatedQuote, error: refetchErr } = await supabase
      .from('quotes')
      .select(`
        *,
        client:clients ( id, name, industry, status ),
        items:quote_items ( * )
      `)
      .eq('id', id)
      .single()

    if (refetchErr) {
      return NextResponse.json({ error: refetchErr.message }, { status: 500 })
    }

    return NextResponse.json({ quote: updatedQuote })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Nieznany błąd serwera'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE /api/quotes/[id] — delete quote (cascade deletes items via FK constraint)
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  // Auth check
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })
  }

  const { id } = await params
  const supabase = createSupabaseAdminClient()

  try {
    const { error } = await supabase
      .from('quotes')
      .delete()
      .eq('id', id)

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json({ error: 'Tabela wycen nie istnieje' }, { status: 503 })
      }
      supabase.from('error_log').insert({
        source: 'api/quotes/[id] DELETE',
        message: error.message,
        metadata: { quote_id: id },
      })

      return NextResponse.json({ error: 'Wewnętrzny błąd serwera' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Nieznany błąd serwera'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
