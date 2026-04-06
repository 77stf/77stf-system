import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase'
import type { AuditImplementation, AuditImplementationVariant } from '@/lib/types'

interface RouteContext { params: Promise<{ id: string }> }

// POST /api/audits/[id]/create-quote
// Body: { variant_selections: Record<string, 'A' | 'B' | 'C'> }
export async function POST(req: NextRequest, { params }: RouteContext) {
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })

  const { id } = await params
  const supabase = createSupabaseAdminClient()

  let body: { variant_selections?: Record<string, 'A' | 'B' | 'C'> }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Nieprawidłowy JSON' }, { status: 400 }) }

  const { variant_selections = {} } = body

  // Fetch audit with client data
  const { data: audit, error: auditError } = await supabase
    .from('audits')
    .select('id, implementations, client_id, client:clients(id, name)')
    .eq('id', id)
    .single()

  if (auditError || !audit) {
    return NextResponse.json({ error: 'Audyt nie istnieje' }, { status: 404 })
  }

  const implementations: AuditImplementation[] = Array.isArray(audit.implementations)
    ? audit.implementations
    : []

  if (implementations.length === 0) {
    return NextResponse.json({ error: 'Brak wdrożeń w audycie. Najpierw uruchom analizę AI.' }, { status: 400 })
  }

  const clientName = (audit.client as { name?: string } | null)?.name ?? 'Klient'
  const clientId: string = audit.client_id

  // Build quote items from selected variants
  // variant_selections: key = implementation name (or index), value = 'A' | 'B' | 'C'
  // We key by implementation.name for reliability
  const VARIANT_INDEX: Record<'A' | 'B' | 'C', number> = { A: 0, B: 1, C: 2 }

  let totalSetup = 0
  let totalMonthly = 0

  const quoteItemsPayload: Array<{
    name: string
    description: string
    category: 'setup' | 'monthly'
    price: number
    quantity: number
    sort_order: number
  }> = []

  implementations.forEach((impl, idx) => {
    const selectedVariant: 'A' | 'B' | 'C' =
      variant_selections[impl.name] ?? impl.recommended_variant ?? 'B'
    const variantIndex = VARIANT_INDEX[selectedVariant]
    const variant: AuditImplementationVariant | undefined = impl.variants?.[variantIndex]

    if (!variant) return

    const setupPrice = variant.setup_pln ?? 0
    const monthlyPrice = variant.monthly_pln ?? 0
    const variantLabel = `Wariant ${selectedVariant}`
    const sortBase = idx * 2

    totalSetup += setupPrice
    totalMonthly += monthlyPrice

    if (setupPrice > 0) {
      quoteItemsPayload.push({
        name: `${impl.name} — ${variantLabel} (wdrożenie)`,
        description: `${variant.scope} | ROI: ${impl.annual_roi_pln?.toLocaleString('pl-PL') ?? '—'} PLN/rok | Zwrot: ${impl.payback_months ?? '—'} mies.`,
        category: 'setup',
        price: setupPrice,
        quantity: 1,
        sort_order: sortBase,
      })
    }

    if (monthlyPrice > 0) {
      quoteItemsPayload.push({
        name: `${impl.name} — ${variantLabel} (opieka miesięczna)`,
        description: variant.what_you_get?.slice(0, 2).join(', ') ?? '',
        category: 'monthly',
        price: monthlyPrice,
        quantity: 1,
        sort_order: sortBase + 1,
      })
    }
  })

  if (quoteItemsPayload.length === 0) {
    return NextResponse.json({ error: 'Żadne wdrożenie nie ma ceny w wybranych wariantach.' }, { status: 400 })
  }

  // Create quote row
  const today = new Date()
  const validUntil = new Date(today)
  validUntil.setDate(validUntil.getDate() + 30)

  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .insert({
      client_id: clientId,
      title: `Wycena po Audycie — ${clientName}`,
      status: 'draft',
      setup_fee: totalSetup,
      monthly_fee: totalMonthly,
      valid_until: validUntil.toISOString().split('T')[0],
    })
    .select('id')
    .single()

  if (quoteError || !quote) {
    return NextResponse.json({ error: quoteError?.message ?? 'Błąd tworzenia wyceny' }, { status: 500 })
  }

  // Insert all quote items
  const itemsWithQuoteId = quoteItemsPayload.map((item) => ({
    ...item,
    quote_id: quote.id,
  }))

  const { error: itemsError } = await supabase
    .from('quote_items')
    .insert(itemsWithQuoteId)

  if (itemsError) {
    // Clean up quote on failure
    await supabase.from('quotes').delete().eq('id', quote.id)
    return NextResponse.json({ error: 'Wewnętrzny błąd serwera' }, { status: 500 })
  }

  // Link audit → quote
  await supabase
    .from('audits')
    .update({ quote_id: quote.id })
    .eq('id', id)

  return NextResponse.json({ quote_id: quote.id, total_setup: totalSetup, total_monthly: totalMonthly })
}
