'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, X } from 'lucide-react'
import { t } from '@/lib/tokens'
import { formatPLN } from '@/lib/format'
import { StackGraph } from '@/components/dashboard/stack-graph'
import type { StackItem, StackItemCategory, StackItemStatus } from '@/lib/types'

// ─── Add item modal ───────────────────────────────────────────────────────────

const CATEGORY_OPTIONS: { value: StackItemCategory; label: string; icon: string }[] = [
  { value: 'automation',  label: 'Automatyzacja',  icon: '⚡' },
  { value: 'integration', label: 'Integracja',     icon: '🔗' },
  { value: 'ai_agent',    label: 'Agent AI',       icon: '🤖' },
  { value: 'data',        label: 'Dane',           icon: '📊' },
  { value: 'voice',       label: 'Głos AI',        icon: '🎙️' },
  { value: 'reporting',   label: 'Raportowanie',   icon: '📋' },
]

const STATUS_OPTIONS: { value: StackItemStatus; label: string }[] = [
  { value: 'idea',        label: 'Pomysł' },
  { value: 'planned',     label: 'Planowane' },
  { value: 'in_progress', label: 'W toku' },
  { value: 'live',        label: 'Live' },
  { value: 'error',       label: 'Błąd' },
  { value: 'deprecated',  label: 'Przestarzałe' },
]

interface AddItemModalProps {
  clientId: string
  onAdd: (item: StackItem) => void
  onClose: () => void
}

function AddItemModal({ clientId, onAdd, onClose }: AddItemModalProps) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState<StackItemCategory>('automation')
  const [status, setStatus] = useState<StackItemStatus>('idea')
  const [description, setDescription] = useState('')
  const [monthlyValue, setMonthlyValue] = useState('')
  const [setupCost, setSetupCost] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('Podaj nazwę'); return }
    setSaving(true)
    setError('')

    const res = await fetch(`/api/clients/${clientId}/stack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        category,
        status,
        description: description.trim() || undefined,
        monthly_value_pln: monthlyValue ? parseFloat(monthlyValue) : undefined,
        setup_cost_pln: setupCost ? parseFloat(setupCost) : undefined,
      }),
    })

    setSaving(false)
    if (res.ok) {
      const { item } = await res.json() as { item: StackItem }
      onAdd(item)
    } else {
      setError('Błąd zapisu — spróbuj ponownie')
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.70)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: t.bg.cardSolid,
        border: `1px solid ${t.border.default}`,
        borderRadius: t.radius.lg,
        padding: 28,
        width: '100%',
        maxWidth: 440,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ color: t.text.primary, fontWeight: 700, fontSize: 16, margin: 0 }}>Dodaj element stacka</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: t.text.muted, cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ color: t.text.muted, fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>
              Nazwa *
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="np. Automatyczny follow-up e-mail"
              style={{
                width: '100%', boxSizing: 'border-box',
                background: t.bg.input, border: `1px solid ${t.border.default}`,
                borderRadius: t.radius.sm, padding: '9px 12px',
                color: t.text.primary, fontSize: 13, outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ color: t.text.muted, fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Kategoria</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as StackItemCategory)}
                style={{
                  width: '100%', background: t.bg.input, border: `1px solid ${t.border.default}`,
                  borderRadius: t.radius.sm, padding: '9px 12px',
                  color: t.text.primary, fontSize: 13, outline: 'none', cursor: 'pointer',
                }}
              >
                {CATEGORY_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.icon} {o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ color: t.text.muted, fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as StackItemStatus)}
                style={{
                  width: '100%', background: t.bg.input, border: `1px solid ${t.border.default}`,
                  borderRadius: t.radius.sm, padding: '9px 12px',
                  color: t.text.primary, fontSize: 13, outline: 'none', cursor: 'pointer',
                }}
              >
                {STATUS_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label style={{ color: t.text.muted, fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Opis (opcjonalnie)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="Krótki opis czego dotyczy..."
              style={{
                width: '100%', boxSizing: 'border-box',
                background: t.bg.input, border: `1px solid ${t.border.default}`,
                borderRadius: t.radius.sm, padding: '9px 12px',
                color: t.text.primary, fontSize: 13, outline: 'none', resize: 'none',
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ color: t.text.muted, fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Wartość mies. (PLN)</label>
              <input
                type="number" min="0" step="100"
                value={monthlyValue}
                onChange={e => setMonthlyValue(e.target.value)}
                placeholder="0"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: t.bg.input, border: `1px solid ${t.border.default}`,
                  borderRadius: t.radius.sm, padding: '9px 12px',
                  color: t.text.primary, fontSize: 13, outline: 'none',
                }}
              />
            </div>
            <div>
              <label style={{ color: t.text.muted, fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Koszt wdrożenia (PLN)</label>
              <input
                type="number" min="0" step="500"
                value={setupCost}
                onChange={e => setSetupCost(e.target.value)}
                placeholder="0"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: t.bg.input, border: `1px solid ${t.border.default}`,
                  borderRadius: t.radius.sm, padding: '9px 12px',
                  color: t.text.primary, fontSize: 13, outline: 'none',
                }}
              />
            </div>
          </div>

          {error && (
            <div style={{ color: t.semantic.error, fontSize: 12 }}>{error}</div>
          )}

          <button
            type="submit"
            disabled={saving}
            style={{
              background: t.brand.gold, color: '#111114', fontWeight: 700,
              border: 'none', borderRadius: t.radius.sm, padding: '10px 20px',
              fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Dodaję...' : 'Dodaj element'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

function StackStats({ items }: { items: StackItem[] }) {
  const live = items.filter(i => i.status === 'live').length
  const inProgress = items.filter(i => i.status === 'in_progress').length
  const errors = items.filter(i => i.status === 'error').length
  const monthlyTotal = items
    .filter(i => i.status === 'live' && i.monthly_value_pln)
    .reduce((sum, i) => sum + (i.monthly_value_pln ?? 0), 0)

  const stats = [
    { label: 'Live', value: String(live), color: '#4ade80' },
    { label: 'W toku', value: String(inProgress), color: '#818CF8' },
    { label: 'Błędy', value: String(errors), color: '#f87171' },
    { label: 'Wartość Live/mies.', value: monthlyTotal > 0 ? formatPLN(monthlyTotal) : '—', color: '#C9A84C' },
  ]

  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
      {stats.map(s => (
        <div key={s.label} style={{
          background: t.bg.card,
          border: `1px solid ${t.border.subtle}`,
          borderRadius: t.radius.md,
          padding: '12px 18px',
          flex: '1 1 120px',
          minWidth: 120,
        }}>
          <div style={{ color: t.text.muted, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
            {s.label}
          </div>
          <div style={{ color: s.color, fontSize: 22, fontWeight: 700 }}>
            {s.value}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

interface StackPanelProps {
  clientId: string
  clientName: string
  initialItems: StackItem[]
}

export function StackPanel({ clientId, clientName, initialItems }: StackPanelProps) {
  const router = useRouter()
  const [items, setItems] = useState<StackItem[]>(initialItems)
  const [showAdd, setShowAdd] = useState(false)

  const handleAdd = useCallback((item: StackItem) => {
    setItems(prev => [...prev, item])
    setShowAdd(false)
  }, [])

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <button
          onClick={() => router.push(`/dashboard/clients/${clientId}`)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', color: t.text.muted,
            cursor: 'pointer', fontSize: 13, marginBottom: 12, padding: 0,
          }}
        >
          <ArrowLeft size={14} /> Wróć do klienta
        </button>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ color: t.text.primary, fontWeight: 700, fontSize: 22, margin: 0 }}>
              Stack Intelligence
            </h1>
            <p style={{ color: t.text.muted, fontSize: 13, margin: '4px 0 0' }}>{clientName}</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: t.brand.gold, color: '#111114',
              border: 'none', borderRadius: t.radius.sm,
              padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}
          >
            <Plus size={14} /> Dodaj element
          </button>
        </div>
      </div>

      {/* Stats */}
      <StackStats items={items} />

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        {[
          { label: 'Pomysł',        color: 'rgba(255,255,255,0.18)' },
          { label: 'Planowane',     color: '#fbbf24' },
          { label: 'W toku',        color: '#818CF8' },
          { label: 'Live',          color: '#4ade80' },
          { label: 'Błąd',          color: '#f87171' },
          { label: 'Przestarzałe',  color: 'rgba(255,255,255,0.10)' },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color }} />
            <span style={{ color: t.text.muted, fontSize: 11 }}>{l.label}</span>
          </div>
        ))}
      </div>

      {/* Graph */}
      <div style={{
        background: t.bg.card,
        border: `1px solid ${t.border.subtle}`,
        borderRadius: t.radius.lg,
        overflow: 'hidden',
      }}>
        <StackGraph clientId={clientId} initialItems={items} />
      </div>

      {/* List view */}
      {items.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h2 style={{ color: t.text.secondary, fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
            Lista elementów ({items.length})
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {items.map(item => (
              <div key={item.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: t.bg.card,
                border: `1px solid ${t.border.subtle}`,
                borderRadius: t.radius.sm,
                padding: '10px 16px',
              }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>
                  {item.category === 'automation' ? '⚡' :
                   item.category === 'integration' ? '🔗' :
                   item.category === 'ai_agent' ? '🤖' :
                   item.category === 'data' ? '📊' :
                   item.category === 'voice' ? '🎙️' : '📋'}
                </span>
                <span style={{ color: t.text.primary, fontSize: 13, fontWeight: 600, flex: 1 }}>{item.name}</span>
                {item.description && (
                  <span style={{ color: t.text.muted, fontSize: 12, flex: 2 }}>{item.description}</span>
                )}
                {item.monthly_value_pln != null && item.monthly_value_pln > 0 && (
                  <span style={{ color: t.text.gold, fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                    {formatPLN(item.monthly_value_pln)}/mies.
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {showAdd && (
        <AddItemModal clientId={clientId} onAdd={handleAdd} onClose={() => setShowAdd(false)} />
      )}
    </div>
  )
}
