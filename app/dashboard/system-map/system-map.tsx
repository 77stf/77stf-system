'use client'

import { useMemo, useState, useCallback } from 'react'
import {
  ReactFlow, Background, Controls, MiniMap, Panel,
  type Node, type Edge, type NodeMouseHandler,
  ConnectionLineType, BackgroundVariant, MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { t } from '@/lib/tokens'

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  integration: { bg: 'rgba(52,211,153,0.08)',  border: '#34D399', text: '#34D399',  label: 'Integration', icon: '🔌' },
  agent:       { bg: 'rgba(196,154,46,0.10)',  border: '#C9A84C', text: '#C9A84C',  label: 'Agent',       icon: '🤖' },
  workflow:    { bg: 'rgba(167,139,250,0.10)', border: '#A78BFA', text: '#A78BFA',  label: 'Workflow',    icon: '⚡' },
  api:         { bg: 'rgba(129,140,248,0.08)', border: '#818CF8', text: '#818CF8',  label: 'API',         icon: '🔗' },
  page:        { bg: 'rgba(96,165,250,0.08)',  border: '#60A5FA', text: '#60A5FA',  label: 'Page',        icon: '🖥️' },
  database:    { bg: 'rgba(251,146,60,0.08)',  border: '#FB923C', text: '#FB923C',  label: 'Database',    icon: '🗄️' },
  infra:       { bg: 'rgba(244,114,182,0.08)', border: '#F472B6', text: '#F472B6',  label: 'Infra',       icon: '🏗️' },
} as const

type Cat = keyof typeof C

interface SNode {
  label: string
  category: Cat
  status: 'live' | 'planned' | 'stub'
  description?: string
  path?: string
  model?: string
  tags?: string[]
  usedBy?: string[]
}

// ─── Custom node ──────────────────────────────────────────────────────────────

function SystemNode({ data, selected }: { data: Record<string, unknown>; selected?: boolean }) {
  const d = data as unknown as SNode
  const c = C[d.category]
  const dim = d.status === 'planned'
  return (
    <div style={{
      background: selected ? c.bg.replace('0.08', '0.18').replace('0.10', '0.22') : c.bg,
      border: `1.5px solid ${selected ? c.border : c.border + '88'}`,
      borderRadius: 10,
      padding: '9px 13px',
      minWidth: 148,
      maxWidth: 195,
      opacity: dim ? 0.45 : 1,
      cursor: 'pointer',
      transition: 'all 0.15s ease',
      boxShadow: selected ? `0 0 0 2px ${c.border}44, 0 4px 20px ${c.border}22` : 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 8, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: c.text }}>
          {c.label}
        </span>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: d.status === 'live' ? '#22C55E' : d.status === 'stub' ? '#EAB308' : '#6B7280',
          boxShadow: d.status === 'live' ? '0 0 6px #22C55E88' : 'none',
          flexShrink: 0,
        }} />
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: t.text.primary, lineHeight: 1.25, marginBottom: d.path || d.model ? 4 : 0 }}>
        {d.label}
      </div>
      {d.model && (
        <div style={{ fontSize: 9, color: '#C9A84C', background: 'rgba(201,168,76,0.12)', padding: '1px 5px', borderRadius: 3, display: 'inline-block', marginBottom: 2 }}>
          {d.model}
        </div>
      )}
      {d.path && (
        <div style={{ fontSize: 9.5, color: '#818CF8', fontFamily: 'monospace', lineHeight: 1.3 }}>{d.path}</div>
      )}
      {d.description && !d.path && (
        <div style={{ fontSize: 10, color: t.text.muted, lineHeight: 1.35 }}>{d.description}</div>
      )}
    </div>
  )
}

const nodeTypes = { sn: SystemNode }

// ─── Section header component ─────────────────────────────────────────────────

function SectionHeader({ title, count, color, icon, x, y, width }: {
  title: string; count: number; color: string; icon: string; x: number; y: number; width: number
}) {
  return (
    <div style={{
      position: 'absolute', left: x, top: y, width,
      background: `linear-gradient(135deg, ${color}14, ${color}06)`,
      border: `1px solid ${color}30`,
      borderRadius: 12, padding: '8px 14px',
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <span style={{ fontSize: 14 }}>{icon}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{title}</span>
      <span style={{ marginLeft: 'auto', fontSize: 10, color, background: `${color}22`, padding: '1px 7px', borderRadius: 10 }}>{count}</span>
    </div>
  )
}

// ─── All nodes ────────────────────────────────────────────────────────────────

type RawNode = Omit<Node, 'position'> & { px: number; py: number; data: SNode }

const COL = { ext: 0, agent: 230, wf: 460, api: 690, page: 940, db: 1195 }
const R = 84

const RAW_NODES: RawNode[] = [
  // ── External Services ─────────────────────────────────────────────────────
  { id: 'supabase',   px: COL.ext,   py: 60,  type: 'sn', data: { label: 'Supabase',      category: 'database',    status: 'live', description: 'PostgreSQL + RLS + Auth', tags: ['db','auth'] } },
  { id: 'claude',     px: COL.ext,   py: 60+R*1, type: 'sn', data: { label: 'Claude API',    category: 'integration', status: 'live', description: 'Haiku / Sonnet — AI core', tags: ['ai'] } },
  { id: 'slack_int',  px: COL.ext,   py: 60+R*2, type: 'sn', data: { label: 'Slack',         category: 'integration', status: 'live', description: 'Events API + Bot + Webhooks', tags: ['comm'] } },
  { id: 'gmail_int',  px: COL.ext,   py: 60+R*3, type: 'sn', data: { label: 'Gmail MCP',     category: 'integration', status: 'live', description: 'Email via MCP', tags: ['comm'] } },
  { id: 'gcal_int',   px: COL.ext,   py: 60+R*4, type: 'sn', data: { label: 'Google Calendar', category: 'integration', status: 'live', description: 'Calendar MCP', tags: ['comm'] } },
  { id: 'vercel',     px: COL.ext,   py: 60+R*5, type: 'sn', data: { label: 'Vercel',        category: 'infra',       status: 'live', description: 'Deploy + Edge CDN' } },
  { id: 'railway',    px: COL.ext,   py: 60+R*6, type: 'sn', data: { label: 'Railway',       category: 'infra',       status: 'live', description: 'Telegram forwarder host' } },
  { id: 'github',     px: COL.ext,   py: 60+R*7, type: 'sn', data: { label: 'GitHub Actions', category: 'infra',      status: 'live', description: 'CI/CD auto-deploy' } },
  { id: 'n8n',        px: COL.ext,   py: 60+R*8, type: 'sn', data: { label: 'n8n',           category: 'infra',       status: 'live', description: 'Workflow orchestrator' } },
  { id: 'resend',     px: COL.ext,   py: 60+R*9, type: 'sn', data: { label: 'Resend',        category: 'integration', status: 'live', description: 'Transactional email' } },
  { id: 'telegram',   px: COL.ext,   py: 60+R*10, type: 'sn', data: { label: 'Telegram',     category: 'integration', status: 'live', description: '13 kanałów → topics forwarder' } },
  { id: 'hn_api',     px: COL.ext,   py: 60+R*11, type: 'sn', data: { label: 'Hacker News',  category: 'integration', status: 'live', description: 'HN Top Stories API' } },
  { id: 'coingecko',  px: COL.ext,   py: 60+R*12, type: 'sn', data: { label: 'CoinGecko',   category: 'integration', status: 'live', description: 'Crypto news API' } },
  { id: 'notion_int', px: COL.ext,   py: 60+R*13, type: 'sn', data: { label: 'Notion MCP',  category: 'integration', status: 'live', description: 'Knowledge base MCP' } },
  { id: 'vapi',       px: COL.ext,   py: 60+R*14, type: 'sn', data: { label: 'Vapi.ai',     category: 'integration', status: 'planned', description: 'Voice Agent platform' } },
  { id: 'elevenlabs', px: COL.ext,   py: 60+R*15, type: 'sn', data: { label: 'ElevenLabs',  category: 'integration', status: 'planned', description: 'Voice synthesis' } },

  // ── AI Agents ──────────────────────────────────────────────────────────────
  { id: 'ag_scout',   px: COL.agent, py: 60,      type: 'sn', data: { label: 'Scout 🎬',    category: 'agent', status: 'live', model: 'Sonnet', description: 'Content → BUILD/SKIP/UPGRADE' } },
  { id: 'ag_radar',   px: COL.agent, py: 60+R,    type: 'sn', data: { label: 'Radar 🔬',    category: 'agent', status: 'live', model: 'Sonnet', description: 'AI/crypto morning digest' } },
  { id: 'ag_guardian',px: COL.agent, py: 60+R*2,  type: 'sn', data: { label: 'Guardian 🛡️', category: 'agent', status: 'live', model: 'Haiku',  description: '5 reguł monitoringu systemu' } },
  { id: 'ag_operator',px: COL.agent, py: 60+R*3,  type: 'sn', data: { label: 'Operator 🤖', category: 'agent', status: 'live', model: 'Sonnet', description: 'NL → CRM, 8 narzędzi, agentic loop' } },
  { id: 'ag_pa',      px: COL.agent, py: 60+R*4,  type: 'sn', data: { label: 'PA 💬',       category: 'agent', status: 'live', model: 'Haiku',  description: 'Slack → CRM notatki + zadania' } },
  { id: 'ag_architect',px: COL.agent,py: 60+R*5,  type: 'sn', data: { label: 'Architect 🏗️',category: 'agent', status: 'live', model: 'Sonnet', description: 'Stack + ROI kalkulacje' } },
  { id: 'ag_hunter',  px: COL.agent, py: 60+R*6,  type: 'sn', data: { label: 'Hunter 🎯',   category: 'agent', status: 'planned', model: 'Sonnet', description: 'Lead research + cold outreach' } },

  // ── n8n Workflows ──────────────────────────────────────────────────────────
  { id: 'wf_guardian',px: COL.wf,    py: 60,      type: 'sn', data: { label: '01 Guardian Cron', category: 'workflow', status: 'live', path: '08:00 codziennie', description: 'Uruchamia Guardian run' } },
  { id: 'wf_radar',   px: COL.wf,    py: 60+R,    type: 'sn', data: { label: '02 Radar Cron',    category: 'workflow', status: 'live', path: '07:00 codziennie', description: 'Generuje morning digest' } },
  { id: 'wf_slack',   px: COL.wf,    py: 60+R*2,  type: 'sn', data: { label: '03 Slack → CRM',  category: 'workflow', status: 'live', path: 'webhook trigger',  description: 'Slack wiadomość → CRM ingest' } },
  { id: 'wf_quote',   px: COL.wf,    py: 60+R*3,  type: 'sn', data: { label: '04 Quote Follow', category: 'workflow', status: 'live', path: '09:00 pon-pt',     description: 'Follow-up wycen bez odpowiedzi' } },
  { id: 'wf_brief',   px: COL.wf,    py: 60+R*4,  type: 'sn', data: { label: '05 Morning Digest', category: 'workflow', status: 'live', path: '08:30 pon-pt',   description: 'Snapshot systemu → Slack brief' } },
  { id: 'wf_wapp',    px: COL.wf,    py: 60+R*5,  type: 'sn', data: { label: '06 WhatsApp→CRM', category: 'workflow', status: 'planned', path: 'webhook trigger', description: 'WhatsApp → notatki CRM' } },
  { id: 'wf_fire',    px: COL.wf,    py: 60+R*6,  type: 'sn', data: { label: '07 Fireflies',    category: 'workflow', status: 'planned', path: 'webhook trigger', description: 'Transkrypt → CRM notes + tasks' } },

  // ── API Routes ─────────────────────────────────────────────────────────────
  { id: 'api_clients',  px: COL.api,   py: 60,      type: 'sn', data: { label: 'Clients',       category: 'api', status: 'live', path: '/api/clients' } },
  { id: 'api_notes',    px: COL.api,   py: 60+R,    type: 'sn', data: { label: 'Notes Ingest',  category: 'api', status: 'live', path: '/api/clients/[id]/ingest' } },
  { id: 'api_audits',   px: COL.api,   py: 60+R*2,  type: 'sn', data: { label: 'Audits',        category: 'api', status: 'live', path: '/api/audits' } },
  { id: 'api_quotes',   px: COL.api,   py: 60+R*3,  type: 'sn', data: { label: 'Quotes',        category: 'api', status: 'live', path: '/api/quotes' } },
  { id: 'api_tasks',    px: COL.api,   py: 60+R*4,  type: 'sn', data: { label: 'Tasks',         category: 'api', status: 'live', path: '/api/tasks' } },
  { id: 'api_stack',    px: COL.api,   py: 60+R*5,  type: 'sn', data: { label: 'Stack',         category: 'api', status: 'live', path: '/api/clients/[id]/stack' } },
  { id: 'api_brief',    px: COL.api,   py: 60+R*6,  type: 'sn', data: { label: 'Meeting Brief', category: 'api', status: 'live', path: '/api/clients/[id]/meeting-prep' } },
  { id: 'api_analyze',  px: COL.api,   py: 60+R*7,  type: 'sn', data: { label: 'Scout Analyze', category: 'api', status: 'live', path: '/api/intelligence/analyze' } },
  { id: 'api_radar',    px: COL.api,   py: 60+R*8,  type: 'sn', data: { label: 'Radar Run',     category: 'api', status: 'live', path: '/api/intelligence/radar/run' } },
  { id: 'api_guardian', px: COL.api,   py: 60+R*9,  type: 'sn', data: { label: 'Guardian Run',  category: 'api', status: 'live', path: '/api/guardian/run' } },
  { id: 'api_operator', px: COL.api,   py: 60+R*10, type: 'sn', data: { label: 'Operator Chat', category: 'api', status: 'live', path: '/api/operator/chat' } },
  { id: 'api_slack_ev', px: COL.api,   py: 60+R*11, type: 'sn', data: { label: 'Slack Events',  category: 'api', status: 'live', path: '/api/webhooks/slack-events' } },
  { id: 'api_slack_cmd',px: COL.api,   py: 60+R*12, type: 'sn', data: { label: 'Slack Commands',category: 'api', status: 'live', path: '/api/slack/commands' } },
  { id: 'api_slack_ast',px: COL.api,   py: 60+R*13, type: 'sn', data: { label: 'Slack Assistant',category:'api', status: 'stub', path: '/api/slack/assistant' } },
  { id: 'api_snapshot', px: COL.api,   py: 60+R*14, type: 'sn', data: { label: 'System Snapshot',category:'api', status: 'live', path: '/api/system/snapshot' } },
  { id: 'api_errors',   px: COL.api,   py: 60+R*15, type: 'sn', data: { label: 'Errors',        category: 'api', status: 'live', path: '/api/errors' } },
  { id: 'api_ai_usage', px: COL.api,   py: 60+R*16, type: 'sn', data: { label: 'AI Usage',      category: 'api', status: 'live', path: '/api/ai-usage' } },
  { id: 'api_qfollowup',px: COL.api,   py: 60+R*17, type: 'sn', data: { label: 'Quote Follow-up',category:'api', status: 'live', path: '/api/quotes/followup' } },

  // ── Dashboard Pages ────────────────────────────────────────────────────────
  { id: 'pg_dash',      px: COL.page,  py: 60,      type: 'sn', data: { label: 'Dashboard',      category: 'page', status: 'live', path: '/dashboard' } },
  { id: 'pg_clients',   px: COL.page,  py: 60+R,    type: 'sn', data: { label: 'Klienci',        category: 'page', status: 'live', path: '/dashboard/clients' } },
  { id: 'pg_audit',     px: COL.page,  py: 60+R*2,  type: 'sn', data: { label: 'Audit Wizard',   category: 'page', status: 'live', path: '/dashboard/clients/[id]/audit' } },
  { id: 'pg_brief',     px: COL.page,  py: 60+R*3,  type: 'sn', data: { label: 'Meeting Brief',  category: 'page', status: 'live', path: '/dashboard/clients/[id]/prep' } },
  { id: 'pg_stack',     px: COL.page,  py: 60+R*4,  type: 'sn', data: { label: 'Stack Intelligence', category: 'page', status: 'live', path: '/dashboard/clients/[id]/stack' } },
  { id: 'pg_quotes',    px: COL.page,  py: 60+R*5,  type: 'sn', data: { label: 'Quote Builder',  category: 'page', status: 'live', path: '/dashboard/quotes' } },
  { id: 'pg_tasks',     px: COL.page,  py: 60+R*6,  type: 'sn', data: { label: 'Zadania',        category: 'page', status: 'live', path: '/dashboard/tasks' } },
  { id: 'pg_intel',     px: COL.page,  py: 60+R*7,  type: 'sn', data: { label: 'Intelligence Hub', category: 'page', status: 'live', path: '/dashboard/intelligence' } },
  { id: 'pg_guardian',  px: COL.page,  py: 60+R*8,  type: 'sn', data: { label: 'Guardian',       category: 'page', status: 'live', path: '/dashboard/guardian' } },
  { id: 'pg_operator',  px: COL.page,  py: 60+R*9,  type: 'sn', data: { label: 'Operator',       category: 'page', status: 'live', path: '/dashboard/operator' } },
  { id: 'pg_content',   px: COL.page,  py: 60+R*10, type: 'sn', data: { label: 'Content Studio', category: 'page', status: 'live', path: '/dashboard/content' } },
  { id: 'pg_costs',     px: COL.page,  py: 60+R*11, type: 'sn', data: { label: 'AI Costs',       category: 'page', status: 'live', path: '/dashboard/ai-costs' } },
  { id: 'pg_errors',    px: COL.page,  py: 60+R*12, type: 'sn', data: { label: 'Error Observatory', category: 'page', status: 'live', path: '/dashboard/errors' } },
  { id: 'pg_sysmap',    px: COL.page,  py: 60+R*13, type: 'sn', data: { label: 'System Map ←',   category: 'page', status: 'live', path: '/dashboard/system-map' } },
  { id: 'pg_settings',  px: COL.page,  py: 60+R*14, type: 'sn', data: { label: 'Settings',       category: 'page', status: 'live', path: '/dashboard/settings' } },
  { id: 'pg_portal',    px: COL.page,  py: 60+R*15, type: 'sn', data: { label: 'Client Portal',  category: 'page', status: 'stub', path: '/portal' } },

  // ── Database Tables ────────────────────────────────────────────────────────
  { id: 'db_clients',   px: COL.db,    py: 60,      type: 'sn', data: { label: 'clients',        category: 'database', status: 'live' } },
  { id: 'db_notes',     px: COL.db,    py: 60+R,    type: 'sn', data: { label: 'client_notes',   category: 'database', status: 'live' } },
  { id: 'db_tasks',     px: COL.db,    py: 60+R*2,  type: 'sn', data: { label: 'tasks',          category: 'database', status: 'live' } },
  { id: 'db_quotes',    px: COL.db,    py: 60+R*3,  type: 'sn', data: { label: 'quotes',         category: 'database', status: 'live' } },
  { id: 'db_audits',    px: COL.db,    py: 60+R*4,  type: 'sn', data: { label: 'audits',         category: 'database', status: 'live' } },
  { id: 'db_stack',     px: COL.db,    py: 60+R*5,  type: 'sn', data: { label: 'stack_items',    category: 'database', status: 'live' } },
  { id: 'db_ai_log',    px: COL.db,    py: 60+R*6,  type: 'sn', data: { label: 'ai_usage_log',   category: 'database', status: 'live' } },
  { id: 'db_errors',    px: COL.db,    py: 60+R*7,  type: 'sn', data: { label: 'error_log',      category: 'database', status: 'live' } },
  { id: 'db_digests',   px: COL.db,    py: 60+R*8,  type: 'sn', data: { label: 'intelligence_digests', category: 'database', status: 'live' } },
  { id: 'db_guardian',  px: COL.db,    py: 60+R*9,  type: 'sn', data: { label: 'guardian_reports', category: 'database', status: 'live' } },
  { id: 'db_content',   px: COL.db,    py: 60+R*10, type: 'sn', data: { label: 'content_posts',  category: 'database', status: 'live' } },
]

// ─── Edges ────────────────────────────────────────────────────────────────────

const mkEdge = (id: string, s: string, t: string, color: string, animated = false): Edge => ({
  id, source: s, target: t, animated,
  style: { stroke: color, strokeWidth: animated ? 1.5 : 1 },
  markerEnd: { type: MarkerType.ArrowClosed, color, width: 12, height: 12 },
})

const EDGES: Edge[] = [
  // External → Agents
  mkEdge('e1', 'claude',    'ag_scout',    '#C9A84C44'),
  mkEdge('e2', 'claude',    'ag_radar',    '#C9A84C44'),
  mkEdge('e3', 'claude',    'ag_guardian', '#C9A84C44'),
  mkEdge('e4', 'claude',    'ag_operator', '#C9A84C44'),
  mkEdge('e5', 'claude',    'ag_pa',       '#C9A84C44'),
  mkEdge('e6', 'slack_int', 'ag_pa',       '#34D39955', true),
  mkEdge('e7', 'gmail_int', 'ag_pa',       '#34D39933'),
  mkEdge('e8', 'gcal_int',  'ag_pa',       '#34D39933'),
  mkEdge('e9', 'hn_api',    'ag_radar',    '#34D39933'),
  mkEdge('e10','coingecko', 'ag_radar',    '#34D39933'),

  // n8n → API
  mkEdge('w1', 'wf_guardian','api_guardian', '#A78BFA66', true),
  mkEdge('w2', 'wf_radar',  'api_radar',    '#A78BFA66', true),
  mkEdge('w3', 'wf_slack',  'api_slack_ev', '#A78BFA66', true),
  mkEdge('w4', 'wf_quote',  'api_qfollowup','#A78BFA66', true),
  mkEdge('w5', 'wf_brief',  'api_snapshot', '#A78BFA66', true),
  mkEdge('w6', 'n8n',       'wf_guardian',  '#A78BFA33'),
  mkEdge('w7', 'n8n',       'wf_radar',     '#A78BFA33'),
  mkEdge('w8', 'n8n',       'wf_slack',     '#A78BFA33'),
  mkEdge('w9', 'n8n',       'wf_quote',     '#A78BFA33'),
  mkEdge('w10','n8n',       'wf_brief',     '#A78BFA33'),

  // Agents → API
  mkEdge('a1', 'ag_scout',    'api_analyze',  '#C9A84C55'),
  mkEdge('a2', 'ag_radar',    'api_radar',    '#C9A84C55'),
  mkEdge('a3', 'ag_guardian', 'api_guardian', '#C9A84C55'),
  mkEdge('a4', 'ag_operator', 'api_operator', '#C9A84C55'),
  mkEdge('a5', 'ag_pa',       'api_slack_ev', '#C9A84C55'),
  mkEdge('a6', 'ag_pa',       'api_slack_ast','#C9A84C55'),

  // API → Pages
  mkEdge('p1', 'api_clients',  'pg_clients',  '#60A5FA33'),
  mkEdge('p2', 'api_audits',   'pg_audit',    '#60A5FA33'),
  mkEdge('p3', 'api_brief',    'pg_brief',    '#60A5FA33'),
  mkEdge('p4', 'api_quotes',   'pg_quotes',   '#60A5FA33'),
  mkEdge('p5', 'api_tasks',    'pg_tasks',    '#60A5FA33'),
  mkEdge('p6', 'api_analyze',  'pg_intel',    '#60A5FA33'),
  mkEdge('p7', 'api_radar',    'pg_intel',    '#60A5FA33'),
  mkEdge('p8', 'api_guardian', 'pg_guardian', '#60A5FA33'),
  mkEdge('p9', 'api_operator', 'pg_operator', '#60A5FA33'),
  mkEdge('p10','api_stack',    'pg_stack',    '#60A5FA33'),
  mkEdge('p11','api_errors',   'pg_errors',   '#60A5FA33'),
  mkEdge('p12','api_ai_usage', 'pg_costs',    '#60A5FA33'),
  mkEdge('p13','api_snapshot', 'pg_sysmap',   '#60A5FA33'),
  mkEdge('p14','api_slack_cmd','pg_operator', '#60A5FA33'),

  // API → DB
  mkEdge('d1', 'api_clients',  'db_clients',  '#FB923C33'),
  mkEdge('d2', 'api_notes',    'db_notes',    '#FB923C33'),
  mkEdge('d3', 'api_tasks',    'db_tasks',    '#FB923C33'),
  mkEdge('d4', 'api_quotes',   'db_quotes',   '#FB923C33'),
  mkEdge('d5', 'api_audits',   'db_audits',   '#FB923C33'),
  mkEdge('d6', 'api_stack',    'db_stack',    '#FB923C33'),
  mkEdge('d7', 'api_radar',    'db_digests',  '#FB923C33'),
  mkEdge('d8', 'api_guardian', 'db_guardian', '#FB923C33'),
  mkEdge('d9', 'api_errors',   'db_errors',   '#FB923C33'),
  mkEdge('d10','api_ai_usage', 'db_ai_log',   '#FB923C33'),
  mkEdge('d11','api_slack_ev', 'db_notes',    '#FB923C55', true),

  // Slack bi-directional
  mkEdge('s1', 'api_guardian', 'slack_int',   '#34D39944', true),
  mkEdge('s2', 'api_qfollowup','resend',      '#34D39944'),
]

// ─── Tech Stack data ──────────────────────────────────────────────────────────

const TECH_STACK = [
  { name: 'Claude API (Haiku)', category: 'AI', status: 'live', usedBy: ['Guardian', 'PA', 'Notes Ingest'], cost: '~$0.001/call', notes: 'Fast filtering & summaries' },
  { name: 'Claude API (Sonnet)', category: 'AI', status: 'live', usedBy: ['Scout', 'Radar', 'Operator', 'Architect', 'Meeting Brief'], cost: '~$0.015/call', notes: 'Complex reasoning & generation' },
  { name: 'Supabase PostgreSQL', category: 'Database', status: 'live', usedBy: ['wszystkie API'], cost: 'Free tier', notes: 'RLS na każdej tabeli' },
  { name: 'Supabase Auth', category: 'Auth', status: 'live', usedBy: ['Dashboard login', 'Portal magic link'], cost: 'wliczone', notes: 'Magic link + OAuth' },
  { name: 'Vercel', category: 'Infra', status: 'live', usedBy: ['Next.js deploy'], cost: 'Hobby plan', notes: 'Edge CDN + serverless functions' },
  { name: 'Railway.app', category: 'Infra', status: 'live', usedBy: ['Telegram Forwarder'], cost: '$5/mo', notes: 'Python forwarder 24/7' },
  { name: 'GitHub Actions', category: 'CI/CD', status: 'live', usedBy: ['Auto-deploy forwarder'], cost: 'Free', notes: 'Trigger: push do scripts/telegram-forwarder/**' },
  { name: 'n8n', category: 'Automation', status: 'live', usedBy: ['Guardian cron', 'Radar cron', 'Quote follow-up', 'Morning digest', 'Slack→CRM'], cost: '$20/mo', notes: '5 aktywnych workflows' },
  { name: 'Slack', category: 'Communication', status: 'live', usedBy: ['PA', 'Guardian alerts', 'Morning digest', 'Slash commands'], cost: 'Free workspace', notes: 'Bot Token + Events API + 4 webhooks' },
  { name: 'Resend', category: 'Email', status: 'live', usedBy: ['Quote follow-up', 'Guardian alerts'], cost: 'Free tier', notes: 'Transactional email' },
  { name: 'Telegram MTProto', category: 'Communication', status: 'live', usedBy: ['Radar (źródło newsów)', 'Content ideas'], cost: 'Free', notes: 'Telethon, 13 kanałów, Railway host' },
  { name: 'Gmail MCP', category: 'MCP', status: 'live', usedBy: ['PA', 'Claude Code sessions'], cost: 'Free', notes: 'Aktywny w każdej sesji Claude' },
  { name: 'Google Calendar MCP', category: 'MCP', status: 'live', usedBy: ['PA', 'Claude Code sessions'], cost: 'Free', notes: 'Aktywny w każdej sesji Claude' },
  { name: 'Notion MCP', category: 'MCP', status: 'live', usedBy: ['PA', 'Claude Code sessions'], cost: 'Free', notes: 'Aktywny w każdej sesji Claude' },
  { name: 'Hacker News API', category: 'Data', status: 'live', usedBy: ['Radar'], cost: 'Free', notes: 'Top 10 stories + komentarze' },
  { name: 'CoinGecko API', category: 'Data', status: 'live', usedBy: ['Radar'], cost: 'Free tier', notes: 'BTC/ETH/SOL live prices + news' },
  { name: 'Next.js 16 App Router', category: 'Framework', status: 'live', usedBy: ['Frontend', 'API routes'], cost: 'Free OSS', notes: 'TypeScript strict, Tailwind v4, shadcn/ui' },
  { name: 'React Flow (@xyflow)', category: 'Library', status: 'live', usedBy: ['System Map', 'Stack Intelligence'], cost: 'Free OSS', notes: 'Grafy i diagramy' },
  { name: 'Vapi.ai', category: 'Voice AI', status: 'planned', usedBy: ['Voice Agent Demo (Tier 3)'], cost: '$0.05/min', notes: 'Demo dla klientów na spotkaniach' },
  { name: 'ElevenLabs', category: 'Voice AI', status: 'planned', usedBy: ['Voice Agent Demo (Tier 3)'], cost: '$5/mo', notes: 'Voice synthesis dla Vapi' },
  { name: 'Fireflies.ai', category: 'Transcription', status: 'planned', usedBy: ['Meeting transcripts → CRM'], cost: '$10/mo', notes: 'Webhook → auto-notatki ze spotkań' },
  { name: 'WhatsApp Business API', category: 'Communication', status: 'planned', usedBy: ['PA (wiadomości WhatsApp → CRM)'], cost: '$0.06/conv', notes: 'Tier 1: 5l' },
  { name: 'Perplexity MCP', category: 'MCP', status: 'planned', usedBy: ['Scout (live web research)', 'Radar'], cost: '$5/mo', notes: 'DO DODANIA: claude mcp add perplexity' },
  { name: 'Slack MCP', category: 'MCP', status: 'planned', usedBy: ['PA (full Slack access)'], cost: 'Free', notes: 'DO DODANIA: claude mcp add slack' },
]

// ─── Stats ────────────────────────────────────────────────────────────────────

function StatsBar({ nodes, activeFilter, onFilter }: {
  nodes: RawNode[]
  activeFilter: string
  onFilter: (f: string) => void
}) {
  const live = nodes.filter(n => n.data.status === 'live').length
  const planned = nodes.filter(n => n.data.status === 'planned').length
  const agents = nodes.filter(n => n.data.category === 'agent').length
  const workflows = nodes.filter(n => n.data.category === 'workflow').length

  const filters = [
    { key: 'all',         label: 'Wszystkie', color: '#888' },
    { key: 'agent',       label: '🤖 Agenty',       color: C.agent.border },
    { key: 'workflow',    label: '⚡ Workflows',    color: C.workflow.border },
    { key: 'api',         label: '🔗 API',          color: C.api.border },
    { key: 'page',        label: '🖥️ Pages',        color: C.page.border },
    { key: 'database',    label: '🗄️ Database',     color: C.database.border },
    { key: 'integration', label: '🔌 Integracje',   color: C.integration.border },
  ]

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', gap: 24, marginBottom: 12, flexWrap: 'wrap' }}>
        {[
          { v: live,      label: 'Live',         color: '#22C55E' },
          { v: planned,   label: 'Planned',      color: '#EAB308' },
          { v: agents,    label: 'AI Agents',    color: C.agent.border },
          { v: workflows, label: 'n8n Workflows', color: C.workflow.border },
          { v: TECH_STACK.filter(t => t.status === 'live').length, label: 'Tech Tools', color: C.integration.border },
        ].map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.v}</span>
            <span style={{ fontSize: 11, color: t.text.muted }}>{s.label}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => onFilter(f.key)}
            style={{
              padding: '4px 12px', borderRadius: 20, border: `1px solid ${activeFilter === f.key ? f.color : t.border.default}`,
              background: activeFilter === f.key ? `${f.color}18` : 'transparent',
              color: activeFilter === f.key ? f.color : t.text.muted,
              fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
            }}
          >{f.label}</button>
        ))}
      </div>
    </div>
  )
}

// ─── Detail sidebar ───────────────────────────────────────────────────────────

function NodeDetail({ node, onClose }: { node: Node; onClose: () => void }) {
  const d = node.data as unknown as SNode
  const c = C[d.category]
  const connectedEdges = EDGES.filter(e => e.source === node.id || e.target === node.id)
  const connectedIds = [...new Set(connectedEdges.map(e => e.source === node.id ? e.target : e.source))]
  const connectedNodes = connectedIds.map(id => RAW_NODES.find(n => n.id === id)).filter(Boolean) as RawNode[]

  return (
    <div style={{
      position: 'absolute', top: 0, right: 0, width: 280, height: '100%',
      background: 'rgba(12,12,16,0.97)', backdropFilter: 'blur(12px)',
      borderLeft: `1px solid ${c.border}44`, padding: 20, zIndex: 10, overflowY: 'auto',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: c.text, marginBottom: 5 }}>
            {c.icon} {c.label}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: t.text.primary }}>{d.label}</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: t.text.muted, cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        <span style={{
          fontSize: 10, padding: '3px 9px', borderRadius: 12,
          background: d.status === 'live' ? '#22C55E18' : '#EAB30818',
          border: `1px solid ${d.status === 'live' ? '#22C55E44' : '#EAB30844'}`,
          color: d.status === 'live' ? '#22C55E' : d.status === 'stub' ? '#EAB308' : '#6B7280',
        }}>
          {d.status === 'live' ? '● Live' : d.status === 'stub' ? '○ In Progress' : '◌ Planned'}
        </span>
        {d.model && (
          <span style={{ fontSize: 10, padding: '3px 9px', borderRadius: 12, background: '#C9A84C18', border: '1px solid #C9A84C44', color: '#C9A84C' }}>
            {d.model}
          </span>
        )}
      </div>

      {d.path && (
        <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#818CF8', background: 'rgba(129,140,248,0.08)', padding: '6px 10px', borderRadius: 6, marginBottom: 12, wordBreak: 'break-all' }}>
          {d.path}
        </div>
      )}

      {d.description && (
        <p style={{ fontSize: 12.5, color: t.text.secondary, lineHeight: 1.65, margin: '0 0 16px' }}>{d.description}</p>
      )}

      {connectedNodes.length > 0 && (
        <>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: t.text.muted, marginBottom: 8 }}>
            Powiązania ({connectedNodes.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {connectedNodes.map(cn => {
              const cc = C[cn.data.category]
              return (
                <div key={cn.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 6, background: `${cc.border}0C`, border: `1px solid ${cc.border}22` }}>
                  <span style={{ fontSize: 10 }}>{cc.icon}</span>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: t.text.primary }}>{cn.data.label}</div>
                    {cn.data.path && <div style={{ fontSize: 9, color: t.text.muted, fontFamily: 'monospace' }}>{cn.data.path}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {d.path && d.path.startsWith('/dashboard') && (
        <a href={d.path} style={{
          display: 'block', marginTop: 16, textAlign: 'center', padding: '8px 0',
          border: `1px solid ${c.border}44`, borderRadius: 8,
          color: c.text, fontSize: 12, fontWeight: 600, textDecoration: 'none',
          background: `${c.border}0A`,
        }}>
          Otwórz stronę →
        </a>
      )}
    </div>
  )
}

// ─── Tech Stack tab ───────────────────────────────────────────────────────────

const CATEGORY_ORDER = ['AI', 'Framework', 'Database', 'Auth', 'Infra', 'CI/CD', 'Automation', 'Communication', 'Email', 'Data', 'MCP', 'Library', 'Voice AI', 'Transcription']

function TechStackView() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'live' | 'planned'>('all')

  const filtered = TECH_STACK.filter(t => {
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.usedBy.some(u => u.toLowerCase().includes(search.toLowerCase()))
    const matchStatus = filter === 'all' || t.status === filter
    return matchSearch && matchStatus
  })

  const grouped = CATEGORY_ORDER.reduce((acc, cat) => {
    const items = filtered.filter(t => t.category === cat)
    if (items.length) acc[cat] = items
    return acc
  }, {} as Record<string, typeof TECH_STACK>)

  const liveCnt = TECH_STACK.filter(t => t.status === 'live').length
  const plannedCnt = TECH_STACK.filter(t => t.status === 'planned').length

  return (
    <div style={{ padding: '0 0 40px' }}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          placeholder="Szukaj narzędzia lub agenta..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200, padding: '8px 14px', borderRadius: 8, border: `1px solid ${t.border.default}`, background: 'rgba(255,255,255,0.04)', color: t.text.primary, fontSize: 13, outline: 'none' }}
        />
        {(['all', 'live', 'planned'] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{
            padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            border: `1px solid ${filter === s ? '#818CF8' : t.border.default}`,
            background: filter === s ? 'rgba(129,140,248,0.12)' : 'transparent',
            color: filter === s ? '#818CF8' : t.text.muted,
          }}>
            {s === 'all' ? `Wszystkie (${liveCnt + plannedCnt})` : s === 'live' ? `✅ Live (${liveCnt})` : `⏳ Planned (${plannedCnt})`}
          </button>
        ))}
      </div>

      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat} style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: t.text.muted, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            {cat}
            <div style={{ flex: 1, height: 1, background: t.border.subtle }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 8 }}>
            {items.map(tool => (
              <div key={tool.name} style={{
                padding: '12px 14px', borderRadius: 10,
                border: `1px solid ${tool.status === 'live' ? '#22C55E22' : '#EAB30818'}`,
                background: tool.status === 'live' ? 'rgba(34,197,94,0.04)' : 'rgba(234,179,8,0.04)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: t.text.primary }}>{tool.name}</span>
                  <div style={{ display: 'flex', gap: 5, flexShrink: 0, marginLeft: 8 }}>
                    <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 8, background: tool.status === 'live' ? '#22C55E18' : '#EAB30818', color: tool.status === 'live' ? '#22C55E' : '#EAB308', fontWeight: 700 }}>
                      {tool.status === 'live' ? 'LIVE' : 'PLANNED'}
                    </span>
                    {tool.cost && (
                      <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', color: t.text.muted }}>{tool.cost}</span>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: t.text.muted, marginBottom: 4 }}>{tool.notes}</div>
                <div style={{ fontSize: 10, color: '#818CF8' }}>
                  Używany przez: {tool.usedBy.join(', ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function SystemMap() {
  const [selected, setSelected] = useState<Node | null>(null)
  const [activeFilter, setActiveFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'architecture' | 'stack'>('architecture')

  const nodes: Node[] = useMemo(() => {
    return RAW_NODES
      .filter(n => {
        const matchFilter = activeFilter === 'all' || n.data.category === activeFilter
        const matchSearch = !search || n.data.label.toLowerCase().includes(search.toLowerCase()) || n.data.description?.toLowerCase().includes(search.toLowerCase()) || n.data.path?.toLowerCase().includes(search.toLowerCase())
        return matchFilter && matchSearch
      })
      .map(n => ({
        id: n.id,
        type: 'sn',
        data: n.data as unknown as Record<string, unknown>,
        position: { x: n.px, y: n.py },
      }))
  }, [activeFilter, search])

  const visibleIds = new Set(nodes.map(n => n.id))
  const edges = useMemo(() =>
    EDGES.filter(e => visibleIds.has(e.source) && visibleIds.has(e.target)),
    [nodes] // eslint-disable-line
  )

  const onNodeClick: NodeMouseHandler = useCallback((_evt, node) => {
    setSelected(node)
  }, [])

  const sections = [
    { title: 'External Services', color: C.integration.border, icon: '🔌', x: COL.ext - 10, y: 30, w: 190 },
    { title: 'AI Agents', color: C.agent.border, icon: '🤖', x: COL.agent - 10, y: 30, w: 190 },
    { title: 'n8n Workflows', color: C.workflow.border, icon: '⚡', x: COL.wf - 10, y: 30, w: 190 },
    { title: 'API Layer', color: C.api.border, icon: '🔗', x: COL.api - 10, y: 30, w: 190 },
    { title: 'Dashboard Pages', color: C.page.border, icon: '🖥️', x: COL.page - 10, y: 30, w: 190 },
    { title: 'Database', color: C.database.border, icon: '🗄️', x: COL.db - 10, y: 30, w: 190 },
  ]

  return (
    <div>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: `1px solid ${t.border.subtle}` }}>
        {([['architecture', '🗺️ Architektura'], ['stack', '📦 Tech Stack']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            style={{
              padding: '8px 20px', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
              color: activeTab === key ? '#818CF8' : t.text.muted,
              borderBottom: `2px solid ${activeTab === key ? '#818CF8' : 'transparent'}`,
              marginBottom: -1,
            }}
          >{label}</button>
        ))}
      </div>

      {activeTab === 'stack' ? <TechStackView /> : (
        <>
          <StatsBar nodes={RAW_NODES} activeFilter={activeFilter} onFilter={f => { setActiveFilter(f); setSelected(null) }} />

          {/* Search */}
          <div style={{ marginBottom: 12 }}>
            <input
              placeholder="Szukaj modułu, ścieżki, opisu..."
              value={search}
              onChange={e => { setSearch(e.target.value); setSelected(null) }}
              style={{ width: '100%', padding: '7px 14px', borderRadius: 8, border: `1px solid ${t.border.default}`, background: 'rgba(255,255,255,0.04)', color: t.text.primary, fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 12 }}>
            {(Object.entries(C) as [Cat, typeof C[Cat]][]).map(([key, c]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: c.border }} />
                <span style={{ fontSize: 10, color: t.text.muted }}>{c.label}</span>
              </div>
            ))}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}>
              {[['#22C55E', '● Live'], ['#EAB308', '● In Progress'], ['#6B7280', '● Planned']].map(([col, label]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ color: col, fontSize: 10 }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Graph */}
          <div style={{ position: 'relative', width: '100%', height: 780, borderRadius: 14, overflow: 'hidden', background: '#07070B', border: `1px solid ${t.border.subtle}` }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodeClick={onNodeClick}
              onPaneClick={() => setSelected(null)}
              connectionLineType={ConnectionLineType.SmoothStep}
              fitView
              fitViewOptions={{ padding: 0.1 }}
              style={{ background: 'transparent' }}
              proOptions={{ hideAttribution: true }}
            >
              <Background color="rgba(255,255,255,0.018)" variant={BackgroundVariant.Dots} gap={28} size={1} />
              <Controls
                style={{ background: 'rgba(20,20,26,0.9)', border: `1px solid ${t.border.default}`, borderRadius: 8 }}
              />
              <MiniMap
                style={{ background: 'rgba(20,20,26,0.9)', border: `1px solid ${t.border.default}`, borderRadius: 8 }}
                nodeColor={n => {
                  const d = n.data as unknown as SNode
                  return C[d?.category ?? 'page']?.border ?? '#888'
                }}
              />
              {/* Section headers as panels */}
              <Panel position="top-left" style={{ pointerEvents: 'none', position: 'absolute', inset: 0 }}>
                {sections.map(s => (
                  <SectionHeader key={s.title} {...s} width={s.w} count={RAW_NODES.filter(n => {
                    const catMap: Record<string, Cat[]> = {
                      'External Services': ['integration', 'infra'],
                      'AI Agents': ['agent'],
                      'n8n Workflows': ['workflow'],
                      'API Layer': ['api'],
                      'Dashboard Pages': ['page'],
                      'Database': ['database'],
                    }
                    return catMap[s.title]?.includes(n.data.category) ?? false
                  }).length} />
                ))}
              </Panel>
            </ReactFlow>
            {selected && <NodeDetail node={selected} onClose={() => setSelected(null)} />}
          </div>

          <div style={{ marginTop: 8, fontSize: 11, color: t.text.muted, textAlign: 'center' }}>
            Kliknij węzeł aby zobaczyć szczegóły i powiązania · Scroll lub pinch aby zoomować · Drag aby przesuwać
          </div>
        </>
      )}
    </div>
  )
}
