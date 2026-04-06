import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'
import { createSupabaseAdminClient } from '@/lib/supabase'

// GET /api/intelligence/radar — list recent digests
export async function GET() {
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })

  const supabase = createSupabaseAdminClient()

  const { data, error } = await supabase
    .from('intelligence_digests')
    .select('id, generated_at, source_count, categories, highlights, trigger, metadata, model')
    .order('generated_at', { ascending: false })
    .limit(10)

  if (error) {
    return NextResponse.json({ error: 'Wewnętrzny błąd serwera' }, { status: 500 })
  }

  return NextResponse.json({ digests: data ?? [] })
}
