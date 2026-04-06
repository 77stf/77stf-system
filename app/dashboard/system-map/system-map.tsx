'use client'

import { useMemo, useState, useCallback } from 'react'
import {
  ReactFlow, Background, Controls, MiniMap,
  type Node, type Edge, type NodeMouseHandler,
  ConnectionLineType, BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { t } from '@/lib/tokens'

// ─── Node categories ──────────────────────────────────────────────────────────

const COLORS = {
  page:        { bg: 'rgba(96,165,250,0.12)',  border: '#60A5FA', text: '#60A5FA',  label: 'Page' },
  api:         { bg: 'rgba(129,140,248,0.12)', border: '#818CF8', text: '#818CF8',  label: 'API' },
  agent:       { bg: 'rgba(196,154,46,0.15)',  border: '#C9A84C', text: '#C9A84C',  label: 'Agent' },
  integration: { bg: 'rgba(52,211,153,0.12)',  border: '#34D399', text: '#34D399',  label: 'Integration' },
  database:    { bg: 'rgba(251,146,60,0.12)',  border: '#FB923C', text: '#FB923C',  label: 'Database' },
  infra:       { bg: 'rgba(167,139,250,0.12)', border: '#A78BFA', text: '#A78BFA',  label: 'Infra' },
}

type NodeCategory = keyof typeof COLORS

interface SystemNodeData {
  label: string
  category: NodeCategory
  status: 'live' | 'planned' | 'stub'
  description?: string
  path?: string
}

// ─── Custom node ──────────────────────────────────────────────────────────────

function SystemNode({ data }: { data: Record<string, unknown> }) {
  const d = data as unknown as SystemNodeData
  const c = COLORS[d.category]
  const opacity = d.status === 'planned' ? 0.5 : d.status === 'stub' ? 0.65 : 1
  return (
    <div style={{
      background: c.bg, border: `1.5px solid ${c.border}`,
      borderRadius: 8, padding: '8px 14px',
      minWidth: 130, maxWidth: 200,
      opacity, cursor: 'pointer',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
        <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: c.text, background: `${c.border}22`, border: `1px solid ${c.border}44`, padding: '1px 5px', borderRadius: 3 }}>
          {c.label}
        </span>
        {d.status !== 'live' && (
          <span style={{ fontSize: 9, color: t.text.muted }}>{d.status === 'planned' ? '⋯' : '·'}</span>
        )}
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: t.text.primary, lineHeight: 1.3 }}>{d.label}</div>
      {d.path && <div style={{ fontSize: 10, color: t.text.muted, marginTop: 2, fontFamily: 'monospace' }}>{d.path}</div>}
    </div>
  )
}

const nodeTypes = { systemNode: SystemNode }

// ─── System architecture definition ──────────────────────────────────────────

const SYSTEM_NODES: (Omit<Node, 'position'> & { col: number; row: number; data: SystemNodeData })[] = [
  // ── Integrations (col 0)
  { id: 'supabase',    col: 0, row: 0, type: 'systemNode', data: { label: 'Supabase', category: 'database',    status: 'live', description: 'PostgreSQL + RLS + Auth' } },
  { id: 'anthropic',   col: 0, row: 1, type: 'systemNode', data: { label: 'Claude API', category: 'integration', status: 'live', description: 'Haiku + Sonnet + Opus' } },
  { id: 'vercel',      col: 0, row: 2, type: 'systemNode', data: { label: 'Vercel', category: 'infra',          status: 'live', description: 'Deploy + Edge' } },
  { id: 'resend',      col: 0, row: 3, type: 'systemNode', data: { label: 'Resend', category: 'integration',    status: 'live', description: 'Email transactional' } },
  { id: 'slack_ext',   col: 0, row: 4, type: 'systemNode', data: { label: 'Slack', category: 'integration',     status: 'live', description: 'Events API + Webhooks' } },
  { id: 'googlemcp',   col: 0, row: 5, type: 'systemNode', data: { label: 'Google MCP', category: 'integration',status: 'live', description: 'Gmail + Calendar' } },
  { id: 'hn_api',      col: 0, row: 6, type: 'systemNode', data: { label: 'Hacker News', category: 'integration',status: 'live', description: 'Public API' } },
  { id: 'coingecko',   col: 0, row: 7, type: 'systemNode', data: { label: 'CoinGecko', category: 'integration', status: 'live', description: 'Crypto news API' } },

  // ── AI Agents (col 1)
  { id: 'agent_scout',    col: 1, row: 0, type: 'systemNode', data: { label: 'Scout', category: 'agent', status: 'live', description: 'Content analysis → BUILD/SKIP' } },
  { id: 'agent_radar',    col: 1, row: 1, type: 'systemNode', data: { label: 'Radar', category: 'agent', status: 'live', description: 'AI/crypto daily digest' } },
  { id: 'agent_guardian', col: 1, row: 2, type: 'systemNode', data: { label: 'Guardian', category: 'agent', status: 'live', description: 'System monitoring' } },
  { id: 'agent_operator', col: 1, row: 3, type: 'systemNode', data: { label: 'Operator', category: 'agent', status: 'live', description: 'NL → CRM actions' } },
  { id: 'agent_pa',       col: 1, row: 4, type: 'systemNode', data: { label: 'Personal Assistant', category: 'agent', status: 'live', description: 'Slack → CRM ingest' } },
  { id: 'agent_hunter',   col: 1, row: 5, type: 'systemNode', data: { label: 'Hunter', category: 'agent', status: 'planned', description: 'Lead research + scoring' } },
  { id: 'agent_arch',     col: 1, row: 6, type: 'systemNode', data: { label: 'Architect', category: 'agent', status: 'live', description: 'Stack analysis + ROI' } },

  // ── API Routes (col 2)
  { id: 'api_clients',    col: 2, row: 0, type: 'systemNode', data: { label: 'Clients API',    category: 'api', status: 'live', path: '/api/clients' } },
  { id: 'api_audits',     col: 2, row: 1, type: 'systemNode', data: { label: 'Audits API',     category: 'api', status: 'live', path: '/api/audits' } },
  { id: 'api_quotes',     col: 2, row: 2, type: 'systemNode', data: { label: 'Quotes API',     category: 'api', status: 'live', path: '/api/quotes' } },
  { id: 'api_tasks',      col: 2, row: 3, type: 'systemNode', data: { label: 'Tasks API',      category: 'api', status: 'live', path: '/api/tasks' } },
  { id: 'api_ingest',     col: 2, row: 4, type: 'systemNode', data: { label: 'Ingest API',     category: 'api', status: 'live', path: '/api/clients/[id]/ingest' } },
  { id: 'api_brief',      col: 2, row: 5, type: 'systemNode', data: { label: 'Meeting Brief',  category: 'api', status: 'live', path: '/api/clients/[id]/meeting-prep' } },
  { id: 'api_analyze',    col: 2, row: 6, type: 'systemNode', data: { label: 'Scout Analyze',  category: 'api', status: 'live', path: '/api/intelligence/analyze' } },
  { id: 'api_radar_run',  col: 2, row: 7, type: 'systemNode', data: { label: 'Radar Run',      category: 'api', status: 'live', path: '/api/intelligence/radar/run' } },
  { id: 'api_guardian',   col: 2, row: 8, type: 'systemNode', data: { label: 'Guardian Run',   category: 'api', status: 'live', path: '/api/guardian/run' } },
  { id: 'api_operator',   col: 2, row: 9, type: 'systemNode', data: { label: 'Operator Chat',  category: 'api', status: 'live', path: '/api/operator/chat' } },
  { id: 'api_slack',      col: 2, row: 10, type: 'systemNode', data: { label: 'Slack Events',  category: 'api', status: 'live', path: '/api/webhooks/slack-events' } },
  { id: 'api_stack',      col: 2, row: 11, type: 'systemNode', data: { label: 'Stack API',     category: 'api', status: 'live', path: '/api/clients/[id]/stack' } },
  { id: 'api_errors',     col: 2, row: 12, type: 'systemNode', data: { label: 'Errors API',    category: 'api', status: 'live', path: '/api/errors' } },
  { id: 'api_ai_usage',   col: 2, row: 13, type: 'systemNode', data: { label: 'AI Usage API',  category: 'api', status: 'live', path: '/api/ai-usage' } },
  { id: 'api_snapshot',   col: 2, row: 14, type: 'systemNode', data: { label: 'System Snapshot',category: 'api', status: 'live', path: '/api/system/snapshot' } },

  // ── Dashboard Pages (col 3)
  { id: 'page_dash',      col: 3, row: 0,  type: 'systemNode', data: { label: 'Dashboard', category: 'page', status: 'live', path: '/dashboard' } },
  { id: 'page_clients',   col: 3, row: 1,  type: 'systemNode', data: { label: 'Klienci', category: 'page', status: 'live', path: '/dashboard/clients' } },
  { id: 'page_audit',     col: 3, row: 2,  type: 'systemNode', data: { label: 'Audit Wizard', category: 'page', status: 'live', path: '/dashboard/clients/[id]/audit' } },
  { id: 'page_brief',     col: 3, row: 3,  type: 'systemNode', data: { label: 'Meeting Brief', category: 'page', status: 'live', path: '/dashboard/clients/[id]/prep' } },
  { id: 'page_stack',     col: 3, row: 4,  type: 'systemNode', data: { label: 'Stack Intelligence', category: 'page', status: 'live', path: '/dashboard/clients/[id]/stack' } },
  { id: 'page_quotes',    col: 3, row: 5,  type: 'systemNode', data: { label: 'Quote Builder', category: 'page', status: 'live', path: '/dashboard/quotes' } },
  { id: 'page_tasks',     col: 3, row: 6,  type: 'systemNode', data: { label: 'Zadania', category: 'page', status: 'live', path: '/dashboard/tasks' } },
  { id: 'page_intel',     col: 3, row: 7,  type: 'systemNode', data: { label: 'Intelligence Hub', category: 'page', status: 'live', path: '/dashboard/intelligence' } },
  { id: 'page_guardian',  col: 3, row: 8,  type: 'systemNode', data: { label: 'Guardian', category: 'page', status: 'live', path: '/dashboard/guardian' } },
  { id: 'page_operator',  col: 3, row: 9,  type: 'systemNode', data: { label: 'Operator', category: 'page', status: 'live', path: '/dashboard/operator' } },
  { id: 'page_sysmap',    col: 3, row: 10, type: 'systemNode', data: { label: 'System Map', category: 'page', status: 'live', path: '/dashboard/system-map' } },
  { id: 'page_aicosts',   col: 3, row: 11, type: 'systemNode', data: { label: 'AI Costs', category: 'page', status: 'live', path: '/dashboard/ai-costs' } },
  { id: 'page_errors',    col: 3, row: 12, type: 'systemNode', data: { label: 'Error Observatory', category: 'page', status: 'live', path: '/dashboard/errors' } },
  { id: 'page_content',   col: 3, row: 13, type: 'systemNode', data: { label: 'Content Studio', category: 'page', status: 'live', path: '/dashboard/content' } },
  { id: 'page_settings',  col: 3, row: 14, type: 'systemNode', data: { label: 'Settings', category: 'page', status: 'live', path: '/dashboard/settings' } },

  // ── Database tables (col 4)
  { id: 'db_clients',    col: 4, row: 0,  type: 'systemNode', data: { label: 'clients', category: 'database', status: 'live' } },
  { id: 'db_notes',      col: 4, row: 1,  type: 'systemNode', data: { label: 'client_notes', category: 'database', status: 'live' } },
  { id: 'db_tasks',      col: 4, row: 2,  type: 'systemNode', data: { label: 'tasks', category: 'database', status: 'live' } },
  { id: 'db_quotes',     col: 4, row: 3,  type: 'systemNode', data: { label: 'quotes', category: 'database', status: 'live' } },
  { id: 'db_audits',     col: 4, row: 4,  type: 'systemNode', data: { label: 'audits', category: 'database', status: 'live' } },
  { id: 'db_stack',      col: 4, row: 5,  type: 'systemNode', data: { label: 'stack_items', category: 'database', status: 'live' } },
  { id: 'db_ai_log',     col: 4, row: 6,  type: 'systemNode', data: { label: 'ai_usage_log', category: 'database', status: 'live' } },
  { id: 'db_errors',     col: 4, row: 7,  type: 'systemNode', data: { label: 'error_log', category: 'database', status: 'live' } },
  { id: 'db_digests',    col: 4, row: 8,  type: 'systemNode', data: { label: 'intelligence_digests', category: 'database', status: 'live' } },
  { id: 'db_guardian',   col: 4, row: 9,  type: 'systemNode', data: { label: 'guardian_reports', category: 'database', status: 'live' } },
  { id: 'db_content',    col: 4, row: 10, type: 'systemNode', data: { label: 'content_posts', category: 'database', status: 'live' } },
]

const COL_X = [0, 280, 560, 840, 1120]
const ROW_H = 88

const EDGES: Edge[] = [
  // Integrations → APIs
  { id: 'e-anth-analyze',  source: 'anthropic',  target: 'api_analyze',    style: { stroke: '#818CF844', strokeWidth: 1 } },
  { id: 'e-anth-radar',    source: 'anthropic',  target: 'api_radar_run',  style: { stroke: '#818CF844', strokeWidth: 1 } },
  { id: 'e-anth-guardian', source: 'anthropic',  target: 'api_guardian',   style: { stroke: '#818CF844', strokeWidth: 1 } },
  { id: 'e-anth-operator', source: 'anthropic',  target: 'api_operator',   style: { stroke: '#818CF844', strokeWidth: 1 } },
  { id: 'e-anth-brief',    source: 'anthropic',  target: 'api_brief',      style: { stroke: '#818CF844', strokeWidth: 1 } },
  { id: 'e-anth-ingest',   source: 'anthropic',  target: 'api_ingest',     style: { stroke: '#818CF844', strokeWidth: 1 } },
  { id: 'e-slack-events',  source: 'slack_ext',  target: 'api_slack',      style: { stroke: '#34D39944', strokeWidth: 1.5 }, animated: true },
  { id: 'e-hn-radar',      source: 'hn_api',     target: 'api_radar_run',  style: { stroke: '#34D39944', strokeWidth: 1 } },
  { id: 'e-cg-radar',      source: 'coingecko',  target: 'api_radar_run',  style: { stroke: '#34D39944', strokeWidth: 1 } },
  { id: 'e-goog-op',       source: 'googlemcp',  target: 'api_operator',   style: { stroke: '#34D39944', strokeWidth: 1 } },

  // Agents → APIs
  { id: 'e-scout-api',     source: 'agent_scout',    target: 'api_analyze',   style: { stroke: '#C9A84C55', strokeWidth: 1.2 } },
  { id: 'e-radar-api',     source: 'agent_radar',    target: 'api_radar_run', style: { stroke: '#C9A84C55', strokeWidth: 1.2 } },
  { id: 'e-guard-api',     source: 'agent_guardian', target: 'api_guardian',  style: { stroke: '#C9A84C55', strokeWidth: 1.2 } },
  { id: 'e-op-api',        source: 'agent_operator', target: 'api_operator',  style: { stroke: '#C9A84C55', strokeWidth: 1.2 } },
  { id: 'e-pa-slack',      source: 'agent_pa',       target: 'api_slack',     style: { stroke: '#C9A84C55', strokeWidth: 1.2 } },

  // APIs → Pages
  { id: 'e-api-clients-p', source: 'api_clients',   target: 'page_clients',  style: { stroke: '#60A5FA33', strokeWidth: 1 } },
  { id: 'e-api-audit-p',   source: 'api_audits',    target: 'page_audit',    style: { stroke: '#60A5FA33', strokeWidth: 1 } },
  { id: 'e-api-brief-p',   source: 'api_brief',     target: 'page_brief',    style: { stroke: '#60A5FA33', strokeWidth: 1 } },
  { id: 'e-api-quote-p',   source: 'api_quotes',    target: 'page_quotes',   style: { stroke: '#60A5FA33', strokeWidth: 1 } },
  { id: 'e-api-task-p',    source: 'api_tasks',     target: 'page_tasks',    style: { stroke: '#60A5FA33', strokeWidth: 1 } },
  { id: 'e-api-analyze-p', source: 'api_analyze',   target: 'page_intel',    style: { stroke: '#60A5FA33', strokeWidth: 1 } },
  { id: 'e-api-radar-p',   source: 'api_radar_run', target: 'page_intel',    style: { stroke: '#60A5FA33', strokeWidth: 1 } },
  { id: 'e-api-guard-p',   source: 'api_guardian',  target: 'page_guardian', style: { stroke: '#60A5FA33', strokeWidth: 1 } },
  { id: 'e-api-op-p',      source: 'api_operator',  target: 'page_operator', style: { stroke: '#60A5FA33', strokeWidth: 1 } },
  { id: 'e-api-stack-p',   source: 'api_stack',     target: 'page_stack',    style: { stroke: '#60A5FA33', strokeWidth: 1 } },
  { id: 'e-api-errors-p',  source: 'api_errors',    target: 'page_errors',   style: { stroke: '#60A5FA33', strokeWidth: 1 } },
  { id: 'e-api-costs-p',   source: 'api_ai_usage',  target: 'page_aicosts',  style: { stroke: '#60A5FA33', strokeWidth: 1 } },
  { id: 'e-snap-sysmap',   source: 'api_snapshot',  target: 'page_sysmap',   style: { stroke: '#60A5FA33', strokeWidth: 1 } },

  // APIs → DB
  { id: 'e-clients-db',   source: 'api_clients',   target: 'db_clients',  style: { stroke: '#FB923C33', strokeWidth: 1 } },
  { id: 'e-ingest-db',    source: 'api_ingest',    target: 'db_notes',    style: { stroke: '#FB923C33', strokeWidth: 1 } },
  { id: 'e-tasks-db',     source: 'api_tasks',     target: 'db_tasks',    style: { stroke: '#FB923C33', strokeWidth: 1 } },
  { id: 'e-quotes-db',    source: 'api_quotes',    target: 'db_quotes',   style: { stroke: '#FB923C33', strokeWidth: 1 } },
  { id: 'e-audits-db',    source: 'api_audits',    target: 'db_audits',   style: { stroke: '#FB923C33', strokeWidth: 1 } },
  { id: 'e-stack-db',     source: 'api_stack',     target: 'db_stack',    style: { stroke: '#FB923C33', strokeWidth: 1 } },
  { id: 'e-radar-db',     source: 'api_radar_run', target: 'db_digests',  style: { stroke: '#FB923C33', strokeWidth: 1 } },
  { id: 'e-guard-db',     source: 'api_guardian',  target: 'db_guardian', style: { stroke: '#FB923C33', strokeWidth: 1 } },
  { id: 'e-errors-db',    source: 'api_errors',    target: 'db_errors',   style: { stroke: '#FB923C33', strokeWidth: 1 } },
  { id: 'e-usage-db',     source: 'api_ai_usage',  target: 'db_ai_log',   style: { stroke: '#FB923C33', strokeWidth: 1 } },
  { id: 'e-slack-notes',  source: 'api_slack',     target: 'db_notes',    style: { stroke: '#FB923C33', strokeWidth: 1 }, animated: true },
]

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function NodeDetail({ node, onClose }: { node: Node; onClose: () => void }) {
  const d = node.data as unknown as SystemNodeData
  const c = COLORS[d.category]
  return (
    <div style={{ position: 'absolute', top: 0, right: 0, width: 260, height: '100%', background: '#1A1A1E', borderLeft: `1px solid ${t.border.default}`, padding: 20, zIndex: 10, overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: c.text, display: 'block', marginBottom: 4 }}>{c.label}</span>
          <div style={{ fontSize: 15, fontWeight: 700, color: t.text.primary }}>{d.label}</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: t.text.muted, cursor: 'pointer', fontSize: 18 }}>×</button>
      </div>
      {d.path && <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#818CF8', background: 'rgba(129,140,248,0.08)', padding: '4px 8px', borderRadius: 4, marginBottom: 10 }}>{d.path}</div>}
      <div style={{ fontSize: 12, padding: '3px 9px', borderRadius: 12, background: `${c.border}18`, border: `1px solid ${c.border}35`, color: c.text, display: 'inline-block', marginBottom: 12 }}>
        {d.status === 'live' ? '● Live' : d.status === 'stub' ? '○ Stub' : '· Planned'}
      </div>
      {d.description && <p style={{ fontSize: 13, color: t.text.secondary, lineHeight: 1.6, margin: 0 }}>{d.description}</p>}
      {d.path && d.path.startsWith('/dashboard') && (
        <a href={d.path} style={{ display: 'block', marginTop: 14, textAlign: 'center', padding: '7px 0', border: `1px solid ${t.border.default}`, borderRadius: 6, color: t.text.muted, fontSize: 12, textDecoration: 'none' }}>
          Otwórz →
        </a>
      )}
    </div>
  )
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function Legend() {
  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
      {(Object.entries(COLORS) as [NodeCategory, typeof COLORS[NodeCategory]][]).map(([key, c]) => (
        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: c.border }} />
          <span style={{ fontSize: 11, color: t.text.muted }}>{c.label}</span>
        </div>
      ))}
      <span style={{ marginLeft: 'auto', fontSize: 11, color: t.text.muted }}>
        {SYSTEM_NODES.filter(n => n.data.status === 'live').length} live · {SYSTEM_NODES.filter(n => n.data.status === 'planned').length} planned
      </span>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function SystemMap() {
  const [selected, setSelected] = useState<Node | null>(null)

  const nodes: Node[] = useMemo(() =>
    SYSTEM_NODES.map(n => ({
      id: n.id,
      type: n.type,
      data: n.data as unknown as Record<string, unknown>,
      position: { x: COL_X[n.col], y: n.row * ROW_H },
    })), []
  )

  const onNodeClick: NodeMouseHandler = useCallback((_evt, node) => {
    setSelected(node)
  }, [])

  return (
    <div>
      <Legend />
      <div style={{ position: 'relative', width: '100%', height: 700, borderRadius: 12, overflow: 'hidden', background: '#08080b', border: `1px solid ${t.border.subtle}` }}>
        <ReactFlow
          nodes={nodes}
          edges={EDGES}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          onPaneClick={() => setSelected(null)}
          connectionLineType={ConnectionLineType.SmoothStep}
          fitView
          fitViewOptions={{ padding: 0.12 }}
          style={{ background: 'transparent' }}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="rgba(255,255,255,0.025)" variant={BackgroundVariant.Dots} gap={24} size={1} />
          <Controls style={{ background: '#1A1A1E', border: `1px solid ${t.border.default}`, borderRadius: 6 }} />
          <MiniMap
            style={{ background: '#1A1A1E', border: `1px solid ${t.border.default}`, borderRadius: 6 }}
            nodeColor={n => {
              const d = n.data as unknown as SystemNodeData
              return COLORS[d?.category ?? 'page']?.border ?? '#888'
            }}
          />
        </ReactFlow>
        {selected && <NodeDetail node={selected} onClose={() => setSelected(null)} />}
      </div>
    </div>
  )
}
