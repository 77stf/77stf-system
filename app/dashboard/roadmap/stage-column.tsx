'use client'

import { useState } from 'react'
import { Client, PipelineStage } from '@/lib/types'
import { t } from '@/lib/tokens'
import { Plus } from 'lucide-react'
import { relativeTime } from '@/lib/format'

const STAGE_COLORS: Record<PipelineStage, string> = {
  discovery:   'rgba(129,140,248,0.15)',
  audit:       'rgba(251,191,36,0.12)',
  proposal:    'rgba(251,146,60,0.12)',
  negotiation: 'rgba(248,113,113,0.12)',
  onboarding:  'rgba(34,211,238,0.12)',
  active:      'rgba(74,222,128,0.12)',
  partner:     'rgba(196,154,46,0.12)',
}

const STAGE_DOT: Record<PipelineStage, string> = {
  discovery:   '#818CF8',
  audit:       '#fbbf24',
  proposal:    '#fb923c',
  negotiation: '#f87171',
  onboarding:  '#22d3ee',
  active:      '#4ade80',
  partner:     '#C49A2E',
}

interface StageColumnProps {
  stage: PipelineStage
  label: string
  clients: Client[]
  isDragOver: boolean
  onDragStart: (client: Client, stage: PipelineStage) => void
  onDrop: (stage: PipelineStage) => void
  onClientClick: (client: Client) => void
}

export function StageColumn({ stage, label, clients, onDragStart, onDrop, onClientClick }: StageColumnProps) {
  const [over, setOver] = useState(false)

  return (
    <div
      onDragOver={e => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={() => { setOver(false); onDrop(stage) }}
      style={{
        minHeight: 320,
        background: over ? 'rgba(255,255,255,0.04)' : t.bg.muted,
        border: `1px solid ${over ? t.border.hover : t.border.subtle}`,
        borderRadius: 10,
        padding: '12px 10px',
        transition: 'border-color 150ms, background 150ms',
      }}
    >
      {/* Column header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12, padding: '0 2px' }}>
        <span style={{
          width: 7, height: 7, borderRadius: '50%',
          background: STAGE_DOT[stage], flexShrink: 0,
        }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: t.text.secondary, flex: 1, letterSpacing: '0.01em' }}>
          {label}
        </span>
        {clients.length > 0 && (
          <span style={{
            fontSize: 10, fontWeight: 700,
            color: t.text.muted,
            background: t.bg.overlay,
            border: `1px solid ${t.border.subtle}`,
            borderRadius: 20, padding: '1px 7px',
          }}>
            {clients.length}
          </span>
        )}
      </div>

      {/* Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {clients.map(client => (
          <ClientCard
            key={client.id}
            client={client}
            stage={stage}
            stageColor={STAGE_COLORS[stage]}
            onDragStart={onDragStart}
            onClick={onClientClick}
          />
        ))}

        {clients.length === 0 && (
          <div style={{
            border: `1px dashed ${t.border.subtle}`,
            borderRadius: 8, padding: '20px 12px',
            textAlign: 'center', fontSize: 11,
            color: t.text.muted,
          }}>
            Brak firm w tym etapie
          </div>
        )}
      </div>

      {/* Add hint */}
      <button
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          width: '100%', marginTop: 8, padding: '6px 8px',
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 11, color: t.text.muted, borderRadius: 6,
          opacity: 0.5, transition: 'opacity 150ms',
        }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}
        onClick={() => window.location.href = '/dashboard/clients'}
      >
        <Plus size={11} /> Dodaj firmę
      </button>
    </div>
  )
}

function ClientCard({
  client, stage, stageColor, onDragStart, onClick,
}: {
  client: Client
  stage: PipelineStage
  stageColor: string
  onDragStart: (client: Client, stage: PipelineStage) => void
  onClick: (client: Client) => void
}) {
  const initials = client.name.slice(0, 2).toUpperCase()

  return (
    <div
      draggable
      onDragStart={() => onDragStart(client, stage)}
      onClick={() => onClick(client)}
      style={{
        background: t.bg.card,
        border: `1px solid ${t.border.subtle}`,
        borderRadius: 8,
        padding: '11px 12px',
        cursor: 'grab',
        transition: 'border-color 120ms, background 120ms',
        userSelect: 'none',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = t.border.default
        e.currentTarget.style.background = t.bg.cardHover
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = t.border.subtle
        e.currentTarget.style.background = t.bg.card
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
        {/* Avatar */}
        <div style={{
          width: 28, height: 28, borderRadius: 6,
          background: stageColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 700, color: t.text.secondary,
          flexShrink: 0,
        }}>
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 600, color: t.text.primary,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {client.name}
          </div>
          {client.industry && (
            <div style={{ fontSize: 11, color: t.text.muted, marginTop: 1 }}>
              {client.industry}
            </div>
          )}
        </div>
      </div>

      {/* Meta */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
        {client.last_activity_at && (
          <span style={{ fontSize: 10, color: t.text.muted }}>
            {relativeTime(client.last_activity_at)}
          </span>
        )}
        {client.owner_name && (
          <span style={{
            fontSize: 10, color: t.text.muted,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
          }}>
            {client.owner_name}
          </span>
        )}
      </div>
    </div>
  )
}
