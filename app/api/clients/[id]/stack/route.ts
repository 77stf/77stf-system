import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import type { StackItem } from '@/lib/types'

interface RouteParams { params: Promise<{ id: string }> }

// GET /api/clients/[id]/stack — fetch all stack items for a client
export async function GET(_req: Request, { params }: RouteParams) {
  const { id } = await params

  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from('stack_items')
    .select('*')
    .eq('client_id', id)
    .order('created_at', { ascending: true })

  if (error) {
    void supabase.from('error_log').insert({ source: 'api/clients/[id]/stack GET', message: error.message })
    return NextResponse.json({ error: 'Wewnętrzny błąd serwera' }, { status: 500 })
  }

  return NextResponse.json({ items: data as StackItem[] })
}

// POST /api/clients/[id]/stack — create a new stack item
export async function POST(req: Request, { params }: RouteParams) {
  const { id } = await params

  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })

  let body: unknown
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Nieprawidłowy format danych' }, { status: 400 }) }

  const b = body as Record<string, unknown>

  if (!b.name || typeof b.name !== 'string' || !b.name.trim()) {
    return NextResponse.json({ error: 'Nazwa jest wymagana' }, { status: 400 })
  }

  const validCategories = ['automation', 'integration', 'ai_agent', 'data', 'voice', 'reporting']
  const validStatuses = ['idea', 'planned', 'in_progress', 'live', 'deprecated', 'error']

  const category = validCategories.includes(b.category as string) ? b.category : 'automation'
  const status = validStatuses.includes(b.status as string) ? b.status : 'idea'

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from('stack_items')
    .insert({
      client_id: id,
      name: (b.name as string).trim(),
      category,
      status,
      description: typeof b.description === 'string' ? b.description.trim() || null : null,
      implementation_id: typeof b.implementation_id === 'string' ? b.implementation_id : null,
      automation_id: typeof b.automation_id === 'string' ? b.automation_id : null,
      quote_item_id: typeof b.quote_item_id === 'string' ? b.quote_item_id : null,
      monthly_value_pln: typeof b.monthly_value_pln === 'number' ? b.monthly_value_pln : null,
      setup_cost_pln: typeof b.setup_cost_pln === 'number' ? b.setup_cost_pln : null,
      depends_on: Array.isArray(b.depends_on) ? b.depends_on : [],
      metadata: typeof b.metadata === 'object' && b.metadata !== null ? b.metadata : {},
    })
    .select()
    .single()

  if (error) {
    void supabase.from('error_log').insert({ source: 'api/clients/[id]/stack POST', message: error.message })
    return NextResponse.json({ error: 'Wewnętrzny błąd serwera' }, { status: 500 })
  }

  return NextResponse.json({ item: data }, { status: 201 })
}

// PATCH /api/clients/[id]/stack — update a stack item (body must include id)
export async function PATCH(req: Request, { params }: RouteParams) {
  const { id: clientId } = await params

  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })

  let body: unknown
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Nieprawidłowy format danych' }, { status: 400 }) }

  const b = body as Record<string, unknown>
  if (!b.id || typeof b.id !== 'string') {
    return NextResponse.json({ error: 'ID elementu jest wymagane' }, { status: 400 })
  }

  const validCategories = ['automation', 'integration', 'ai_agent', 'data', 'voice', 'reporting']
  const validStatuses = ['idea', 'planned', 'in_progress', 'live', 'deprecated', 'error']

  const updates: Record<string, unknown> = {}
  if (typeof b.name === 'string' && b.name.trim()) updates.name = b.name.trim()
  if (typeof b.description === 'string') updates.description = b.description.trim() || null
  if (typeof b.category === 'string' && validCategories.includes(b.category)) updates.category = b.category
  if (typeof b.status === 'string' && validStatuses.includes(b.status)) updates.status = b.status
  if (typeof b.monthly_value_pln === 'number') updates.monthly_value_pln = b.monthly_value_pln
  if (typeof b.setup_cost_pln === 'number') updates.setup_cost_pln = b.setup_cost_pln
  if (Array.isArray(b.depends_on)) updates.depends_on = b.depends_on

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Brak danych do aktualizacji' }, { status: 400 })
  }

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from('stack_items')
    .update(updates)
    .eq('id', b.id)
    .eq('client_id', clientId)
    .select()
    .single()

  if (error) {
    void supabase.from('error_log').insert({ source: 'api/clients/[id]/stack PATCH', message: error.message })
    return NextResponse.json({ error: 'Wewnętrzny błąd serwera' }, { status: 500 })
  }

  return NextResponse.json({ item: data })
}

// DELETE /api/clients/[id]/stack?itemId=xxx
export async function DELETE(req: Request, { params }: RouteParams) {
  const { id: clientId } = await params
  const { searchParams } = new URL(req.url)
  const itemId = searchParams.get('itemId')

  if (!itemId) return NextResponse.json({ error: 'itemId jest wymagane' }, { status: 400 })

  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })

  const supabase = createSupabaseAdminClient()
  const { error } = await supabase
    .from('stack_items')
    .delete()
    .eq('id', itemId)
    .eq('client_id', clientId)

  if (error) {
    void supabase.from('error_log').insert({ source: 'api/clients/[id]/stack DELETE', message: error.message })
    return NextResponse.json({ error: 'Wewnętrzny błąd serwera' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
