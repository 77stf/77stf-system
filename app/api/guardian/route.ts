import { NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase'

// GET /api/guardian — list recent reports
export async function GET() {
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })

  const supabase = createSupabaseAdminClient()

  const { data, error } = await supabase
    .from('guardian_reports')
    .select('id, generated_at, summary, alert_count, critical, warnings, trigger, alerts')
    .order('generated_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: 'Wewnętrzny błąd serwera' }, { status: 500 })

  return NextResponse.json({ reports: data ?? [] })
}
