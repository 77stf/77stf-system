import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase'

export async function GET() {
  const admin = createSupabaseAdminClient()
  const { data: { user } } = await admin.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })

  const { data: clients } = await admin
    .from('clients')
    .select('id, pipeline_stage, created_at')

  const stages = ['discovery', 'audit', 'proposal', 'negotiation', 'onboarding', 'active', 'partner']
  const counts = stages.reduce((acc, s) => {
    acc[s] = (clients ?? []).filter(c => (c.pipeline_stage ?? 'discovery') === s).length
    return acc
  }, {} as Record<string, number>)

  return NextResponse.json({ counts, total: (clients ?? []).length })
}
