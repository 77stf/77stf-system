import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase'
import { t } from '@/lib/tokens'
import { formatPLN, relativeTime } from '@/lib/format'
import { StatsBar } from './components/stats-bar'
import { RevenueChart } from './components/revenue-chart'
import { PipelineSummary } from './components/pipeline-summary'
import { ClientsTable } from './components/clients-table'
import type { Client } from '@/lib/types'

function getGreeting(hour: number): string {
  if (hour < 5)  return 'Dobranoc'
  if (hour < 12) return 'Dzień dobry'
  if (hour < 18) return 'Cześć'
  return 'Dobry wieczór'
}

// Build 6-month revenue chart from accepted quotes
function buildRevenueChart(quotes: { setup_fee: number; monthly_fee: number; accepted_at: string | null; created_at: string }[]) {
  const monthMap: Record<string, { paid: number; pending: number }> = {}
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const key = d.toLocaleDateString('pl-PL', { month: 'short', year: '2-digit' })
    monthMap[key] = { paid: 0, pending: 0 }
  }
  quotes.forEach(q => {
    const d = new Date(q.accepted_at ?? q.created_at)
    const key = d.toLocaleDateString('pl-PL', { month: 'short', year: '2-digit' })
    if (!monthMap[key]) return
    monthMap[key].paid += q.setup_fee + q.monthly_fee
  })
  return Object.entries(monthMap).map(([month, vals]) => ({ month, ...vals }))
}

async function fetchDashboardData() {
  const supabase = createSupabaseAdminClient()
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const todayStr = now.toISOString().split('T')[0]
  const sixMonthsAgo = new Date(now); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  const [
    { data: allClients },
    { data: openTasks },
    { data: sentQuotes },
    { data: acceptedQuotes },
    { data: aiUsage },
    { data: recentNotes },
    { data: lastGuardian },
  ] = await Promise.all([
    supabase.from('clients').select('id, name, status, industry, owner_name, created_at').order('created_at', { ascending: false }),
    supabase.from('tasks').select('id, title, status, priority, due_date, client_id, clients(name)').neq('status', 'done').order('due_date', { ascending: true, nullsFirst: false }).limit(50),
    supabase.from('quotes').select('id, title, client_id, setup_fee, monthly_fee, updated_at, clients(name)').eq('status', 'sent').order('updated_at'),
    supabase.from('quotes').select('setup_fee, monthly_fee, accepted_at, created_at').eq('status', 'accepted').gte('created_at', sixMonthsAgo.toISOString()),
    supabase.from('ai_usage_log').select('cost_usd').gte('created_at', startOfMonth.toISOString()),
    supabase.from('client_notes').select('content, created_at, clients(name)').order('created_at', { ascending: false }).limit(5),
    supabase.from('guardian_reports').select('generated_at, alert_count, critical, summary').order('generated_at', { ascending: false }).limit(1),
  ])

  // Pipeline stats from clients
  const clientList = allClients ?? []
  const pipelineStats = {
    leads:    clientList.filter(c => c.status === 'lead').length,
    active:   clientList.filter(c => c.status === 'active').length,
    partners: clientList.filter(c => c.status === 'partner').length,
  }

  // Revenue: sum of accepted quotes (setup + monthly treated as monthly value)
  const allAccepted = acceptedQuotes ?? []
  const mrr = allAccepted.reduce((s, q) => s + (q.monthly_fee ?? 0), 0)
  const totalSetup = allAccepted.reduce((s, q) => s + (q.setup_fee ?? 0), 0)

  // AI cost this month
  const aiCostMonth = (aiUsage ?? []).reduce((s, r) => s + (r.cost_usd ?? 0), 0)
  const aiBudget = parseFloat(process.env.AI_MONTHLY_BUDGET_USD ?? '50')
  const aiPct = aiBudget > 0 ? Math.round((aiCostMonth / aiBudget) * 100) : 0

  // Tasks breakdown
  const tasks = openTasks ?? []
  const overdueTasks = tasks.filter(t => t.due_date && new Date(t.due_date) < now)
  const todayTasks = tasks.filter(t => t.due_date?.startsWith(todayStr))
  const highPriorityTasks = tasks.filter(t => t.priority === 'high').slice(0, 5)

  // Quotes pending response
  const pending = (sentQuotes ?? []).map(q => ({
    ...q,
    daysSince: Math.floor((now.getTime() - new Date(q.updated_at).getTime()) / 86400000),
    clientName: (q.clients as { name?: string } | null)?.name ?? '—',
  })).sort((a, b) => b.daysSince - a.daysSince)

  // Guardian
  const guardian = lastGuardian?.[0] ?? null

  // Integration status (env var presence)
  const integrations = {
    slack: !!(process.env.SLACK_SIGNING_SECRET && process.env.SLACK_WEBHOOK_URL),
    n8n: !!process.env.N8N_WEBHOOK_SECRET,
    fireflies: !!(process.env.FIREFLIES_API_KEY),
    whatsapp: !!(process.env.WHATSAPP_TOKEN),
  }

  return {
    clients: clientList as Client[],
    pipelineStats,
    mrr, totalSetup,
    openTasksCount: tasks.length,
    overdueCount: overdueTasks.length,
    todayTasks,
    highPriorityTasks,
    pendingQuotes: pending,
    aiCostMonth, aiPct, aiBudget,
    recentNotes: recentNotes ?? [],
    guardian,
    revenueChart: buildRevenueChart(allAccepted),
    integrations,
  }
}

// ─── Integration dot ──────────────────────────────────────────────────────────

function IntegrationBadge({ label, connected, planned }: { label: string; connected: boolean; planned?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 7,
      padding: '6px 12px',
      borderRadius: t.radius.full,
      background: t.bg.card,
      border: `1px solid ${connected ? t.border.success : t.border.subtle}`,
      fontSize: 12, fontWeight: 500,
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
        background: planned ? t.text.muted : connected ? t.semantic.success : t.semantic.error,
        opacity: planned ? 0.5 : 1,
      }} />
      <span style={{ color: planned ? t.text.muted : connected ? t.text.secondary : t.text.secondary }}>
        {label}
      </span>
      {planned && (
        <span style={{ fontSize: 9, fontWeight: 700, color: t.text.muted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          planowane
        </span>
      )}
    </div>
  )
}

// ─── Quick task row ───────────────────────────────────────────────────────────

function TaskRow({ task }: { task: { id: string; title: string; priority: string; due_date?: string | null; clients?: { name?: string } | null } }) {
  const isOverdue = task.due_date && new Date(task.due_date) < new Date()
  const clientName = (task.clients as { name?: string } | null)?.name
  return (
    <a href={`/dashboard/tasks`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', textDecoration: 'none', borderBottom: `1px solid ${t.border.subtle}` }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
        background: task.priority === 'high' ? t.semantic.error : task.priority === 'medium' ? t.semantic.warning : t.text.muted,
      }} />
      <span style={{ flex: 1, fontSize: 13, color: t.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {task.title}
      </span>
      {clientName && <span style={{ fontSize: 11, color: t.text.muted, flexShrink: 0 }}>{clientName}</span>}
      {task.due_date && (
        <span style={{ fontSize: 11, color: isOverdue ? t.semantic.error : t.text.muted, flexShrink: 0, fontWeight: isOverdue ? 600 : 400 }}>
          {isOverdue ? '⚠ ' : ''}{new Date(task.due_date).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}
        </span>
      )}
    </a>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  const adminName = user?.user_metadata?.full_name ?? user?.email?.split('@')[0] ?? 'Właściciel'

  const {
    clients, pipelineStats,
    mrr, totalSetup,
    openTasksCount, overdueCount, todayTasks, highPriorityTasks,
    pendingQuotes, aiCostMonth, aiPct, aiBudget,
    recentNotes, guardian, revenueChart, integrations,
  } = await fetchDashboardData()

  const hour = new Date().getHours()
  const dateStr = new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })

  const displayTasks = todayTasks.length > 0 ? todayTasks : highPriorityTasks

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* ── Greeting ── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 36, fontWeight: 300, letterSpacing: '-0.04em', lineHeight: 1.05, color: t.text.primary }}>
            {getGreeting(hour)},{' '}
            <span style={{ fontWeight: 700, background: t.brand.gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              {adminName}
            </span>
          </h1>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: t.text.muted, letterSpacing: '-0.01em' }}>
            {dateStr}
          </p>
        </div>

        {/* Integrations status */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <IntegrationBadge label="Slack" connected={integrations.slack} />
          <IntegrationBadge label="n8n" connected={integrations.n8n} planned={!integrations.n8n} />
          <IntegrationBadge label="Fireflies" connected={integrations.fireflies} planned={!integrations.fireflies} />
          <IntegrationBadge label="WhatsApp" connected={integrations.whatsapp} planned={!integrations.whatsapp} />
        </div>
      </div>

      {/* ── KPI bar ── */}
      <StatsBar
        mrr={mrr}
        totalSetup={totalSetup}
        activeClients={pipelineStats.active + pipelineStats.partners}
        openTasks={openTasksCount}
        overdueCount={overdueCount}
        aiCostMonth={aiCostMonth}
        aiPct={aiPct}
      />

      {/* ── Main grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>
        <RevenueChart data={revenueChart} />
        <PipelineSummary
          leads={pipelineStats.leads}
          active={pipelineStats.active}
          partners={pipelineStats.partners}
          mrr={mrr}
        />
      </div>

      {/* ── Second row: Tasks + Pending quotes + Guardian ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>

        {/* Today's tasks */}
        <div style={{ background: t.bg.card, border: `1px solid ${t.border.default}`, borderRadius: t.radius.md, padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', color: t.text.muted }}>
              {todayTasks.length > 0 ? 'Na dziś' : 'Wysokie priorytety'}
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: t.radius.full, fontWeight: 600, color: t.text.secondary, background: t.bg.muted, border: `1px solid ${t.border.subtle}` }}>
                {openTasksCount} otwartych
              </span>
              {overdueCount > 0 && (
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: t.radius.full, fontWeight: 700, color: t.semantic.error, background: t.semantic.errorBg, border: `1px solid ${t.semantic.errorBorder}` }}>
                  {overdueCount} po terminie
                </span>
              )}
            </div>
          </div>
          {displayTasks.length === 0 ? (
            <div style={{ color: t.text.muted, fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
              Nic pilnego — dobra robota
            </div>
          ) : (
            <div>
              {displayTasks.slice(0, 5).map(task => (
                <TaskRow key={task.id} task={task as Parameters<typeof TaskRow>[0]['task']} />
              ))}
              <a href="/dashboard/tasks" style={{ display: 'block', marginTop: 10, fontSize: 12, color: t.semantic.info, textDecoration: 'none', textAlign: 'center' }}>
                Zobacz wszystkie →
              </a>
            </div>
          )}
        </div>

        {/* Pending quotes */}
        <div style={{ background: t.bg.card, border: `1px solid ${pendingQuotes.length > 0 ? t.border.gold : t.border.default}`, borderRadius: t.radius.md, padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', color: t.text.muted }}>
              Wyceny bez odpowiedzi
            </span>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: t.radius.full, fontWeight: 700, color: pendingQuotes.length > 0 ? t.brand.gold : t.text.muted, background: pendingQuotes.length > 0 ? 'rgba(196,154,46,0.10)' : t.bg.muted, border: `1px solid ${pendingQuotes.length > 0 ? t.border.gold : t.border.subtle}` }}>
              {pendingQuotes.length}
            </span>
          </div>
          {pendingQuotes.length === 0 ? (
            <div style={{ color: t.text.muted, fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
              Wszystkie wyceny mają odpowiedź
            </div>
          ) : (
            <div>
              {pendingQuotes.slice(0, 4).map(q => (
                <div key={q.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${t.border.subtle}` }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: t.text.primary, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.clientName}</div>
                    <div style={{ fontSize: 11, color: t.text.muted }}>{q.title}</div>
                  </div>
                  <span style={{ fontSize: 11, color: q.daysSince >= 14 ? t.semantic.error : t.semantic.warning, fontWeight: 700, flexShrink: 0, marginLeft: 8 }}>
                    {q.daysSince}d
                  </span>
                </div>
              ))}
              <a href="/dashboard/quotes" style={{ display: 'block', marginTop: 10, fontSize: 12, color: t.semantic.info, textDecoration: 'none', textAlign: 'center' }}>
                Otwórz wyceny →
              </a>
            </div>
          )}
        </div>

        {/* Guardian + AI costs */}
        <div style={{ background: t.bg.card, border: `1px solid ${t.border.default}`, borderRadius: t.radius.md, padding: '18px 20px' }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', color: t.text.muted }}>
                Guardian
              </span>
              <a href="/dashboard/guardian" style={{ fontSize: 11, color: t.semantic.info, textDecoration: 'none' }}>Skanuj →</a>
            </div>
            {guardian ? (
              <div style={{
                padding: '10px 12px',
                borderRadius: t.radius.sm,
                background: guardian.critical > 0 ? t.semantic.errorBg : t.semantic.successBg,
                border: `1px solid ${guardian.critical > 0 ? t.semantic.errorBorder : t.semantic.successBorder}`,
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: guardian.critical > 0 ? t.semantic.error : t.semantic.success, marginBottom: 3 }}>
                  {guardian.critical > 0 ? `${guardian.critical} pilnych alertów` : `${guardian.alert_count} alertów`}
                </div>
                <div style={{ fontSize: 11, color: t.text.muted }}>
                  {relativeTime(guardian.generated_at)}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: t.text.muted, padding: '8px 0' }}>
                Nie skanowano jeszcze — <a href="/dashboard/guardian" style={{ color: t.semantic.info, textDecoration: 'none' }}>uruchom teraz</a>
              </div>
            )}
          </div>

          <div style={{ borderTop: `1px solid ${t.border.subtle}`, paddingTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', color: t.text.muted }}>
                Koszty AI (mies.)
              </span>
              <a href="/dashboard/ai-costs" style={{ fontSize: 11, color: t.semantic.info, textDecoration: 'none' }}>Szczegóły →</a>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: aiPct >= 80 ? t.semantic.error : t.text.primary }}>
                ${aiCostMonth.toFixed(2)}
              </span>
              <span style={{ fontSize: 12, color: t.text.muted }}>/ ${aiBudget}</span>
            </div>
            <div style={{ height: 4, background: t.bg.muted, borderRadius: t.radius.full, overflow: 'hidden', border: `1px solid ${t.border.subtle}` }}>
              <div style={{ height: '100%', borderRadius: t.radius.full, background: aiPct >= 80 ? t.semantic.error : aiPct >= 50 ? t.semantic.warning : t.semantic.success, width: `${Math.min(aiPct, 100)}%` }} />
            </div>
            <div style={{ fontSize: 11, color: t.text.muted, marginTop: 4 }}>{aiPct}% budżetu</div>
          </div>
        </div>
      </div>

      {/* ── Clients table ── */}
      <ClientsTable clients={clients} />

      {/* ── Recent notes ── */}
      {recentNotes.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', color: t.text.muted, marginBottom: 12 }}>
            Ostatnia aktywność
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recentNotes.map((note, i) => {
              const clientName = (note.clients as { name?: string } | null)?.name
              return (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 14px', background: t.bg.card, border: `1px solid ${t.border.subtle}`, borderRadius: t.radius.sm, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 12, color: t.text.muted, flexShrink: 0, marginTop: 1 }}>{relativeTime(note.created_at)}</span>
                  {clientName && <span style={{ fontSize: 12, fontWeight: 600, color: t.text.secondary, flexShrink: 0 }}>{clientName}</span>}
                  <span style={{ fontSize: 12, color: t.text.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {note.content}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <style>{`
        @keyframes cardEnter { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:none } }
        @keyframes progressExpand { from { width:0 } }
        @keyframes fadeSlide { from { opacity:0; transform:translateX(-6px) } to { opacity:1; transform:none } }
      `}</style>
    </div>
  )
}
