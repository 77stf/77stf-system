'use client'

import { useState, useEffect } from 'react'
import { Client, PipelineStage, RoadmapActivity } from '@/lib/types'
import { t } from '@/lib/tokens'
import { X, ChevronRight, Phone, Mail, Building2, Clock, MessageSquare } from 'lucide-react'
import { relativeTime, formatDate } from '@/lib/format'

const ACTIVITY_ICONS: Record<string, string> = {
  call: '📞', email: '📧', meeting: '🤝', note: '📝',
  quote_sent: '📄', research: '🔍', demo: '🎯', document: '📋',
  whatsapp: '💬', stage_change: '➡️',
}

interface ClientPanelProps {
  client: Client
  stageLabels: Record<PipelineStage, string>
  stageOrder: PipelineStage[]
  onClose: () => void
  onClientUpdated: (client: Client) => void
}

export function ClientPanel({ client, stageLabels, stageOrder, onClose, onClientUpdated }: ClientPanelProps) {
  const [activities, setActivities] = useState<RoadmapActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [noteText, setNoteText] = useState('')
  const [saving, setSaving] = useState(false)

  const currentStageIndex = stageOrder.indexOf(client.pipeline_stage ?? 'discovery')
  const nextStage = stageOrder[currentStageIndex + 1] ?? null

  useEffect(() => {
    setLoading(true)
    fetch(`/api/roadmap/activities?client_id=${client.id}`)
      .then(r => r.json())
      .then(d => setActivities(d.data ?? []))
      .finally(() => setLoading(false))
  }, [client.id])

  async function saveNote() {
    if (!noteText.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/roadmap/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: client.id,
          stage_key: client.pipeline_stage ?? 'discovery',
          activity_type: 'note',
          title: noteText.trim().slice(0, 80),
          description: noteText.trim().length > 80 ? noteText.trim() : undefined,
        }),
      })
      const { data } = await res.json()
      if (data) setActivities(prev => [data, ...prev])
      setNoteText('')
    } finally {
      setSaving(false)
    }
  }

  async function advanceStage() {
    if (!nextStage) return
    const res = await fetch(`/api/roadmap/${client.id}/advance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: nextStage }),
    })
    if (res.ok) {
      onClientUpdated({ ...client, pipeline_stage: nextStage })
      const activity: RoadmapActivity = {
        id: Date.now().toString(),
        client_id: client.id,
        stage_key: nextStage,
        activity_type: 'stage_change',
        title: `Przejście do etapu: ${stageLabels[nextStage]}`,
        metadata: {},
        created_at: new Date().toISOString(),
      }
      setActivities(prev => [activity, ...prev])
    }
  }

  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 400,
        background: t.bg.cardSolid,
        borderLeft: `1px solid ${t.border.default}`,
        zIndex: 50,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ padding: '18px 20px 14px', borderBottom: `1px solid ${t.border.subtle}` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: 'rgba(129,140,248,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, color: '#818CF8', flexShrink: 0,
          }}>
            {client.name.slice(0, 2).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: t.text.primary, letterSpacing: '-0.02em' }}>
              {client.name}
            </div>
            {client.industry && (
              <div style={{ fontSize: 12, color: t.text.muted, display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <Building2 size={11} /> {client.industry}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: t.text.muted, flexShrink: 0 }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Stage badge */}
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontSize: 11, fontWeight: 600,
            color: t.text.secondary,
            background: t.bg.muted,
            border: `1px solid ${t.border.default}`,
            borderRadius: 20, padding: '3px 10px',
          }}>
            {stageLabels[client.pipeline_stage ?? 'discovery']}
          </span>
          {client.last_activity_at && (
            <span style={{ fontSize: 11, color: t.text.muted, display: 'flex', alignItems: 'center', gap: 3 }}>
              <Clock size={10} /> {relativeTime(client.last_activity_at)}
            </span>
          )}
        </div>
      </div>

      {/* Contact info */}
      {(client.owner_name || client.owner_email || client.owner_phone) && (
        <div style={{ padding: '12px 20px', borderBottom: `1px solid ${t.border.subtle}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {client.owner_name && (
            <div style={{ fontSize: 12, color: t.text.secondary }}>
              Kontakt: <strong>{client.owner_name}</strong>
            </div>
          )}
          {client.owner_email && (
            <a href={`mailto:${client.owner_email}`} style={{ fontSize: 12, color: '#818CF8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Mail size={11} /> {client.owner_email}
            </a>
          )}
          {client.owner_phone && (
            <a href={`tel:${client.owner_phone}`} style={{ fontSize: 12, color: '#818CF8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Phone size={11} /> {client.owner_phone}
            </a>
          )}
        </div>
      )}

      {/* Quick note */}
      <div style={{ padding: '12px 20px', borderBottom: `1px solid ${t.border.subtle}` }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <textarea
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            placeholder="Dodaj notatkę..."
            rows={2}
            style={{
              flex: 1, background: t.bg.input,
              border: `1px solid ${t.border.subtle}`,
              borderRadius: 7, padding: '8px 10px',
              fontSize: 12, color: t.text.primary,
              resize: 'none', outline: 'none',
              fontFamily: 'inherit',
            }}
            onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) saveNote() }}
          />
          <button
            onClick={saveNote}
            disabled={saving || !noteText.trim()}
            style={{
              padding: '0 12px', borderRadius: 7,
              background: noteText.trim() ? 'rgba(129,140,248,0.15)' : t.bg.muted,
              border: `1px solid ${noteText.trim() ? 'rgba(129,140,248,0.3)' : t.border.subtle}`,
              color: noteText.trim() ? '#818CF8' : t.text.muted,
              cursor: noteText.trim() ? 'pointer' : 'default',
              fontSize: 11, fontWeight: 600, flexShrink: 0,
              transition: 'all 150ms',
            }}
          >
            <MessageSquare size={13} />
          </button>
        </div>
      </div>

      {/* Activities timeline */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: t.text.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
          Historia aktywności
        </div>

        {loading && (
          <div style={{ fontSize: 12, color: t.text.muted, textAlign: 'center', padding: '20px 0' }}>
            Ładowanie...
          </div>
        )}

        {!loading && activities.length === 0 && (
          <div style={{ fontSize: 12, color: t.text.muted, textAlign: 'center', padding: '20px 0' }}>
            Brak aktywności. Dodaj pierwszą notatkę powyżej.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {activities.map(act => (
            <div key={act.id} style={{
              background: t.bg.muted,
              border: `1px solid ${t.border.subtle}`,
              borderRadius: 7, padding: '9px 11px',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                <span style={{ fontSize: 13, flexShrink: 0 }}>
                  {ACTIVITY_ICONS[act.activity_type] ?? '•'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: t.text.primary }}>
                    {act.title}
                  </div>
                  {act.description && (
                    <div style={{ fontSize: 11, color: t.text.muted, marginTop: 2 }}>
                      {act.description}
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: t.text.muted, marginTop: 4 }}>
                    {formatDate(act.created_at)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer actions */}
      <div style={{ padding: '12px 20px', borderTop: `1px solid ${t.border.subtle}`, display: 'flex', gap: 8 }}>
        <a
          href={`/dashboard/clients/${client.id}`}
          style={{
            flex: 1, padding: '9px 14px', textAlign: 'center',
            background: t.bg.muted,
            border: `1px solid ${t.border.subtle}`,
            borderRadius: 7, fontSize: 12, fontWeight: 600,
            color: t.text.secondary, textDecoration: 'none',
            transition: 'border-color 150ms',
          }}
        >
          Otwórz profil
        </a>
        {nextStage && (
          <button
            onClick={advanceStage}
            style={{
              flex: 1, padding: '9px 14px',
              background: 'rgba(74,222,128,0.1)',
              border: '1px solid rgba(74,222,128,0.25)',
              borderRadius: 7, fontSize: 12, fontWeight: 600,
              color: '#4ade80', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              transition: 'all 150ms',
            }}
          >
            {stageLabels[nextStage]} <ChevronRight size={13} />
          </button>
        )}
      </div>
    </div>
  )
}
