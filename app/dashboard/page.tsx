import { createSupabaseServerClient } from '@/lib/supabase'
import { Client, Automation } from '@/lib/types'
import { StatsBar } from './components/stats-bar'
import { ClientsTable } from './components/clients-table'
import { RedFlags } from './components/red-flags'
import { RevenueChart } from './components/revenue-chart'
import { PipelineSummary } from './components/pipeline-summary'
import { t } from '@/lib/tokens'

// ─── Will come from auth session in Etap 4 ───────────────────────────────────
const ADMIN_NAME = 'Michał'

function getGreeting(hour: number): string {
  if (hour < 5)  return 'Dobranoc'
  if (hour < 18) return 'Dzień dobry'
  return 'Dobry wieczór'
}

function aggregateByMonth(
  projects: { value_netto?: number; created_at: string; payment_status: string }[]
) {
  const monthMap: Record<string, { paid: number; pending: number }> = {}
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const key = d.toLocaleDateString('pl-PL', { month: 'short', year: '2-digit' })
    monthMap[key] = { paid: 0, pending: 0 }
  }
  projects?.forEach((p) => {
    const d = new Date(p.created_at)
    const key = d.toLocaleDateString('pl-PL', { month: 'short', year: '2-digit' })
    if (!monthMap[key]) return
    const val = p.value_netto ?? 0
    if (p.payment_status === 'paid') monthMap[key].paid += val
    else monthMap[key].pending += val
  })
  return Object.entries(monthMap).map(([month, vals]) => ({ month, ...vals }))
}

async function fetchDashboardData() {
  const supabase = await createSupabaseServerClient()
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  const [
    { data: paidProjects },
    { count: activeClientsCount },
    { count: activeLeadsCount },
    { data: errorAutomations },
    { data: clients },
    { data: chartProjects },
    { data: allClients },
    { data: allProjects },
  ] = await Promise.all([
    supabase.from('projects').select('value_netto').eq('payment_status', 'paid'),
    supabase.from('clients').select('id', { count: 'exact', head: true }).in('status', ['active', 'partner']),
    supabase.from('leads').select('id', { count: 'exact', head: true }).not('status', 'in', '("won","lost")'),
    supabase.from('automations').select('*, clients(id, name)').eq('status', 'error'),
    supabase.from('clients').select('*').order('created_at', { ascending: false }),
    supabase.from('projects').select('value_netto, created_at, payment_status')
      .gte('created_at', sixMonthsAgo.toISOString()).order('created_at', { ascending: true }),
    supabase.from('clients').select('status, id'),
    supabase.from('projects').select('client_id, value_netto, payment_status'),
  ])

  const revenue = (paidProjects ?? []).reduce((sum, p) => sum + (p.value_netto ?? 0), 0)

  const errors: (Automation & { client?: Client })[] = (errorAutomations ?? []).map((a) => {
    const { clients: clientJoin, ...rest } = a as Automation & { clients?: Client }
    return { ...rest, client: clientJoin ?? undefined }
  })

  const clientStatusMap = (allClients ?? []).reduce<Record<string, string>>((acc, c) => {
    acc[c.id] = c.status; return acc
  }, {})

  const ps = { leads: 0, active: 0, partners: 0, totalLeadValue: 0, totalActiveValue: 0, totalPartnerValue: 0 }
  ;(allClients ?? []).forEach((c) => {
    if (c.status === 'lead') ps.leads++
    else if (c.status === 'active') ps.active++
    else if (c.status === 'partner') ps.partners++
  })
  ;(allProjects ?? []).forEach((p) => {
    const s = clientStatusMap[p.client_id], v = p.value_netto ?? 0
    if (s === 'lead') ps.totalLeadValue += v
    else if (s === 'active') ps.totalActiveValue += v
    else if (s === 'partner') ps.totalPartnerValue += v
  })

  return {
    revenue, activeClients: activeClientsCount ?? 0,
    activeLeads: activeLeadsCount ?? 0, alertCount: errors.length,
    errors, clients: (clients ?? []) as Client[],
    revenueData: aggregateByMonth(chartProjects ?? []),
    pipelineStats: ps,
  }
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const {
    revenue, activeClients, activeLeads, alertCount,
    errors, clients, revenueData, pipelineStats,
  } = await fetchDashboardData()

  const hour = new Date().getHours()
  const greeting = getGreeting(hour)
  const dateStr = new Date().toLocaleDateString('pl-PL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

      {/* ── Greeting ── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', paddingBottom: 8 }}>
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 40,
              fontWeight: 300,
              letterSpacing: '-0.045em',
              lineHeight: 1.05,
              color: t.text.primary,
            }}
          >
            {greeting},{' '}
            <span
              style={{
                fontWeight: 600,
                background: t.brand.gradient,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              {ADMIN_NAME}
            </span>
          </h1>
          <p
            style={{
              margin: '10px 0 0',
              fontSize: 13,
              color: t.text.muted,
              letterSpacing: '-0.01em',
            }}
          >
            {dateStr}
          </p>
        </div>

        {/* Alert indicator */}
        {alertCount > 0 && (
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 14px',
              borderRadius: t.radius.md,
              backgroundColor: t.semantic.errorBg,
              border: `1px solid ${t.semantic.errorBorder}`,
            }}
          >
            <span
              style={{
                width: 6, height: 6, borderRadius: '50%',
                backgroundColor: t.semantic.error,
                display: 'inline-block',
              }}
            />
            <span style={{ fontSize: 12, color: t.semantic.error, fontWeight: 500, letterSpacing: '-0.01em' }}>
              {alertCount} {alertCount === 1 ? 'błąd wymaga uwagi' : 'błędy wymagają uwagi'}
            </span>
          </div>
        )}
      </div>

      {/* ── KPI ── */}
      <StatsBar
        revenue={revenue}
        activeClients={activeClients}
        activeLeads={activeLeads}
        alertCount={alertCount}
      />

      {/* ── Charts ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
        <RevenueChart data={revenueData} />
        <PipelineSummary
          leads={pipelineStats.leads}
          active={pipelineStats.active}
          partners={pipelineStats.partners}
          totalLeadValue={pipelineStats.totalLeadValue}
          totalActiveValue={pipelineStats.totalActiveValue}
          totalPartnerValue={pipelineStats.totalPartnerValue}
        />
      </div>

      {/* ── Clients ── */}
      <ClientsTable clients={clients} />

      {/* ── Red flags ── */}
      {errors.length > 0 && <RedFlags errors={errors} />}
    </div>
  )
}
