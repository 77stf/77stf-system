import { NextResponse } from 'next/server'
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase'

// GET /api/intelligence/stack
// Returns ALL stack_items across ALL clients with client info — for the global Obsidian-style map
export async function GET() {
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })

  const supabase = createSupabaseAdminClient()

  const [{ data: items, error: itemsError }, { data: clients, error: clientsError }] = await Promise.all([
    supabase.from('stack_items').select('*').order('created_at', { ascending: true }),
    supabase.from('clients').select('id, name, status, industry').order('name'),
  ])

  if (itemsError || clientsError) {
    const msg = itemsError?.message ?? clientsError?.message ?? 'unknown'
    void supabase.from('error_log').insert({ source: 'api/intelligence/stack GET', message: msg })
    return NextResponse.json({ error: 'Wewnętrzny błąd serwera' }, { status: 500 })
  }

  // Summary stats
  const total = items?.length ?? 0
  const live = items?.filter(i => i.status === 'live').length ?? 0
  const inProgress = items?.filter(i => i.status === 'in_progress').length ?? 0
  const errors = items?.filter(i => i.status === 'error').length ?? 0
  const monthlyValue = items
    ?.filter(i => i.status === 'live' && i.monthly_value_pln)
    .reduce((s, i) => s + (i.monthly_value_pln ?? 0), 0) ?? 0

  return NextResponse.json({
    items: items ?? [],
    clients: clients ?? [],
    stats: { total, live, inProgress, errors, monthlyValue },
  })
}
