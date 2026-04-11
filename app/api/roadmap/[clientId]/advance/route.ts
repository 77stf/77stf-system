import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase'
import { z } from 'zod'

const STAGES = ['discovery', 'audit', 'proposal', 'negotiation', 'onboarding', 'active', 'partner'] as const

const schema = z.object({
  stage: z.enum(STAGES),
  note: z.string().optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const admin = createSupabaseAdminClient()
  const { data: { user } } = await admin.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })

  const { clientId } = await params
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Nieprawidłowe dane' }, { status: 400 })

  const { stage, note } = parsed.data

  // Update client pipeline_stage
  const { error: updateError } = await admin
    .from('clients')
    .update({ pipeline_stage: stage })
    .eq('id', clientId)

  if (updateError) return NextResponse.json({ error: 'Błąd aktualizacji etapu' }, { status: 500 })

  // Log stage change as activity
  await admin.from('roadmap_activities').insert({
    client_id: clientId,
    stage_key: stage,
    activity_type: 'stage_change',
    title: `Przejście do etapu: ${stage}`,
    description: note ?? null,
  })

  // Record in roadmap_stages
  await admin.from('roadmap_stages').insert({
    client_id: clientId,
    stage_key: stage,
    notes: note ?? null,
  })

  return NextResponse.json({ ok: true, stage })
}
