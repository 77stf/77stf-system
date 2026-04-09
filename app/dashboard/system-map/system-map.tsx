'use client'

import { useState, useMemo } from 'react'
import {
  ReactFlow, Background, Controls, MiniMap,
  type Node, type Edge, ConnectionLineType, BackgroundVariant, MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { t } from '@/lib/tokens'

// ─── Types ────────────────────────────────────────────────────────────────────

type Cat = 'integration' | 'agent' | 'workflow' | 'api' | 'page' | 'database' | 'infra'
type Status = 'live' | 'stub' | 'planned'

interface SNode {
  id: string
  label: string
  category: Cat
  status: Status
  description?: string
  path?: string
  model?: string
  connects?: string[]
  tier?: string
  cost?: string
}

// ─── Design ───────────────────────────────────────────────────────────────────

const C: Record<Cat, { border: string; bg: string; text: string; icon: string; label: string }> = {
  integration: { border: '#34D399', bg: 'rgba(52,211,153,0.07)',  text: '#34D399', icon: '🔌', label: 'Integracja' },
  agent:       { border: '#C9A84C', bg: 'rgba(196,154,46,0.09)',  text: '#C9A84C', icon: '🤖', label: 'Agent AI' },
  workflow:    { border: '#A78BFA', bg: 'rgba(167,139,250,0.09)', text: '#A78BFA', icon: '⚡', label: 'Workflow' },
  api:         { border: '#818CF8', bg: 'rgba(129,140,248,0.07)', text: '#818CF8', icon: '🔗', label: 'API' },
  page:        { border: '#60A5FA', bg: 'rgba(96,165,250,0.07)',  text: '#60A5FA', icon: '🖥️', label: 'Strona' },
  database:    { border: '#FB923C', bg: 'rgba(251,146,60,0.07)',  text: '#FB923C', icon: '🗄️', label: 'Baza' },
  infra:       { border: '#F472B6', bg: 'rgba(244,114,182,0.07)', text: '#F472B6', icon: '🏗️', label: 'Infra' },
}

const STATUS = {
  live:    { color: '#22C55E', label: 'Live',    dot: '●' },
  stub:    { color: '#EAB308', label: 'W toku',  dot: '◐' },
  planned: { color: '#4B5563', label: 'Planned', dot: '○' },
}

// ─── All nodes data ───────────────────────────────────────────────────────────

const NODES: SNode[] = [
  // External integrations
  { id: 'supabase',   label: 'Supabase',        category: 'database',    status: 'live',    description: 'PostgreSQL + RLS + Auth magic link', cost: 'Free tier', connects: ['api_clients','api_tasks','api_quotes','api_audits','api_notes','api_errors','api_ai_usage'] },
  { id: 'claude',     label: 'Claude API',      category: 'integration', status: 'live',    description: 'Haiku (fast) + Sonnet (smart) — core AI', cost: '~$15/mies', connects: ['ag_scout','ag_radar','ag_guardian','ag_operator','ag_pa','ag_architect'] },
  { id: 'slack',      label: 'Slack',           category: 'integration', status: 'live',    description: 'Bot token + Events API + 4 outgoing webhooks', cost: 'Free', connects: ['api_slack_ev','api_slack_cmd','api_slack_ast'] },
  { id: 'gmail',      label: 'Gmail MCP',       category: 'integration', status: 'live',    description: 'Aktywny w każdej sesji Claude Code', cost: 'Free' },
  { id: 'gcal',       label: 'Google Calendar', category: 'integration', status: 'live',    description: 'Aktywny w każdej sesji Claude Code', cost: 'Free' },
  { id: 'notion',     label: 'Notion MCP',      category: 'integration', status: 'live',    description: 'Knowledge base, aktywny w sesji', cost: 'Free' },
  { id: 'resend',     label: 'Resend',          category: 'integration', status: 'live',    description: 'Email transakcyjny — quote follow-up', cost: 'Free tier', connects: ['api_qfollowup'] },
  { id: 'telegram',   label: 'Telegram',        category: 'integration', status: 'live',    description: '13 kanałów → group topics, Telethon MTProto', cost: 'Free' },
  { id: 'hn',         label: 'Hacker News',     category: 'integration', status: 'live',    description: 'Top 10 stories API dla Radar', cost: 'Free', connects: ['ag_radar'] },
  { id: 'coingecko',  label: 'CoinGecko',       category: 'integration', status: 'live',    description: 'BTC/ETH/SOL live ceny dla Radar', cost: 'Free', connects: ['ag_radar'] },
  { id: 'vercel',     label: 'Vercel',          category: 'infra',       status: 'live',    description: 'Deploy Next.js + Edge CDN', cost: 'Hobby plan', connects: ['pg_dash'] },
  { id: 'railway',    label: 'Railway',         category: 'infra',       status: 'live',    description: 'Telegram forwarder 24/7 Python', cost: '$5/mies' },
  { id: 'github',     label: 'GitHub Actions',  category: 'infra',       status: 'live',    description: 'Auto-deploy forwarder gdy zmiana w scripts/telegram-forwarder/**', cost: 'Free' },
  { id: 'n8n',        label: 'n8n',             category: 'infra',       status: 'live',    description: '5 aktywnych workflows, cron + webhooks', cost: '$20/mies', connects: ['wf_guardian','wf_radar','wf_slack','wf_quote','wf_brief'] },
  { id: 'vapi',       label: 'Vapi.ai',         category: 'integration', status: 'planned', description: 'Voice Agent platform — demo dla klientów', cost: '$0.05/min', tier: 'Tier 3' },
  { id: 'elevenlabs', label: 'ElevenLabs',      category: 'integration', status: 'planned', description: 'Voice synthesis dla Vapi', cost: '$5/mies', tier: 'Tier 3' },
  { id: 'fireflies',  label: 'Fireflies.ai',    category: 'integration', status: 'planned', description: 'Transkrypt spotkań → CRM auto-notatki', cost: '$10/mies', tier: 'Tier 1' },
  { id: 'whatsapp',   label: 'WhatsApp API',    category: 'integration', status: 'planned', description: 'Wiadomości WhatsApp → CRM notes', cost: '$0.06/conv', tier: 'Tier 1' },
  { id: 'perplexity', label: 'Perplexity MCP',  category: 'integration', status: 'planned', description: 'Live web research dla Scout + Radar', cost: '$5/mies', tier: 'Do dodania: claude mcp add perplexity' },
  { id: 'slack_mcp',  label: 'Slack MCP',       category: 'integration', status: 'planned', description: 'Full Slack access dla PA', cost: 'Free', tier: 'Do dodania: claude mcp add slack' },

  // AI Agents
  { id: 'ag_scout',    label: 'Scout 🎬',     category: 'agent', status: 'live',    model: 'Sonnet', description: 'URL/tekst → analiza → BUILD/SKIP/UPGRADE/MONITOR', path: '/dashboard/intelligence → Scout', connects: ['api_analyze'] },
  { id: 'ag_radar',    label: 'Radar 🔬',     category: 'agent', status: 'live',    model: 'Sonnet', description: 'AI/crypto/biznes morning digest, codziennie 07:00', path: '/dashboard/intelligence → Radar', connects: ['api_radar'] },
  { id: 'ag_guardian', label: 'Guardian 🛡️', category: 'agent', status: 'live',    model: 'Haiku',  description: '5 reguł monitoringu, action_type per alert, recommend_prompt', path: '/dashboard/guardian', connects: ['api_guardian'] },
  { id: 'ag_operator', label: 'Operator 🤖', category: 'agent', status: 'live',    model: 'Sonnet', description: 'NL → CRM actions, 8 narzędzi, agentic loop max 5 iteracji', path: '/dashboard/operator', connects: ['api_operator'] },
  { id: 'ag_pa',       label: 'PA 💬',        category: 'agent', status: 'live',    model: 'Haiku',  description: 'Slack notatki → CRM, Calendar hints, daily brief', connects: ['api_slack_ev','api_slack_ast'] },
  { id: 'ag_architect',label: 'Architect 🏗️',category: 'agent', status: 'live',    model: 'Sonnet', description: 'Stack klientów, ROI kalkulacje, audit analysis', path: '/dashboard/clients/[id]/stack' },
  { id: 'ag_hunter',   label: 'Hunter 🎯',   category: 'agent', status: 'planned', model: 'Sonnet', description: 'Lead research, scoring, cold outreach (wymaga zatwierdzenia)', tier: 'Tier 2' },

  // n8n Workflows
  { id: 'wf_guardian', label: '01 Guardian Cron',    category: 'workflow', status: 'live',    description: 'Codziennie 08:00 → POST /api/guardian/run + Slack alert', connects: ['api_guardian'] },
  { id: 'wf_radar',    label: '02 Radar Cron',       category: 'workflow', status: 'live',    description: 'Codziennie 07:00 → POST /api/intelligence/radar/run', connects: ['api_radar'] },
  { id: 'wf_slack',    label: '03 Slack → CRM',      category: 'workflow', status: 'live',    description: 'Webhook trigger → /api/webhooks/slack-ingest → opcjonalnie Calendar', connects: ['api_slack_ev'] },
  { id: 'wf_quote',    label: '04 Quote Follow-up',  category: 'workflow', status: 'live',    description: 'Pon-pt 09:00 → Guardian alerts → /api/quotes/followup → Resend email', connects: ['api_qfollowup'] },
  { id: 'wf_brief',    label: '05 Morning Digest',   category: 'workflow', status: 'live',    description: 'Pon-pt 08:30 → /api/system/snapshot → formatuj → Slack #daily-brief', connects: ['api_snapshot'] },
  { id: 'wf_wapp',     label: '06 WhatsApp→CRM',     category: 'workflow', status: 'planned', description: 'Webhook Meta → /api/webhooks/whatsapp → CRM notes', tier: 'Tier 1' },
  { id: 'wf_fireflies',label: '07 Fireflies',        category: 'workflow', status: 'planned', description: 'Webhook Fireflies → /api/webhooks/fireflies → notes + tasks', tier: 'Tier 1' },

  // API Routes
  { id: 'api_clients',   label: 'Clients',         category: 'api', status: 'live', path: '/api/clients',                      description: 'CRUD klientów, RLS', connects: ['supabase'] },
  { id: 'api_notes',     label: 'Notes Ingest',    category: 'api', status: 'live', path: '/api/clients/[id]/ingest',           description: 'Raw text → Haiku → structured notes', connects: ['supabase'] },
  { id: 'api_audits',    label: 'Audits',          category: 'api', status: 'live', path: '/api/audits',                       description: '29 pytań, 6 kategorii, ROI pricing', connects: ['supabase'] },
  { id: 'api_quotes',    label: 'Quotes',          category: 'api', status: 'live', path: '/api/quotes',                       description: 'Wyceny z pozycjami, statusy', connects: ['supabase'] },
  { id: 'api_tasks',     label: 'Tasks',           category: 'api', status: 'live', path: '/api/tasks',                        description: 'Zadania z priorytetami, deadline, klientem', connects: ['supabase'] },
  { id: 'api_stack',     label: 'Stack',           category: 'api', status: 'live', path: '/api/clients/[id]/stack',           description: 'Tech stack klienta, React Flow visual', connects: ['supabase'] },
  { id: 'api_brief',     label: 'Meeting Brief',   category: 'api', status: 'live', path: '/api/clients/[id]/meeting-prep',    description: 'Sonnet + CoT + dane z audytu → brief', connects: ['supabase'] },
  { id: 'api_analyze',   label: 'Scout Analyze',   category: 'api', status: 'live', path: '/api/intelligence/analyze',         description: 'URL/tekst → Sonnet → BUILD/SKIP decyzja' },
  { id: 'api_radar',     label: 'Radar Run',       category: 'api', status: 'live', path: '/api/intelligence/radar/run',       description: 'HN + CoinGecko + Sonnet → digest + Slack', connects: ['supabase'] },
  { id: 'api_guardian',  label: 'Guardian Run',    category: 'api', status: 'live', path: '/api/guardian/run',                 description: '5 reguł → Haiku → alerty → Slack', connects: ['supabase'] },
  { id: 'api_operator',  label: 'Operator Chat',   category: 'api', status: 'live', path: '/api/operator/chat',                description: 'Sonnet tool use, agentic loop, 8 narzędzi CRM' },
  { id: 'api_slack_ev',  label: 'Slack Events',    category: 'api', status: 'live', path: '/api/webhooks/slack-events',        description: 'Signature verify → PA → CRM notes', connects: ['supabase'] },
  { id: 'api_slack_cmd', label: 'Slack Commands',  category: 'api', status: 'live', path: '/api/slack/commands',               description: '/77status /77clients /77quote /77tasks /77help', connects: ['supabase'] },
  { id: 'api_slack_ast', label: 'Slack Assistant', category: 'api', status: 'stub', path: '/api/slack/assistant',              description: 'AI asystent odpowiada w wątku Slack — w budowie' },
  { id: 'api_snapshot',  label: 'System Snapshot', category: 'api', status: 'live', path: '/api/system/snapshot',              description: 'JSON pełnego stanu systemu dla agentów i n8n' },
  { id: 'api_errors',    label: 'Errors',          category: 'api', status: 'live', path: '/api/errors',                       description: 'Error log, admin-only DELETE', connects: ['supabase'] },
  { id: 'api_ai_usage',  label: 'AI Usage',        category: 'api', status: 'live', path: '/api/ai-usage',                     description: 'Koszty AI per model, projekcja, trend 30 dni', connects: ['supabase'] },
  { id: 'api_qfollowup', label: 'Quote Follow-up', category: 'api', status: 'live', path: '/api/quotes/followup',              description: 'Webhook secret bypass → Resend email → CRM note', connects: ['supabase','resend'] },

  // Dashboard Pages
  { id: 'pg_dash',     label: 'Dashboard',          category: 'page', status: 'live', path: '/dashboard',                      description: 'Command Center — KPIs, aktywność, shortcuts' },
  { id: 'pg_clients',  label: 'Klienci',            category: 'page', status: 'live', path: '/dashboard/clients',              description: 'CRUD klientów, pipeline statusy, notatki' },
  { id: 'pg_audit',    label: 'Audit Wizard',       category: 'page', status: 'live', path: '/dashboard/clients/[id]/audit',   description: '29 pytań, 6 kategorii, Strefa Konsultanta, Audit→Quote' },
  { id: 'pg_brief',    label: 'Meeting Brief',      category: 'page', status: 'live', path: '/dashboard/clients/[id]/prep',    description: 'AI brief przed spotkaniem — Sonnet + CoT' },
  { id: 'pg_stack',    label: 'Stack Intelligence', category: 'page', status: 'live', path: '/dashboard/clients/[id]/stack',   description: 'React Flow visual + AI Discovery Agent' },
  { id: 'pg_quotes',   label: 'Quote Builder',      category: 'page', status: 'live', path: '/dashboard/quotes',               description: 'Wyceny z pozycjami, statusy, stats' },
  { id: 'pg_tasks',    label: 'Zadania',            category: 'page', status: 'live', path: '/dashboard/tasks',                description: 'Zadania z priorytetami, deadline, klientem' },
  { id: 'pg_intel',    label: 'Intelligence Hub',   category: 'page', status: 'live', path: '/dashboard/intelligence',         description: 'Command Center + Scout + Radar + Global Stack Map' },
  { id: 'pg_guardian', label: 'Guardian',           category: 'page', status: 'live', path: '/dashboard/guardian',             description: '5 reguł, historia raportów, action buttons' },
  { id: 'pg_operator', label: 'Operator',           category: 'page', status: 'live', path: '/dashboard/operator',             description: 'Chat UI → Sonnet tool use → CRM actions' },
  { id: 'pg_content',  label: 'Content Studio',     category: 'page', status: 'live', path: '/dashboard/content',              description: 'Kanban postów, AI Ideas (Sonnet), filtr platformy' },
  { id: 'pg_costs',    label: 'AI Costs',           category: 'page', status: 'live', path: '/dashboard/ai-costs',             description: 'Koszty AI — projekcja, per-client, budget alert, trend' },
  { id: 'pg_errors',   label: 'Error Observatory',  category: 'page', status: 'live', path: '/dashboard/errors',               description: 'Logi błędów systemu, admin-only DELETE' },
  { id: 'pg_sysmap',   label: 'System Map ←',       category: 'page', status: 'live', path: '/dashboard/system-map',           description: 'Ta strona — pełna mapa architektury systemu' },
  { id: 'pg_settings', label: 'Settings',           category: 'page', status: 'live', path: '/dashboard/settings',             description: 'Status env vars, konto, MCP, pending migracje' },
  { id: 'pg_portal',   label: 'Client Portal',      category: 'page', status: 'stub', path: '/portal',                         description: 'Magic Link auth — panel wdrożeń i dokumentów dla klienta' },

  // Database tables
  { id: 'db_clients',  label: 'clients',              category: 'database', status: 'live', description: 'name, status, industry, owner, contact_name, contact_email' },
  { id: 'db_notes',    label: 'client_notes',         category: 'database', status: 'live', description: 'client_id, content, type, created_at — Slack + manual' },
  { id: 'db_tasks',    label: 'tasks',                category: 'database', status: 'live', description: 'client_id, title, priority, deadline, done' },
  { id: 'db_quotes',   label: 'quotes',               category: 'database', status: 'live', description: 'client_id, items[], total, status, sent_at' },
  { id: 'db_audits',   label: 'audits',               category: 'database', status: 'live', description: 'client_id, answers{}, score, roi_estimate, context_data' },
  { id: 'db_stack',    label: 'stack_items',          category: 'database', status: 'live', description: 'client_id, name, category, status, cost_monthly' },
  { id: 'db_ai_log',   label: 'ai_usage_log',         category: 'database', status: 'live', description: 'model, tokens_in, tokens_out, cost_usd, source, client_id' },
  { id: 'db_errors',   label: 'error_log',            category: 'database', status: 'live', description: 'source, message, metadata, created_at' },
  { id: 'db_digests',  label: 'intelligence_digests', category: 'database', status: 'live', description: 'type, content, sources[], created_at — Radar historia' },
  { id: 'db_guardian', label: 'guardian_reports',     category: 'database', status: 'live', description: 'alerts[], summary, run_at — Guardian historia' },
  { id: 'db_content',  label: 'content_posts',        category: 'database', status: 'live', description: 'platform, content, status, published_at — Content Studio' },
]

// ─── Sections config ──────────────────────────────────────────────────────────

const SECTIONS: { key: Cat | 'infra'; label: string; icon: string; cats: Cat[] }[] = [
  { key: 'integration', label: 'Zewnętrzne', icon: '🔌', cats: ['integration', 'infra'] },
  { key: 'agent',       label: 'Agenty AI',  icon: '🤖', cats: ['agent'] },
  { key: 'workflow',    label: 'Workflows',  icon: '⚡', cats: ['workflow'] },
  { key: 'api',         label: 'API',        icon: '🔗', cats: ['api'] },
  { key: 'page',        label: 'Strony',     icon: '🖥️', cats: ['page'] },
  { key: 'database',    label: 'Baza',       icon: '🗄️', cats: ['database'] },
]

// ─── Tech stack ───────────────────────────────────────────────────────────────

const TECH: { name: string; cat: string; status: Status; cost: string; usedBy: string; notes: string }[] = [
  { name: 'Claude Haiku',      cat: 'AI',         status: 'live',    cost: '~$0.001/call', usedBy: 'Guardian, PA, Notes Ingest',          notes: 'Szybkie filtrowanie i podsumowania' },
  { name: 'Claude Sonnet',     cat: 'AI',         status: 'live',    cost: '~$0.015/call', usedBy: 'Scout, Radar, Operator, Brief',        notes: 'Złożone rozumowanie i generowanie' },
  { name: 'Next.js 16',        cat: 'Framework',  status: 'live',    cost: 'Free OSS',     usedBy: 'Frontend + API routes',                notes: 'App Router, TypeScript strict, Tailwind v4' },
  { name: 'Supabase',          cat: 'Database',   status: 'live',    cost: 'Free tier',    usedBy: 'Wszystkie API',                         notes: 'PostgreSQL + RLS na każdej tabeli + Auth' },
  { name: 'Vercel',            cat: 'Infra',      status: 'live',    cost: 'Hobby plan',   usedBy: 'Deploy Next.js',                        notes: 'Edge CDN, serverless functions' },
  { name: 'Railway',           cat: 'Infra',      status: 'live',    cost: '$5/mies',      usedBy: 'Telegram Forwarder',                    notes: 'Python 24/7, auto-deploy via GitHub Actions' },
  { name: 'n8n',               cat: 'Automation', status: 'live',    cost: '$20/mies',     usedBy: '5 workflows (Guardian, Radar, Quote…)', notes: 'Sync via sync.mjs, webhooks + cron' },
  { name: 'Slack',             cat: 'Comm',       status: 'live',    cost: 'Free',         usedBy: 'PA, Guardian, Digest, Slash commands',  notes: 'Bot token + 4 webhooks + Events API' },
  { name: 'Resend',            cat: 'Email',      status: 'live',    cost: 'Free tier',    usedBy: 'Quote follow-up, Guardian alerts',       notes: 'Transakcyjny email — triggered przez n8n' },
  { name: 'Telegram MTProto',  cat: 'Comm',       status: 'live',    cost: 'Free',         usedBy: 'Radar (źródło), Content ideas',          notes: 'Telethon, 13 kanałów, Railway host' },
  { name: 'GitHub Actions',    cat: 'CI/CD',      status: 'live',    cost: 'Free',         usedBy: 'Auto-deploy forwarder',                 notes: 'Trigger: push scripts/telegram-forwarder/**' },
  { name: 'React Flow',        cat: 'Library',    status: 'live',    cost: 'Free OSS',     usedBy: 'System Map, Stack Intelligence',         notes: '@xyflow/react — grafy i diagramy' },
  { name: 'Gmail MCP',         cat: 'MCP',        status: 'live',    cost: 'Free',         usedBy: 'PA, Claude Code sessions',              notes: 'Aktywny w każdej sesji' },
  { name: 'Google Calendar MCP', cat: 'MCP',      status: 'live',    cost: 'Free',         usedBy: 'PA, Claude Code sessions',              notes: 'Aktywny w każdej sesji' },
  { name: 'Notion MCP',        cat: 'MCP',        status: 'live',    cost: 'Free',         usedBy: 'PA, Claude Code sessions',              notes: 'Aktywny w każdej sesji' },
  { name: 'Hacker News API',   cat: 'Data',       status: 'live',    cost: 'Free',         usedBy: 'Radar',                                 notes: 'Top 10 stories codziennie' },
  { name: 'CoinGecko API',     cat: 'Data',       status: 'live',    cost: 'Free',         usedBy: 'Radar',                                 notes: 'BTC/ETH/SOL live prices + news' },
  { name: 'Vapi.ai',           cat: 'Voice AI',   status: 'planned', cost: '$0.05/min',    usedBy: 'Voice Agent Demo (Tier 3)',              notes: 'Demo dla klientów na spotkaniach' },
  { name: 'ElevenLabs',        cat: 'Voice AI',   status: 'planned', cost: '$5/mies',      usedBy: 'Voice Agent Demo (Tier 3)',              notes: 'Voice synthesis dla Vapi' },
  { name: 'Fireflies.ai',      cat: 'Transcription', status: 'planned', cost: '$10/mies',  usedBy: 'Meeting transcripts → CRM (Tier 1)',    notes: 'Webhook → /api/webhooks/fireflies (gotowy endpoint)' },
  { name: 'WhatsApp Business', cat: 'Comm',       status: 'planned', cost: '$0.06/conv',   usedBy: 'PA — WhatsApp → CRM (Tier 1)',          notes: 'Gotowy endpoint: /api/webhooks/whatsapp' },
  { name: 'Perplexity MCP',    cat: 'MCP',        status: 'planned', cost: '$5/mies',      usedBy: 'Scout, Radar — live web research',       notes: 'DO DODANIA: claude mcp add perplexity' },
  { name: 'Slack MCP',         cat: 'MCP',        status: 'planned', cost: 'Free',         usedBy: 'PA — full Slack access',                notes: 'DO DODANIA: claude mcp add slack' },
]

// ─── Compact card ─────────────────────────────────────────────────────────────

function Card({ node, selected, onClick }: { node: SNode; selected: boolean; onClick: () => void }) {
  const c = C[node.category]
  const s = STATUS[node.status]
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '6px 10px', borderRadius: 7, cursor: 'pointer', width: '100%', textAlign: 'left',
        border: `1px solid ${selected ? c.border : c.border + '30'}`,
        background: selected ? c.bg.replace('0.07', '0.18').replace('0.09', '0.20') : 'rgba(255,255,255,0.02)',
        transition: 'all 0.12s',
        boxShadow: selected ? `0 0 0 2px ${c.border}33` : 'none',
      }}
    >
      <span style={{ color: s.color, fontSize: 8, flexShrink: 0 }}>{s.dot}</span>
      <span style={{ fontSize: 12, fontWeight: selected ? 700 : 500, color: selected ? t.text.primary : t.text.secondary, lineHeight: 1.2, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {node.label}
      </span>
      {node.model && (
        <span style={{ fontSize: 8, color: '#C9A84C', background: 'rgba(201,168,76,0.15)', padding: '1px 4px', borderRadius: 3, flexShrink: 0 }}>{node.model}</span>
      )}
      {node.tier && (
        <span style={{ fontSize: 8, color: '#A78BFA', background: 'rgba(167,139,250,0.15)', padding: '1px 4px', borderRadius: 3, flexShrink: 0 }}>T{node.tier.replace('Tier ', '')}</span>
      )}
    </button>
  )
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

function DetailPanel({ node, onClose }: { node: SNode; onClose: () => void }) {
  const c = C[node.category]
  const s = STATUS[node.status]
  const connected = node.connects?.map(id => NODES.find(n => n.id === id)).filter(Boolean) as SNode[] | undefined

  return (
    <div style={{
      position: 'sticky', top: 0, width: 260, flexShrink: 0,
      background: '#0E0E13', border: `1px solid ${c.border}33`,
      borderRadius: 12, padding: 18, overflowY: 'auto', maxHeight: '80vh',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', color: c.text, marginBottom: 5 }}>
            {c.icon} {c.label}
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: t.text.primary, lineHeight: 1.2 }}>{node.label}</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: t.text.muted, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0 }}>×</button>
      </div>

      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 14 }}>
        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: `${s.color}18`, border: `1px solid ${s.color}44`, color: s.color, fontWeight: 700 }}>
          {s.dot} {s.label}
        </span>
        {node.model && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: '#C9A84C18', border: '1px solid #C9A84C44', color: '#C9A84C' }}>{node.model}</span>}
        {node.cost && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', color: t.text.muted }}>{node.cost}</span>}
      </div>

      {node.path && (
        <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#818CF8', background: 'rgba(129,140,248,0.08)', padding: '5px 9px', borderRadius: 6, marginBottom: 12, wordBreak: 'break-all' }}>
          {node.path}
        </div>
      )}

      {node.description && (
        <p style={{ fontSize: 12.5, color: t.text.secondary, lineHeight: 1.65, margin: '0 0 14px' }}>{node.description}</p>
      )}

      {node.tier && (
        <div style={{ fontSize: 11, color: '#A78BFA', background: 'rgba(167,139,250,0.08)', padding: '5px 9px', borderRadius: 6, marginBottom: 12 }}>
          {node.tier}
        </div>
      )}

      {connected && connected.length > 0 && (
        <>
          <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: t.text.muted, marginBottom: 8 }}>
            Połączone ({connected.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {connected.map(cn => {
              const cc = C[cn.category]
              return (
                <div key={cn.id} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 8px', borderRadius: 6, background: `${cc.border}08`, border: `1px solid ${cc.border}20` }}>
                  <span style={{ fontSize: 10 }}>{cc.icon}</span>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: t.text.primary }}>{cn.label}</div>
                    {cn.path && <div style={{ fontSize: 9, color: t.text.muted, fontFamily: 'monospace' }}>{cn.path}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {node.path?.startsWith('/dashboard') && (
        <a href={node.path} style={{
          display: 'block', marginTop: 16, textAlign: 'center', padding: '8px',
          border: `1px solid ${c.border}44`, borderRadius: 8,
          color: c.text, fontSize: 12, fontWeight: 700, textDecoration: 'none',
          background: `${c.border}08`,
        }}>Otwórz →</a>
      )}
    </div>
  )
}

// ─── Grid view (default) ──────────────────────────────────────────────────────

function GridView({ search }: { search: string }) {
  const [selected, setSelected] = useState<SNode | null>(null)

  const filtered = (cats: Cat[]) => NODES.filter(n => {
    const matchCat = cats.includes(n.category)
    if (!search) return matchCat
    const q = search.toLowerCase()
    return matchCat && (n.label.toLowerCase().includes(q) || n.description?.toLowerCase().includes(q) || n.path?.toLowerCase().includes(q))
  })

  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
      {/* Grid columns */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, minWidth: 0 }}>
        {SECTIONS.map(sec => {
          const nodes = filtered(sec.cats)
          const live = nodes.filter(n => n.status === 'live').length
          const c = C[sec.cats[0]]
          return (
            <div key={sec.key}>
              {/* Section header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8,
                padding: '6px 10px', borderRadius: 8,
                background: `${c.border}0D`, border: `1px solid ${c.border}25`,
              }}>
                <span style={{ fontSize: 12 }}>{sec.icon}</span>
                <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: c.text, flex: 1 }}>{sec.label}</span>
                <span style={{ fontSize: 9, color: c.text, background: `${c.border}22`, padding: '1px 5px', borderRadius: 8 }}>{live}/{nodes.length}</span>
              </div>
              {/* Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {nodes.length === 0 && (
                  <div style={{ fontSize: 11, color: t.text.muted, padding: '4px 10px', fontStyle: 'italic' }}>brak wyników</div>
                )}
                {nodes.map(node => (
                  <Card
                    key={node.id}
                    node={node}
                    selected={selected?.id === node.id}
                    onClick={() => setSelected(selected?.id === node.id ? null : node)}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Detail panel */}
      {selected && (
        <DetailPanel node={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}

// ─── Tech stack view ──────────────────────────────────────────────────────────

function TechStackView() {
  const [filter, setFilter] = useState<Status | 'all'>('all')
  const cats = [...new Set(TECH.map(t => t.cat))]
  const live = TECH.filter(t => t.status === 'live').length
  const planned = TECH.filter(t => t.status === 'planned').length

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {([['all', `Wszystkie (${live + planned})`], ['live', `✅ Live (${live})`], ['planned', `⏳ Planned (${planned})`]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k as Status | 'all')} style={{
            padding: '6px 14px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer',
            border: `1px solid ${filter === k ? '#818CF8' : t.border.default}`,
            background: filter === k ? 'rgba(129,140,248,0.12)' : 'transparent',
            color: filter === k ? '#818CF8' : t.text.muted,
          }}>{l}</button>
        ))}
      </div>

      {cats.map(cat => {
        const items = TECH.filter(t => t.cat === cat && (filter === 'all' || t.status === filter))
        if (!items.length) return null
        return (
          <div key={cat} style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: t.text.muted, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
              {cat} <div style={{ flex: 1, height: 1, background: t.border.subtle }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 8 }}>
              {items.map(tool => (
                <div key={tool.name} style={{
                  padding: '10px 14px', borderRadius: 10,
                  border: `1px solid ${tool.status === 'live' ? '#22C55E20' : '#EAB30818'}`,
                  background: tool.status === 'live' ? 'rgba(34,197,94,0.03)' : 'rgba(234,179,8,0.03)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: t.text.primary }}>{tool.name}</span>
                    <div style={{ display: 'flex', gap: 5, flexShrink: 0, marginLeft: 8 }}>
                      <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 8, background: tool.status === 'live' ? '#22C55E18' : '#EAB30818', color: tool.status === 'live' ? '#22C55E' : '#EAB308', fontWeight: 700 }}>
                        {tool.status === 'live' ? 'LIVE' : 'PLANNED'}
                      </span>
                      <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', color: t.text.muted }}>{tool.cost}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 10.5, color: t.text.muted, marginBottom: 3 }}>{tool.notes}</div>
                  <div style={{ fontSize: 10, color: '#818CF8' }}>→ {tool.usedBy}</div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Agent export view ────────────────────────────────────────────────────────

function AgentExportView() {
  const [copied, setCopied] = useState(false)

  const exportData = {
    system: '77STF Internal System',
    version: '2.0',
    generated: new Date().toISOString(),
    summary: {
      total_nodes: NODES.length,
      live: NODES.filter(n => n.status === 'live').length,
      planned: NODES.filter(n => n.status === 'planned').length,
      agents: NODES.filter(n => n.category === 'agent').length,
      api_routes: NODES.filter(n => n.category === 'api').length,
      db_tables: NODES.filter(n => n.category === 'database').length,
    },
    agents: NODES.filter(n => n.category === 'agent').map(n => ({
      id: n.id, name: n.label, model: n.model, status: n.status, description: n.description, path: n.path,
    })),
    workflows: NODES.filter(n => n.category === 'workflow').map(n => ({
      id: n.id, name: n.label, status: n.status, schedule: n.path, description: n.description,
    })),
    api_routes: NODES.filter(n => n.category === 'api').map(n => ({
      id: n.id, name: n.label, path: n.path, status: n.status, description: n.description,
    })),
    database_tables: NODES.filter(n => n.category === 'database').map(n => ({
      name: n.label, description: n.description, status: n.status,
    })),
    integrations: NODES.filter(n => ['integration', 'infra'].includes(n.category)).map(n => ({
      name: n.label, status: n.status, description: n.description, cost: n.cost, tier: n.tier,
    })),
    tech_stack: TECH,
    architecture_notes: [
      'Frontend: Next.js 16 App Router, TypeScript strict, Tailwind v4, shadcn/ui (Radix)',
      'Backend: Supabase PostgreSQL + RLS. Admin client only in /api/ routes.',
      'Auth: Google OAuth + Magic Link. Middleware protects /dashboard/** and /portal/**',
      'AI: All calls via callClaude() from lib/claude.ts. Rate limited on AI endpoints.',
      'Security: RLS on all tables, Zod validation, CSP headers, webhook signature verify',
      'Design: Carbon Pro system. Tokens via t from lib/tokens. No framer-motion (removed).',
      'Language: UI in Polish, code/vars/comments in English.',
      'n8n: 5 active workflows. Sync via: node --env-file=.env.local n8n-workflows/sync.mjs',
    ],
  }

  const json = JSON.stringify(exportData, null, 2)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: t.text.primary, marginBottom: 3 }}>Export dla agenta AI</div>
          <div style={{ fontSize: 12, color: t.text.muted }}>Pełny JSON stanu systemu — możesz wkleić do promptu agenta lub użyć /api/system/snapshot</div>
        </div>
        <button
          onClick={() => { navigator.clipboard.writeText(json); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
          style={{
            marginLeft: 'auto', padding: '8px 18px', borderRadius: 8, border: '1px solid #818CF8',
            background: copied ? 'rgba(34,197,94,0.15)' : 'rgba(129,140,248,0.12)', color: copied ? '#22C55E' : '#818CF8',
            fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
          }}
        >{copied ? '✅ Skopiowano!' : '📋 Kopiuj JSON'}</button>
      </div>

      {/* Quick reference cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { title: 'Snapshot API', desc: 'GET /api/system/snapshot z nagłówkiem x-webhook-secret', code: 'curl -H "x-webhook-secret: $N8N_WEBHOOK_SECRET" /api/system/snapshot' },
          { title: 'Guardian Run', desc: 'POST z nagłówkiem x-webhook-secret', code: 'curl -X POST -H "x-webhook-secret: ..." /api/guardian/run' },
          { title: 'Operator Chat', desc: 'POST z message — tool use loop max 5 iteracji', code: 'POST /api/operator/chat\n{"message": "dodaj klienta X"}' },
          { title: 'n8n Sync', desc: 'Synchronizuj workflows z plikami JSON', code: 'node --env-file=.env.local n8n-workflows/sync.mjs' },
        ].map(card => (
          <div key={card.title} style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(129,140,248,0.2)', background: 'rgba(129,140,248,0.04)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#818CF8', marginBottom: 4 }}>{card.title}</div>
            <div style={{ fontSize: 11, color: t.text.muted, marginBottom: 8 }}>{card.desc}</div>
            <div style={{ fontFamily: 'monospace', fontSize: 10, color: t.text.secondary, background: 'rgba(0,0,0,0.3)', padding: '6px 8px', borderRadius: 6, whiteSpace: 'pre-wrap' }}>{card.code}</div>
          </div>
        ))}
      </div>

      <pre style={{
        background: '#050508', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10,
        padding: 16, fontSize: 10, color: '#6B7280', lineHeight: 1.6,
        maxHeight: 400, overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
      }}>{json}</pre>
    </div>
  )
}

// ─── Diagram view (React Flow) ────────────────────────────────────────────────

const RF_COL = { ext: 0, agent: 240, wf: 480, api: 720, page: 970, db: 1220 }
const RF_R = 82

function DiagramNode({ data }: { data: Record<string, unknown> }) {
  const d = data as unknown as SNode
  const c = C[d.category]
  return (
    <div style={{ background: c.bg, border: `1.5px solid ${c.border}88`, borderRadius: 8, padding: '7px 12px', minWidth: 140, maxWidth: 190, cursor: 'pointer' }}>
      <div style={{ fontSize: 8, fontWeight: 800, textTransform: 'uppercase', color: c.text, marginBottom: 3 }}>{c.label}</div>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: 'rgba(242,242,244,0.9)', lineHeight: 1.2 }}>{d.label}</div>
      {d.path && <div style={{ fontSize: 9, color: '#818CF8', fontFamily: 'monospace', marginTop: 2 }}>{d.path}</div>}
    </div>
  )
}

const rfNodeTypes = { sn: DiagramNode }

function DiagramView() {
  const rfNodes: Node[] = NODES.map((n, i) => {
    const colMap: Record<Cat | 'infra', number> = { integration: RF_COL.ext, infra: RF_COL.ext, agent: RF_COL.agent, workflow: RF_COL.wf, api: RF_COL.api, page: RF_COL.page, database: RF_COL.db }
    const colNodes = NODES.filter(x => colMap[x.category] === colMap[n.category])
    const rowIdx = colNodes.findIndex(x => x.id === n.id)
    return {
      id: n.id, type: 'sn',
      data: n as unknown as Record<string, unknown>,
      position: { x: colMap[n.category], y: 40 + rowIdx * RF_R },
    }
  })

  const rfEdges: Edge[] = NODES.flatMap(n =>
    (n.connects || []).map(tid => ({
      id: `${n.id}-${tid}`,
      source: n.id, target: tid,
      style: { stroke: C[n.category].border + '44', strokeWidth: 1 },
      markerEnd: { type: MarkerType.ArrowClosed, color: C[n.category].border + '44', width: 10, height: 10 },
    }))
  )

  return (
    <div style={{ width: '100%', height: 700, borderRadius: 12, overflow: 'hidden', background: '#07070B', border: '1px solid rgba(255,255,255,0.06)' }}>
      <ReactFlow nodes={rfNodes} edges={rfEdges} nodeTypes={rfNodeTypes}
        fitView fitViewOptions={{ padding: 0.08 }}
        connectionLineType={ConnectionLineType.SmoothStep}
        style={{ background: 'transparent' }} proOptions={{ hideAttribution: true }}
      >
        <Background color="rgba(255,255,255,0.015)" variant={BackgroundVariant.Dots} gap={26} size={1} />
        <Controls style={{ background: 'rgba(20,20,26,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
        <MiniMap style={{ background: 'rgba(20,20,26,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
          nodeColor={n => C[(n.data as unknown as SNode)?.category ?? 'page']?.border ?? '#888'} />
      </ReactFlow>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function SystemMap() {
  const [tab, setTab] = useState<'grid' | 'diagram' | 'stack' | 'agent'>('grid')
  const [search, setSearch] = useState('')

  const live = NODES.filter(n => n.status === 'live').length
  const planned = NODES.filter(n => n.status === 'planned').length
  const agents = NODES.filter(n => n.category === 'agent' && n.status === 'live').length
  const workflows = NODES.filter(n => n.category === 'workflow' && n.status === 'live').length

  const TABS = [
    { key: 'grid',    label: '⊞ Mapa',       desc: 'Wszystkie moduły w siatce' },
    { key: 'diagram', label: '↔ Diagram',    desc: 'Połączenia (React Flow)' },
    { key: 'stack',   label: '📦 Tech Stack', desc: 'Narzędzia i biblioteki' },
    { key: 'agent',   label: '🤖 Agent API',  desc: 'Export JSON dla agentów' },
  ] as const

  return (
    <div>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, auto) 1fr', gap: 0, marginBottom: 20, background: '#0E0E13', borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
        {[
          { value: live,      label: 'Live',        color: '#22C55E' },
          { value: planned,   label: 'Planned',     color: '#EAB308' },
          { value: agents,    label: 'AI Agents',   color: '#C9A84C' },
          { value: workflows, label: 'n8n Workflows', color: '#A78BFA' },
          { value: TECH.filter(x => x.status === 'live').length, label: 'Tech Tools', color: '#34D399' },
        ].map((s, i) => (
          <div key={s.label} style={{ padding: '14px 20px', borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 26, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</span>
            <span style={{ fontSize: 10, color: t.text.muted, fontWeight: 600 }}>{s.label}</span>
          </div>
        ))}
        {/* Legend */}
        <div style={{ padding: '14px 20px', display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          {(Object.entries(C) as [Cat, typeof C[Cat]][]).map(([key, c]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 7, height: 7, borderRadius: 2, background: c.border }} />
              <span style={{ fontSize: 10, color: t.text.muted }}>{c.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs + Search */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', background: '#0E0E13', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 3, gap: 2 }}>
          {TABS.map(tb => (
            <button key={tb.key} onClick={() => setTab(tb.key)} style={{
              padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: tab === tb.key ? 'rgba(129,140,248,0.2)' : 'transparent',
              color: tab === tb.key ? '#818CF8' : t.text.muted,
              fontSize: 12, fontWeight: 600, transition: 'all 0.12s',
            }}>{tb.label}</button>
          ))}
        </div>
        {tab === 'grid' && (
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Szukaj modułu, ścieżki, opisu..."
            style={{ flex: 1, padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(255,255,255,0.03)', color: t.text.primary, fontSize: 12, outline: 'none' }}
          />
        )}
        <div style={{ fontSize: 11, color: t.text.muted, flexShrink: 0 }}>
          {TABS.find(tb => tb.key === tab)?.desc}
        </div>
      </div>

      {tab === 'grid'    && <GridView search={search} />}
      {tab === 'diagram' && <DiagramView />}
      {tab === 'stack'   && <TechStackView />}
      {tab === 'agent'   && <AgentExportView />}
    </div>
  )
}
