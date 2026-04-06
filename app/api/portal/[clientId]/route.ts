import { NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase'

// GET /api/portal/[clientId]
// Returns client portal data. Accessible by:
// - Admin (any client)
// - Client user linked via client_contacts table

export async function GET(
  req: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params

  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })

  const supabase = createSupabaseAdminClient()

  // Check access: is user linked to this client OR is admin?
  const { data: contact } = await supabase
    .from('client_contacts')
    .select('client_id')
    .eq('user_id', user.id)
    .eq('client_id', clientId)
    .maybeSingle()

  const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim()).filter(Boolean)
  const isAdmin = adminEmails.includes(user.email ?? '')

  if (!contact && !isAdmin) {
    return NextResponse.json({ error: 'Brak dostępu do tego portalu.' }, { status: 403 })
  }

  // Fetch all portal data in parallel
  const [
    { data: client },
    { data: stack },
    { data: quotes },
    { data: audits },
  ] = await Promise.all([
    supabase.from('clients')
      .select('id, name, industry, status, owner_name, owner_email, owner_phone')
      .eq('id', clientId)
      .single(),
    supabase.from('stack_items')
      .select('id, name, category, status, description, monthly_value_pln')
      .eq('client_id', clientId)
      .order('status')
      .order('name'),
    supabase.from('quotes')
      .select('id, title, status, setup_fee, monthly_fee, valid_until, created_at, updated_at')
      .eq('client_id', clientId)
      .neq('status', 'draft')
      .order('created_at', { ascending: false }),
    supabase.from('audits')
      .select('id, title, status, score, ai_summary, completed_at')
      .eq('client_id', clientId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1),
  ])

  if (!client) return NextResponse.json({ error: 'Nie znaleziono klienta.' }, { status: 404 })

  return NextResponse.json({
    client,
    stack: stack ?? [],
    quotes: quotes ?? [],
    audit: audits?.[0] ?? null,
  })
}
