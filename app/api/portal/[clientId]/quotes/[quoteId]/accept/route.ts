import { NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase'

// POST /api/portal/[clientId]/quotes/[quoteId]/accept
// Client accepts a quote — sets status to 'accepted' and records accepted_at

export async function POST(
  req: Request,
  { params }: { params: Promise<{ clientId: string; quoteId: string }> }
) {
  const { clientId, quoteId } = await params

  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })

  const supabase = createSupabaseAdminClient()

  // Verify access
  const { data: contact } = await supabase
    .from('client_contacts')
    .select('client_id')
    .eq('user_id', user.id)
    .eq('client_id', clientId)
    .maybeSingle()

  const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim()).filter(Boolean)
  const isAdmin = adminEmails.includes(user.email ?? '')

  if (!contact && !isAdmin) {
    return NextResponse.json({ error: 'Brak dostępu.' }, { status: 403 })
  }

  // Verify quote belongs to client and is in 'sent' status
  const { data: quote } = await supabase
    .from('quotes')
    .select('id, status, client_id')
    .eq('id', quoteId)
    .eq('client_id', clientId)
    .single()

  if (!quote) return NextResponse.json({ error: 'Nie znaleziono wyceny.' }, { status: 404 })
  if (quote.status !== 'sent') {
    return NextResponse.json({ error: 'Wycena nie może zostać zaakceptowana w tym stanie.' }, { status: 400 })
  }

  const { error } = await supabase
    .from('quotes')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', quoteId)

  if (error) return NextResponse.json({ error: 'Błąd zapisu.' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
