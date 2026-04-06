import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase'

// GET /api/errors — fetch recent error_log entries
export async function GET(req: NextRequest) {
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200)

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from('error_log')
    .select('id, source, message, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: 'Wewnętrzny błąd serwera' }, { status: 500 })

  return NextResponse.json({ errors: data ?? [] })
}

// DELETE /api/errors — clear all logs (admin only)
export async function DELETE(_req: NextRequest) {
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })

  // Admin-only: check against env allowlist
  const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim()).filter(Boolean)
  if (adminEmails.length > 0 && !adminEmails.includes(user.email ?? '')) {
    return NextResponse.json({ error: 'Tylko administrator może wyczyścić logi' }, { status: 403 })
  }

  const supabase = createSupabaseAdminClient()
  const { error } = await supabase
    .from('error_log')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')

  if (error) return NextResponse.json({ error: 'Wewnętrzny błąd serwera' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
