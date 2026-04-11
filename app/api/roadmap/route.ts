import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase'
import { PipelineStage } from '@/lib/types'

export async function GET() {
  const admin = createSupabaseAdminClient()

  const { data: { user } } = await admin.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })

  const { data: clients, error } = await admin
    .from('clients')
    .select('id, name, industry, status, pipeline_stage, created_at, last_activity_at, owner_name, owner_email')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'Błąd pobierania klientów' }, { status: 500 })

  // Group by pipeline stage
  const stages: PipelineStage[] = ['discovery', 'audit', 'proposal', 'negotiation', 'onboarding', 'active', 'partner']
  const board = stages.reduce((acc, stage) => {
    acc[stage] = (clients ?? []).filter(c => (c.pipeline_stage ?? 'discovery') === stage)
    return acc
  }, {} as Record<PipelineStage, typeof clients>)

  // Last activity per client from roadmap_activities
  const clientIds = (clients ?? []).map(c => c.id)
  let lastActivities: Record<string, string> = {}

  if (clientIds.length > 0) {
    const { data: activities } = await admin
      .from('roadmap_activities')
      .select('client_id, created_at, title, activity_type')
      .in('client_id', clientIds)
      .order('created_at', { ascending: false })

    // Take the latest per client
    ;(activities ?? []).forEach(a => {
      if (!lastActivities[a.client_id]) {
        lastActivities[a.client_id] = a.created_at
      }
    })
  }

  return NextResponse.json({ board, lastActivities })
}
