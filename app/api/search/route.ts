import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  // Auth check
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const q = req.nextUrl.searchParams.get('q')?.toLowerCase().trim() ?? ''

  if (!q || q.length < 1) {
    return NextResponse.json({ clients: [] })
  }

  const supabase = authClient
  const { data } = await supabase
    .from('clients')
    .select('id, name, industry, status')
    .or(`name.ilike.%${q}%,industry.ilike.%${q}%`)
    .limit(6)

  return NextResponse.json({ clients: data ?? [] })
}
