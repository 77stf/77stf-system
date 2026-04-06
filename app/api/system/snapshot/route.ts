import { NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase'

// GET /api/system/snapshot
// Returns a full JSON snapshot of the system state for AI agents (Operator, Guardian, etc.)
// This is the "brain" context that lets agents reason about the actual state of 77STF.

export async function GET() {
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })

  const supabase = createSupabaseAdminClient()
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [
    { data: clients },
    { data: openTasks },
    { data: sentQuotes },
    { data: recentErrors },
    { data: aiUsage },
    { data: recentNotes },
    { data: stackErrors },
    { data: lastGuardian },
    { data: lastDigest },
  ] = await Promise.all([
    supabase.from('clients').select('id, name, status, industry, owner_name, owner_phone, updated_at').order('name'),
    supabase.from('tasks').select('id, title, priority, status, due_date, client_id, clients(name)').neq('status', 'done').order('due_date', { ascending: true, nullsFirst: false }).limit(30),
    supabase.from('quotes').select('id, title, client_id, status, updated_at, clients(name)').eq('status', 'sent').order('updated_at'),
    supabase.from('error_log').select('source, message, created_at').order('created_at', { ascending: false }).limit(10),
    supabase.from('ai_usage_log').select('feature, cost_usd, created_at').gte('created_at', startOfMonth.toISOString()),
    supabase.from('client_notes').select('client_id, content, created_at, clients(name)').order('created_at', { ascending: false }).limit(15),
    supabase.from('stack_items').select('id, name, status, client_id, updated_at, clients(name)').eq('status', 'error'),
    supabase.from('guardian_reports').select('generated_at, alert_count, critical, summary').order('generated_at', { ascending: false }).limit(1),
    supabase.from('intelligence_digests').select('generated_at, source_count').order('generated_at', { ascending: false }).limit(1),
  ])

  // Compute derived stats
  const clientStats = {
    total: clients?.length ?? 0,
    active: clients?.filter(c => c.status === 'active').length ?? 0,
    leads: clients?.filter(c => c.status === 'lead').length ?? 0,
    partners: clients?.filter(c => c.status === 'partner').length ?? 0,
    closed: clients?.filter(c => c.status === 'closed').length ?? 0,
  }

  const taskStats = {
    total_open: openTasks?.length ?? 0,
    high_priority: openTasks?.filter(t => t.priority === 'high').length ?? 0,
    overdue: openTasks?.filter(t => t.due_date && new Date(t.due_date) < now).length ?? 0,
  }

  const aiCostMonth = (aiUsage ?? []).reduce((s, r) => s + (r.cost_usd ?? 0), 0)
  const budgetUsd = parseFloat(process.env.AI_MONTHLY_BUDGET_USD ?? '50')

  // Inactive clients (active/partner without note in 30 days)
  const inactiveClients = (clients ?? [])
    .filter(c => c.status === 'active' || c.status === 'partner')
    .filter(c => {
      const lastUpdate = new Date(c.updated_at)
      return lastUpdate < thirtyDaysAgo
    })
    .map(c => c.name)

  return NextResponse.json({
    generated_at: now.toISOString(),

    // Business context
    company: {
      name: '77STF',
      role: 'Zewnętrzny dział tech dla polskich MŚP',
      services: ['Automatyzacje AI', 'Voice Agent', 'Chatbot RAG', 'Social Media Automation', 'Audyty cyfrowe'],
      stack: ['Next.js 16', 'Supabase', 'Claude API', 'n8n', 'Vapi.ai', 'ElevenLabs', 'Vercel'],
    },

    // CRM state
    clients: {
      stats: clientStats,
      list: (clients ?? []).map(c => ({
        id: c.id,
        name: c.name,
        status: c.status,
        industry: c.industry,
        owner: c.owner_name,
        phone: c.owner_phone,
        last_updated: c.updated_at,
      })),
      inactive_30d: inactiveClients,
    },

    // Tasks
    tasks: {
      stats: taskStats,
      urgent: (openTasks ?? [])
        .filter(t => t.priority === 'high' || (t.due_date && new Date(t.due_date) < now))
        .slice(0, 10)
        .map(t => ({
          title: t.title,
          priority: t.priority,
          due_date: t.due_date,
          client: (t.clients as { name?: string } | null)?.name,
          overdue: t.due_date ? new Date(t.due_date) < now : false,
        })),
    },

    // Quotes needing follow-up
    quotes_awaiting: (sentQuotes ?? []).map(q => {
      const daysSince = Math.floor((now.getTime() - new Date(q.updated_at).getTime()) / 86400000)
      return {
        title: q.title,
        client: (q.clients as { name?: string } | null)?.name,
        days_since_sent: daysSince,
        urgent: daysSince >= 7,
      }
    }),

    // AI costs
    ai_costs: {
      this_month_usd: parseFloat(aiCostMonth.toFixed(4)),
      budget_usd: budgetUsd,
      budget_used_pct: budgetUsd > 0 ? Math.round((aiCostMonth / budgetUsd) * 100) : 0,
      top_features: Object.entries(
        (aiUsage ?? []).reduce((acc: Record<string, number>, r) => {
          acc[r.feature] = (acc[r.feature] ?? 0) + (r.cost_usd ?? 0)
          return acc
        }, {})
      ).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([feature, cost]) => ({ feature, cost_usd: parseFloat(cost.toFixed(4)) })),
    },

    // System health
    system_health: {
      recent_errors: (recentErrors ?? []).map(e => ({ source: e.source, message: e.message.slice(0, 100), at: e.created_at })),
      stack_errors: (stackErrors ?? []).map(e => ({ name: e.name, client: (e.clients as { name?: string } | null)?.name, since: e.updated_at })),
      last_guardian_run: lastGuardian?.[0] ?? null,
      last_radar_digest: lastDigest?.[0] ?? null,
    },

    // Recent activity
    recent_notes: (recentNotes ?? []).map(n => ({
      client: (n.clients as { name?: string } | null)?.name,
      content: n.content.slice(0, 100),
      at: n.created_at,
    })),

    // Roadmap & pending actions
    pending_actions: {
      migrations_to_run: ['005', '006', '007', '009', '010', '011', '012 (CRITICAL - RLS)'],
      client_portal: 'NOT BUILT — /portal returns 404',
      google_oauth: 'Code ready, needs Google Cloud + Supabase configuration',
      slack: 'Needs SLACK_SIGNING_SECRET + SLACK_WEBHOOK_URL in env',
      n8n: 'Not purchased yet — World Radar and Guardian auto-run waiting',
    },

    // Key pages
    dashboard_pages: [
      '/dashboard — KPI + pipeline',
      '/dashboard/clients — CRM',
      '/dashboard/intelligence — AI Hub (Scout + Radar + Stack Map)',
      '/dashboard/guardian — System monitoring',
      '/dashboard/operator — AI chat operator',
      '/dashboard/content — Social media posts',
      '/dashboard/system-map — Architecture visualization',
      '/dashboard/ai-costs — Cost tracking',
      '/dashboard/errors — Error logs',
      '/dashboard/settings — Config status',
    ],
  })
}
