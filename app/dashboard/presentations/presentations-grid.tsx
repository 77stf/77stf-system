'use client'

import { useState } from 'react'
import { t } from '@/lib/tokens'
import { Plus, ExternalLink, Sparkles, Trash2, CheckCircle, Clock, FileText, Eye } from 'lucide-react'
import { formatDate, relativeTime } from '@/lib/format'

type PresentationStatus = 'draft' | 'ready' | 'presented' | 'follow_up'

interface PresentationItem {
  id: string
  client_id: string
  title: string
  status: PresentationStatus
  slides_data: Record<string, unknown>[]
  presented_at?: string
  feedback?: string
  canva_url?: string
  updated_at: string
  created_at: string
  clients?: { id: string; name: string; industry?: string } | null
}

interface PresentationsGridProps {
  initialPresentations: PresentationItem[]
  clients: { id: string; name: string; industry?: string }[]
}

const STATUS_CONFIG: Record<PresentationStatus, { label: string; color: string; bg: string; border: string }> = {
  draft:      { label: 'Szkic',         color: t.text.muted,      bg: t.bg.muted,                     border: t.border.subtle },
  ready:      { label: 'Gotowa',        color: '#818CF8',          bg: 'rgba(129,140,248,0.1)',         border: 'rgba(129,140,248,0.25)' },
  presented:  { label: 'Zaprezentowana',color: '#4ade80',          bg: 'rgba(74,222,128,0.1)',          border: 'rgba(74,222,128,0.25)' },
  follow_up:  { label: 'Follow-up',     color: '#fbbf24',          bg: 'rgba(251,191,36,0.1)',          border: 'rgba(251,191,36,0.25)' },
}

export function PresentationsGrid({ initialPresentations, clients }: PresentationsGridProps) {
  const [presentations, setPresentations] = useState(initialPresentations)
  const [showNew, setShowNew] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newClientId, setNewClientId] = useState('')
  const [creating, setCreating] = useState(false)
  const [generating, setGenerating] = useState<string | null>(null)

  async function createPresentation() {
    if (!newTitle.trim() || !newClientId) return
    setCreating(true)
    const res = await fetch('/api/presentations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle.trim(), client_id: newClientId }),
    })
    if (res.ok) {
      const { data } = await res.json() as { data: PresentationItem }
      setPresentations(prev => [data, ...prev])
      setNewTitle('')
      setNewClientId('')
      setShowNew(false)
    }
    setCreating(false)
  }

  async function generateSlides(id: string) {
    setGenerating(id)
    const res = await fetch(`/api/presentations/${id}/generate`, { method: 'POST' })
    if (res.ok) {
      const { data } = await res.json() as { data: { slides: Record<string, unknown>[] } }
      setPresentations(prev => prev.map(p => p.id === id ? { ...p, slides_data: data.slides, status: 'ready' } : p))
    }
    setGenerating(null)
  }

  async function updateStatus(id: string, status: PresentationStatus) {
    const update: Record<string, unknown> = { status }
    if (status === 'presented') update.presented_at = new Date().toISOString()
    const res = await fetch(`/api/presentations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    })
    if (res.ok) {
      setPresentations(prev => prev.map(p => p.id === id ? { ...p, ...update } : p))
    }
  }

  async function deletePresentation(id: string) {
    if (!confirm('Usunąć tę prezentację?')) return
    await fetch(`/api/presentations/${id}`, { method: 'DELETE' })
    setPresentations(prev => prev.filter(p => p.id !== id))
  }

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['all', 'draft', 'ready', 'presented', 'follow_up'] as const).map(f => (
            <span key={f} style={{ fontSize: 11, color: t.text.muted }}>
              {f === 'all' ? `Wszystkie (${presentations.length})` : ''}
            </span>
          ))}
        </div>
        <button
          onClick={() => setShowNew(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 7,
            background: 'rgba(129,140,248,0.12)',
            border: '1px solid rgba(129,140,248,0.25)',
            color: '#818CF8', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <Plus size={14} /> Nowa prezentacja
        </button>
      </div>

      {/* New presentation form */}
      {showNew && (
        <div style={{
          background: t.bg.card, border: `1px solid ${t.border.default}`,
          borderRadius: 10, padding: '16px 18px', marginBottom: 16,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.text.primary, marginBottom: 12 }}>
            Nowa prezentacja
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="Tytuł prezentacji..."
              style={{
                flex: 2, minWidth: 200, padding: '8px 12px',
                background: t.bg.input, border: `1px solid ${t.border.subtle}`,
                borderRadius: 7, fontSize: 13, color: t.text.primary, outline: 'none',
              }}
            />
            <select
              value={newClientId}
              onChange={e => setNewClientId(e.target.value)}
              style={{
                flex: 1, minWidth: 160, padding: '8px 12px',
                background: t.bg.input, border: `1px solid ${t.border.subtle}`,
                borderRadius: 7, fontSize: 13, color: newClientId ? t.text.primary : t.text.muted, outline: 'none',
              }}
            >
              <option value="">Wybierz klienta...</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button
              onClick={createPresentation}
              disabled={creating || !newTitle.trim() || !newClientId}
              style={{
                padding: '8px 16px', borderRadius: 7,
                background: (creating || !newTitle.trim() || !newClientId) ? t.bg.muted : '#818CF8',
                border: 'none', color: '#fff', fontSize: 13, fontWeight: 600,
                cursor: (creating || !newTitle.trim() || !newClientId) ? 'not-allowed' : 'pointer',
              }}
            >
              {creating ? 'Tworzę...' : 'Utwórz'}
            </button>
            <button
              onClick={() => setShowNew(false)}
              style={{ padding: '8px 12px', borderRadius: 7, background: 'none', border: `1px solid ${t.border.subtle}`, color: t.text.muted, fontSize: 13, cursor: 'pointer' }}
            >
              Anuluj
            </button>
          </div>
        </div>
      )}

      {/* Grid */}
      {presentations.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '60px 20px',
          border: `1px dashed ${t.border.subtle}`, borderRadius: 10,
          color: t.text.muted, fontSize: 13,
        }}>
          Brak prezentacji. Kliknij "Nowa prezentacja" aby zacząć.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
          {presentations.map(pres => (
            <PresentationCard
              key={pres.id}
              pres={pres}
              generating={generating === pres.id}
              onGenerate={() => generateSlides(pres.id)}
              onStatusChange={(status) => updateStatus(pres.id, status)}
              onDelete={() => deletePresentation(pres.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function PresentationCard({
  pres, generating, onGenerate, onStatusChange, onDelete,
}: {
  pres: PresentationItem
  generating: boolean
  onGenerate: () => void
  onStatusChange: (s: PresentationStatus) => void
  onDelete: () => void
}) {
  const sc = STATUS_CONFIG[pres.status]
  const slideCount = pres.slides_data?.length ?? 0
  const client = pres.clients

  return (
    <div style={{
      background: t.bg.card, border: `1px solid ${t.border.subtle}`,
      borderRadius: 10, padding: '16px 18px',
      display: 'flex', flexDirection: 'column', gap: 12,
      transition: 'border-color 150ms',
    }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = t.border.default)}
      onMouseLeave={e => (e.currentTarget.style.borderColor = t.border.subtle)}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 7,
          background: 'rgba(129,140,248,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <FileText size={15} style={{ color: '#818CF8' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: t.text.primary, lineHeight: 1.3 }}>
            {pres.title}
          </div>
          {client && (
            <div style={{ fontSize: 12, color: t.text.muted, marginTop: 2 }}>
              {client.name}{client.industry ? ` · ${client.industry}` : ''}
            </div>
          )}
        </div>
        <span style={{
          fontSize: 10, fontWeight: 700, flexShrink: 0,
          color: sc.color, background: sc.bg, border: `1px solid ${sc.border}`,
          borderRadius: 20, padding: '2px 8px',
        }}>
          {sc.label}
        </span>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ fontSize: 11, color: t.text.muted, display: 'flex', alignItems: 'center', gap: 4 }}>
          <Eye size={11} /> {slideCount} {slideCount === 1 ? 'slajd' : 'slajdów'}
        </div>
        <div style={{ fontSize: 11, color: t.text.muted, display: 'flex', alignItems: 'center', gap: 4 }}>
          <Clock size={11} /> {relativeTime(pres.updated_at)}
        </div>
        {pres.presented_at && (
          <div style={{ fontSize: 11, color: t.semantic.success, display: 'flex', alignItems: 'center', gap: 4 }}>
            <CheckCircle size={11} /> {formatDate(pres.presented_at)}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
        {slideCount === 0 && (
          <button
            onClick={onGenerate}
            disabled={generating}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 12px', borderRadius: 6,
              background: generating ? t.bg.muted : 'rgba(129,140,248,0.12)',
              border: `1px solid ${generating ? t.border.subtle : 'rgba(129,140,248,0.25)'}`,
              color: generating ? t.text.muted : '#818CF8',
              fontSize: 11, fontWeight: 600, cursor: generating ? 'not-allowed' : 'pointer',
            }}
          >
            <Sparkles size={11} /> {generating ? 'Generuję...' : 'Generuj slajdy AI'}
          </button>
        )}

        {slideCount > 0 && pres.status === 'ready' && (
          <button
            onClick={() => onStatusChange('presented')}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 12px', borderRadius: 6,
              background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.25)',
              color: '#4ade80', fontSize: 11, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <CheckCircle size={11} /> Oznacz jako zaprezentowaną
          </button>
        )}

        {pres.status === 'presented' && (
          <button
            onClick={() => onStatusChange('follow_up')}
            style={{
              padding: '6px 12px', borderRadius: 6,
              background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)',
              color: '#fbbf24', fontSize: 11, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Follow-up
          </button>
        )}

        {pres.canva_url && (
          <a
            href={pres.canva_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '6px 12px', borderRadius: 6,
              background: t.bg.muted, border: `1px solid ${t.border.subtle}`,
              color: t.text.secondary, fontSize: 11, fontWeight: 600, textDecoration: 'none',
            }}
          >
            <ExternalLink size={11} /> Canva
          </a>
        )}

        <button
          onClick={onDelete}
          style={{
            marginLeft: 'auto', padding: '6px 8px', borderRadius: 6,
            background: 'none', border: `1px solid ${t.border.subtle}`,
            color: t.text.muted, cursor: 'pointer', display: 'flex', alignItems: 'center',
          }}
        >
          <Trash2 size={11} />
        </button>
      </div>

      {/* Slides preview */}
      {slideCount > 0 && (
        <div style={{ borderTop: `1px solid ${t.border.subtle}`, paddingTop: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.text.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
            Plan slajdów
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {(pres.slides_data as Array<{ title?: string; key_message?: string }>).slice(0, 4).map((slide, i) => (
              <div key={i} style={{ fontSize: 11, color: t.text.secondary, display: 'flex', gap: 6 }}>
                <span style={{ color: t.text.muted, flexShrink: 0 }}>{i + 1}.</span>
                <span>{slide.title ?? 'Slajd'}</span>
              </div>
            ))}
            {slideCount > 4 && (
              <div style={{ fontSize: 11, color: t.text.muted }}>
                +{slideCount - 4} więcej slajdów
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
