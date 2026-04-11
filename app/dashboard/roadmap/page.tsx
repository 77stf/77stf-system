import { createSupabaseServerClient } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import { t } from '@/lib/tokens'
import { Kanban } from 'lucide-react'
import { RoadmapBoard } from './roadmap-board'
import { Client, PipelineStage } from '@/lib/types'

const STAGE_LABELS: Record<PipelineStage, string> = {
  discovery:   'Odkrywanie',
  audit:       'Audyt',
  proposal:    'Oferta',
  negotiation: 'Negocjacje',
  onboarding:  'Wdrażanie',
  active:      'Aktywny',
  partner:     'Partner',
}

const STAGE_ORDER: PipelineStage[] = ['discovery', 'audit', 'proposal', 'negotiation', 'onboarding', 'active', 'partner']

export default async function RoadmapPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, industry, status, pipeline_stage, created_at, last_activity_at, owner_name, owner_email, owner_phone')
    .order('created_at', { ascending: false })

  const typedClients = (clients ?? []) as unknown as Client[]
  const board = STAGE_ORDER.reduce((acc, stage) => {
    acc[stage] = typedClients.filter(c => (c.pipeline_stage ?? 'discovery') === stage)
    return acc
  }, {} as Record<PipelineStage, Client[]>)

  const totalClients = (clients ?? []).length

  return (
    <div style={{ padding: '28px 32px', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: 'rgba(255,255,255,0.06)',
            border: `1px solid ${t.border.default}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Kanban size={18} style={{ color: t.text.muted }} />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: t.text.primary, margin: 0, letterSpacing: '-0.02em' }}>
              Roadmap
            </h1>
            <p style={{ fontSize: 13, color: t.text.muted, margin: 0 }}>
              Pipeline lead-to-klient — {totalClients} {totalClients === 1 ? 'firma' : totalClients < 5 ? 'firmy' : 'firm'}
            </p>
          </div>
        </div>

        {/* Stage counters */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {STAGE_ORDER.map(stage => {
            const count = board[stage].length
            if (count === 0) return null
            return (
              <span key={stage} style={{
                fontSize: 11, fontWeight: 600,
                color: t.text.secondary,
                background: t.bg.muted,
                border: `1px solid ${t.border.subtle}`,
                borderRadius: 20, padding: '3px 10px',
              }}>
                {STAGE_LABELS[stage]}: {count}
              </span>
            )
          })}
        </div>
      </div>

      {/* Kanban board */}
      <RoadmapBoard initialBoard={board} stageLabels={STAGE_LABELS} stageOrder={STAGE_ORDER} />
    </div>
  )
}
