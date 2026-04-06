'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeMouseHandler,
  ConnectionLineType,
  BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { t } from '@/lib/tokens'
import { formatPLN } from '@/lib/format'
import type { StackItem, StackItemStatus, StackItemCategory } from '@/lib/types'

// ─── Status colours ──────────────────────────────────────────────────────────

const STATUS_COLORS: Record<StackItemStatus, { bg: string; border: string; text: string }> = {
  live:        { bg: 'rgba(74,222,128,0.14)',   border: '#4ade80', text: '#4ade80' },
  in_progress: { bg: 'rgba(129,140,248,0.14)',  border: '#818CF8', text: '#818CF8' },
  planned:     { bg: 'rgba(251,191,36,0.14)',   border: '#fbbf24', text: '#fbbf24' },
  idea:        { bg: 'rgba(255,255,255,0.06)',  border: 'rgba(255,255,255,0.18)', text: 'rgba(242,242,244,0.55)' },
  error:       { bg: 'rgba(248,113,113,0.14)',  border: '#f87171', text: '#f87171' },
  deprecated:  { bg: 'rgba(255,255,255,0.04)',  border: 'rgba(255,255,255,0.10)', text: 'rgba(242,242,244,0.30)' },
}

const CATEGORY_ICONS: Record<StackItemCategory, string> = {
  automation:  '⚡',
  integration: '🔗',
  ai_agent:    '🤖',
  data:        '📊',
  voice:       '🎙️',
  reporting:   '📋',
}

const STATUS_LABELS: Record<StackItemStatus, string> = {
  live:        'Live',
  in_progress: 'W toku',
  planned:     'Planowane',
  idea:        'Pomysł',
  error:       'Błąd',
  deprecated:  'Przestarzałe',
}

// ─── Custom node component ────────────────────────────────────────────────────

function StackNode({ data }: { data: StackItem & { selected?: boolean } }) {
  const colors = STATUS_COLORS[data.status]
  const icon = CATEGORY_ICONS[data.category]

  return (
    <div style={{
      background: colors.bg,
      border: `2px solid ${colors.border}`,
      borderRadius: t.radius.md,
      padding: '12px 16px',
      minWidth: 160,
      maxWidth: 220,
      cursor: 'pointer',
      transition: 'box-shadow 0.15s',
      boxShadow: data.selected
        ? `0 0 0 3px ${colors.border}44, ${t.shadow.cardMd}`
        : t.shadow.card,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{
          fontSize: 12,
          color: colors.text,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}>
          {STATUS_LABELS[data.status]}
        </span>
      </div>
      <div style={{
        color: t.text.primary,
        fontSize: 13,
        fontWeight: 600,
        lineHeight: 1.3,
        marginBottom: data.monthly_value_pln ? 6 : 0,
      }}>
        {data.name}
      </div>
      {data.monthly_value_pln != null && data.monthly_value_pln > 0 && (
        <div style={{ color: t.text.gold, fontSize: 11, fontWeight: 500 }}>
          {formatPLN(data.monthly_value_pln)}/mies.
        </div>
      )}
    </div>
  )
}

const nodeTypes = { stackNode: StackNode }

// ─── Layout helper — simple grid layout ──────────────────────────────────────

const STATUS_ORDER: StackItemStatus[] = ['idea', 'planned', 'in_progress', 'live', 'error', 'deprecated']
const COL_WIDTH = 260
const ROW_HEIGHT = 120

function buildLayout(items: StackItem[]): { nodes: Node[]; edges: Edge[] } {
  // Group by status column
  const columns: Record<string, StackItem[]> = {}
  for (const s of STATUS_ORDER) columns[s] = []
  for (const item of items) columns[item.status].push(item)

  const nodes: Node[] = []
  const colIndexMap: Record<string, number> = {}
  STATUS_ORDER.forEach((s, i) => { colIndexMap[s] = i })

  for (const item of items) {
    const colIdx = colIndexMap[item.status] ?? 0
    const rowIdx = columns[item.status].indexOf(item)
    nodes.push({
      id: item.id,
      type: 'stackNode',
      position: { x: colIdx * COL_WIDTH, y: rowIdx * ROW_HEIGHT },
      data: item as unknown as Record<string, unknown>,
    })
  }

  const edges: Edge[] = []
  for (const item of items) {
    for (const depId of (item.depends_on ?? [])) {
      if (items.find(i => i.id === depId)) {
        edges.push({
          id: `${depId}->${item.id}`,
          source: depId,
          target: item.id,
          type: 'smoothstep',
          style: { stroke: 'rgba(255,255,255,0.22)', strokeWidth: 1.5 },
          animated: item.status === 'in_progress',
        })
      }
    }
  }

  return { nodes, edges }
}

// ─── Sidebar panel ────────────────────────────────────────────────────────────

interface SidebarProps {
  item: StackItem
  onClose: () => void
  onStatusChange: (id: string, status: StackItemStatus) => void
  onDelete: (id: string) => void
}

function NodeSidebar({ item, onClose, onStatusChange, onDelete }: SidebarProps) {
  const colors = STATUS_COLORS[item.status]

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      right: 0,
      width: 300,
      height: '100%',
      background: t.bg.cardSolid,
      borderLeft: `1px solid ${t.border.default}`,
      padding: 24,
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      zIndex: 10,
      overflowY: 'auto',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 22, marginBottom: 4 }}>{CATEGORY_ICONS[item.category]}</div>
          <div style={{ color: t.text.primary, fontWeight: 700, fontSize: 15 }}>{item.name}</div>
          <div style={{ color: t.text.muted, fontSize: 12, marginTop: 2 }}>{item.category}</div>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: t.text.muted, cursor: 'pointer', fontSize: 20, lineHeight: 1 }}
        >×</button>
      </div>

      {/* Status badge */}
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: t.radius.full,
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        color: colors.text,
        fontSize: 12,
        fontWeight: 600,
        width: 'fit-content',
      }}>
        {STATUS_LABELS[item.status]}
      </div>

      {item.description && (
        <p style={{ color: t.text.secondary, fontSize: 13, margin: 0, lineHeight: 1.5 }}>{item.description}</p>
      )}

      {/* Financials */}
      {(item.monthly_value_pln || item.setup_cost_pln) && (
        <div style={{ background: t.bg.muted, borderRadius: t.radius.sm, padding: '12px 14px' }}>
          {item.monthly_value_pln != null && item.monthly_value_pln > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: t.text.muted, fontSize: 12 }}>Wartość miesięczna</span>
              <span style={{ color: t.text.gold, fontSize: 13, fontWeight: 600 }}>{formatPLN(item.monthly_value_pln)}</span>
            </div>
          )}
          {item.setup_cost_pln != null && item.setup_cost_pln > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: t.text.muted, fontSize: 12 }}>Koszt wdrożenia</span>
              <span style={{ color: t.text.secondary, fontSize: 13, fontWeight: 600 }}>{formatPLN(item.setup_cost_pln)}</span>
            </div>
          )}
        </div>
      )}

      {/* Change status */}
      <div>
        <div style={{ color: t.text.muted, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
          Zmień status
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {STATUS_ORDER.map(s => (
            <button
              key={s}
              onClick={() => onStatusChange(item.id, s)}
              style={{
                padding: '4px 10px',
                borderRadius: t.radius.full,
                background: item.status === s ? STATUS_COLORS[s].bg : 'transparent',
                border: `1px solid ${item.status === s ? STATUS_COLORS[s].border : t.border.subtle}`,
                color: item.status === s ? STATUS_COLORS[s].text : t.text.muted,
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.12s',
              }}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: `1px solid ${t.border.subtle}` }}>
        <button
          onClick={() => onDelete(item.id)}
          style={{
            width: '100%',
            padding: '8px 16px',
            background: 'transparent',
            border: `1px solid ${t.border.error}`,
            borderRadius: t.radius.sm,
            color: t.semantic.error,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Usuń element
        </button>
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

interface StackGraphProps {
  clientId: string
  initialItems: StackItem[]
}

export function StackGraph({ clientId, initialItems }: StackGraphProps) {
  const [items, setItems] = useState<StackItem[]>(initialItems)
  const [selectedItem, setSelectedItem] = useState<StackItem | null>(null)
  const [saving, setSaving] = useState(false)

  const { nodes, edges } = useMemo(() => buildLayout(items), [items])

  const onNodeClick: NodeMouseHandler = useCallback((_evt, node) => {
    const item = items.find(i => i.id === node.id) ?? null
    setSelectedItem(item)
  }, [items])

  const handleStatusChange = useCallback(async (id: string, status: StackItemStatus) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/clients/${clientId}/stack`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      if (res.ok) {
        const { item } = await res.json() as { item: StackItem }
        setItems(prev => prev.map(i => i.id === id ? item : i))
        setSelectedItem(item)
      }
    } finally {
      setSaving(false)
    }
  }, [clientId])

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Usunąć ten element ze stacka?')) return
    setSaving(true)
    try {
      const res = await fetch(`/api/clients/${clientId}/stack?itemId=${id}`, { method: 'DELETE' })
      if (res.ok) {
        setItems(prev => prev.filter(i => i.id !== id))
        setSelectedItem(null)
      }
    } finally {
      setSaving(false)
    }
  }, [clientId])

  if (items.length === 0) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: 320,
        gap: 12,
        color: t.text.muted,
      }}>
        <div style={{ fontSize: 40 }}>🗺️</div>
        <div style={{ fontSize: 14 }}>Brak elementów stacka — dodaj pierwszy wdrożenie</div>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: 520, borderRadius: t.radius.lg, overflow: 'hidden', background: '#0c0c10' }}>
      {saving && (
        <div style={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
          background: t.bg.cardSolid, border: `1px solid ${t.border.default}`,
          borderRadius: t.radius.full, padding: '4px 14px',
          color: t.text.muted, fontSize: 12, zIndex: 20,
        }}>
          Zapisuję...
        </div>
      )}

      <ReactFlow
        nodes={nodes.map(n => ({ ...n, data: { ...n.data, selected: selectedItem?.id === n.id } }))}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        onPaneClick={() => setSelectedItem(null)}
        connectionLineType={ConnectionLineType.SmoothStep}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        style={{ background: 'transparent' }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="rgba(255,255,255,0.04)" variant={BackgroundVariant.Dots} gap={20} size={1} />
        <Controls
          style={{
            background: t.bg.cardSolid,
            border: `1px solid ${t.border.default}`,
            borderRadius: t.radius.sm,
          }}
        />
        <MiniMap
          style={{
            background: t.bg.cardSolid,
            border: `1px solid ${t.border.default}`,
            borderRadius: t.radius.sm,
          }}
          nodeColor={n => {
            const item = items.find(i => i.id === n.id)
            return item ? STATUS_COLORS[item.status].border : t.border.default
          }}
        />
      </ReactFlow>

      {selectedItem && (
        <NodeSidebar
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onStatusChange={handleStatusChange}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}
