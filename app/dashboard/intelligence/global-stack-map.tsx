'use client'

import { useMemo, useState, useCallback } from 'react'
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
import type { StackItem, StackItemStatus, Client } from '@/lib/types'

// ─── Colour maps ──────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<StackItemStatus, { bg: string; border: string; text: string }> = {
  live:        { bg: 'rgba(74,222,128,0.14)',  border: '#4ade80', text: '#4ade80' },
  in_progress: { bg: 'rgba(129,140,248,0.14)', border: '#818CF8', text: '#818CF8' },
  planned:     { bg: 'rgba(251,191,36,0.14)',  border: '#fbbf24', text: '#fbbf24' },
  idea:        { bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.18)', text: 'rgba(242,242,244,0.55)' },
  error:       { bg: 'rgba(248,113,113,0.14)', border: '#f87171', text: '#f87171' },
  deprecated:  { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.10)', text: 'rgba(242,242,244,0.30)' },
}

const CATEGORY_ICONS: Record<string, string> = {
  automation: '⚡', integration: '🔗', ai_agent: '🤖',
  data: '📊', voice: '🎙️', reporting: '📋',
}

// Distinct hues for up to 12 clients — cycles after that
const CLIENT_HUES = [210, 280, 160, 30, 330, 60, 190, 250, 130, 10, 300, 80]

// ─── Custom nodes ─────────────────────────────────────────────────────────────

function ClientNode({ data }: { data: Record<string, unknown> }) {
  const hue = data.hue as number
  const name = data.name as string
  return (
    <div style={{
      background: `hsla(${hue},60%,20%,0.85)`,
      border: `2px solid hsla(${hue},70%,50%,0.7)`,
      borderRadius: t.radius.md,
      padding: '10px 16px',
      minWidth: 140,
      textAlign: 'center',
      boxShadow: `0 0 18px hsla(${hue},70%,40%,0.25)`,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: `hsla(${hue},80%,75%,1)`, marginBottom: 2 }}>
        Klient
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: t.text.primary }}>{name}</div>
    </div>
  )
}

function StackNode({ data }: { data: Record<string, unknown> }) {
  const item = data.item as StackItem
  const colors = STATUS_COLORS[item.status]
  const icon = CATEGORY_ICONS[item.category] ?? '📦'
  return (
    <div style={{
      background: colors.bg,
      border: `1.5px solid ${colors.border}`,
      borderRadius: t.radius.sm,
      padding: '8px 12px',
      minWidth: 130,
      maxWidth: 180,
      cursor: 'pointer',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 13 }}>{icon}</span>
        <span style={{ fontSize: 11, color: colors.text, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {item.status}
        </span>
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: t.text.primary, lineHeight: 1.3 }}>{item.name}</div>
      {item.monthly_value_pln != null && item.monthly_value_pln > 0 && (
        <div style={{ fontSize: 10, color: t.text.gold, marginTop: 3 }}>{formatPLN(item.monthly_value_pln)}/mies.</div>
      )}
    </div>
  )
}

const nodeTypes = { clientNode: ClientNode, stackNode: StackNode }

// ─── Layout builder ───────────────────────────────────────────────────────────

const COL_GAP = 300
const ROW_GAP = 110
const CLIENT_Y_OFFSET = 0
const ITEM_START_X_OFFSET = 20
const ITEM_START_Y_OFFSET = 80

function buildGlobalLayout(
  items: StackItem[],
  clients: Pick<Client, 'id' | 'name' | 'status' | 'industry'>[],
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = []
  const edges: Edge[] = []

  // Only show clients that actually have stack items
  const clientsWithItems = clients.filter(c => items.some(i => i.client_id === c.id))

  clientsWithItems.forEach((client, ci) => {
    const hue = CLIENT_HUES[ci % CLIENT_HUES.length]
    const clientX = ci * COL_GAP
    const clientNodeId = `client-${client.id}`

    nodes.push({
      id: clientNodeId,
      type: 'clientNode',
      position: { x: clientX, y: CLIENT_Y_OFFSET },
      data: { name: client.name, hue },
    })

    const clientItems = items.filter(i => i.client_id === client.id)
    clientItems.forEach((item, ii) => {
      const itemNodeId = `item-${item.id}`
      nodes.push({
        id: itemNodeId,
        type: 'stackNode',
        position: {
          x: clientX + ITEM_START_X_OFFSET + (ii % 2) * 155 - 77,
          y: CLIENT_Y_OFFSET + ITEM_START_Y_OFFSET + Math.floor(ii / 2) * ROW_GAP,
        },
        data: { item },
      })

      edges.push({
        id: `e-${clientNodeId}-${itemNodeId}`,
        source: clientNodeId,
        target: itemNodeId,
        type: 'smoothstep',
        style: { stroke: `hsla(${hue},60%,55%,0.35)`, strokeWidth: 1.2 },
        animated: item.status === 'in_progress',
      })

      // Cross-client dependency edges
      for (const depId of item.depends_on ?? []) {
        if (items.find(i => i.id === depId)) {
          edges.push({
            id: `dep-${item.id}-${depId}`,
            source: `item-${depId}`,
            target: itemNodeId,
            type: 'smoothstep',
            style: { stroke: 'rgba(255,255,255,0.18)', strokeWidth: 1, strokeDasharray: '4 3' },
          })
        }
      }
    })
  })

  return { nodes, edges }
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function ItemSidebar({ item, clientName, onClose }: { item: StackItem; clientName: string; onClose: () => void }) {
  const colors = STATUS_COLORS[item.status]
  const STATUS_LABELS: Record<StackItemStatus, string> = {
    live: 'Live', in_progress: 'W toku', planned: 'Planowane', idea: 'Pomysł', error: 'Błąd', deprecated: 'Przestarzałe',
  }
  return (
    <div style={{ position: 'absolute', top: 0, right: 0, width: 280, height: '100%', background: t.bg.cardSolid, borderLeft: `1px solid ${t.border.default}`, padding: 20, zIndex: 10, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 10, color: t.text.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>{clientName}</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: t.text.primary }}>{item.name}</div>
          <div style={{ fontSize: 11, color: t.text.muted, marginTop: 2 }}>{item.category}</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: t.text.muted, cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
      </div>

      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: t.radius.full, background: colors.bg, border: `1px solid ${colors.border}`, color: colors.text, fontSize: 11, fontWeight: 600, width: 'fit-content' }}>
        {STATUS_LABELS[item.status]}
      </span>

      {item.description && <p style={{ color: t.text.secondary, fontSize: 12, lineHeight: 1.6, margin: 0 }}>{item.description}</p>}

      {(item.monthly_value_pln || item.setup_cost_pln) && (
        <div style={{ background: t.bg.muted, borderRadius: t.radius.sm, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {item.monthly_value_pln != null && item.monthly_value_pln > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: t.text.muted }}>Wartość mies.</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: t.text.gold }}>{formatPLN(item.monthly_value_pln)}</span>
            </div>
          )}
          {item.setup_cost_pln != null && item.setup_cost_pln > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: t.text.muted }}>Koszt wdrożenia</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: t.text.secondary }}>{formatPLN(item.setup_cost_pln)}</span>
            </div>
          )}
        </div>
      )}

      <a href={`/dashboard/clients/${item.client_id}/stack`} style={{ display: 'block', textAlign: 'center', padding: '7px 0', background: 'transparent', border: `1px solid ${t.border.default}`, borderRadius: t.radius.sm, color: t.text.muted, fontSize: 12, textDecoration: 'none', marginTop: 'auto' }}>
        Otwórz Stack klienta →
      </a>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 400, gap: 12, color: t.text.muted }}>
      <div style={{ fontSize: 42 }}>🗺️</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: t.text.secondary }}>Brak danych w Stack Map</div>
      <div style={{ fontSize: 13, textAlign: 'center', maxWidth: 320, lineHeight: 1.6 }}>
        Otwórz profil klienta → Stack Intelligence → dodaj pierwsze wdrożenie. Wszystkie wdrożenia pojawią się tutaj.
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface GlobalStackMapProps {
  items: StackItem[]
  clients: Pick<Client, 'id' | 'name' | 'status' | 'industry'>[]
}

export function GlobalStackMap({ items, clients }: GlobalStackMapProps) {
  const [selected, setSelected] = useState<StackItem | null>(null)

  const { nodes, edges } = useMemo(() => buildGlobalLayout(items, clients), [items, clients])

  const onNodeClick: NodeMouseHandler = useCallback((_evt, node) => {
    if (node.type === 'stackNode') {
      const item = (node.data as { item: StackItem }).item
      setSelected(item)
    } else {
      setSelected(null)
    }
  }, [])

  const clientsWithItems = clients.filter(c => items.some(i => i.client_id === c.id))

  if (items.length === 0) return <EmptyState />

  return (
    <div>
      {/* Legend row */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
        {([
          ['live', '#4ade80', 'Live'],
          ['in_progress', '#818CF8', 'W toku'],
          ['planned', '#fbbf24', 'Planowane'],
          ['idea', 'rgba(255,255,255,0.25)', 'Pomysł'],
          ['error', '#f87171', 'Błąd'],
        ] as [string, string, string][]).map(([, color, label]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
            <span style={{ fontSize: 11, color: t.text.muted }}>{label}</span>
          </div>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: t.text.muted }}>{clientsWithItems.length} klientów · {items.length} elementów</span>
      </div>

      {/* Graph */}
      <div style={{ position: 'relative', width: '100%', height: 560, borderRadius: t.radius.lg, overflow: 'hidden', background: '#0a0a0f', border: `1px solid ${t.border.subtle}` }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          onPaneClick={() => setSelected(null)}
          connectionLineType={ConnectionLineType.SmoothStep}
          fitView
          fitViewOptions={{ padding: 0.18 }}
          style={{ background: 'transparent' }}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="rgba(255,255,255,0.03)" variant={BackgroundVariant.Dots} gap={24} size={1} />
          <Controls style={{ background: t.bg.cardSolid, border: `1px solid ${t.border.default}`, borderRadius: t.radius.sm }} />
          <MiniMap
            style={{ background: t.bg.cardSolid, border: `1px solid ${t.border.default}`, borderRadius: t.radius.sm }}
            nodeColor={n => {
              if (n.type === 'clientNode') return 'rgba(255,255,255,0.3)'
              const item = (n.data as { item?: StackItem }).item
              return item ? STATUS_COLORS[item.status].border : t.border.default
            }}
          />
        </ReactFlow>

        {selected && (
          <ItemSidebar
            item={selected}
            clientName={clients.find(c => c.id === selected.client_id)?.name ?? '—'}
            onClose={() => setSelected(null)}
          />
        )}
      </div>
    </div>
  )
}
