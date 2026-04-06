import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase'
import { AiUsageLogEntry, AiUsageStats } from '@/lib/types'
import { t } from '@/lib/tokens'
import { formatPLN, relativeTime } from '@/lib/format'
import { TrendChart } from './trend-chart'
import { Bot } from 'lucide-react'

const FEATURE_LABELS: Record<string, string> = {
  meetingBrief: 'Brief spotkania',
  auditAnalysis: 'Analiza audytu',
  noteIngestion: 'Ingestion notatek',
  meetingAnalysis: 'Analiza transkryptu',
  guardianReport: 'Guardian Agent',
  taskGeneration: 'Generowanie zadań',
}

const MODEL_SHORT: Record<string, string> = {
  'claude-haiku-4-5-20251001': 'Haiku',
  'claude-sonnet-4-6': 'Sonnet',
  'claude-opus-4-6': 'Opus',
}

function featureLabel(feature: string) {
  return FEATURE_LABELS[feature] ?? feature
}

function modelShort(model: string) {
  return MODEL_SHORT[model] ?? model
}

async function fetchAiUsageStats(): Promise<AiUsageStats> {
  const supabase = createSupabaseAdminClient()
  const USD_PLN_RATE = parseFloat(process.env.USD_PLN_RATE ?? '4.0')

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()

  const [
    { data: monthRows },
    { data: trendRows },
    { data: recentRows },
    { data: clientRows },
  ] = await Promise.all([
    supabase.from('ai_usage_log').select('feature, model, cost_usd, input_tokens, output_tokens').gte('created_at', monthStart),
    supabase.from('ai_usage_log').select('cost_usd, created_at').gte('created_at', thirtyDaysAgo).order('created_at', { ascending: true }),
    supabase.from('ai_usage_log').select('id, feature, model, input_tokens, output_tokens, cost_usd, client_id, created_at').order('created_at', { ascending: false }).limit(20),
    supabase.from('ai_usage_log').select('client_id, cost_usd').gte('created_at', monthStart).not('client_id', 'is', null),
  ])

  const month = (monthRows ?? []).reduce(
    (acc, row) => {
      const cost = parseFloat(String(row.cost_usd))
      return {
        cost_usd: acc.cost_usd + cost,
        cost_pln: acc.cost_pln + cost * USD_PLN_RATE,
        total_calls: acc.total_calls + 1,
        total_input_tokens: acc.total_input_tokens + (row.input_tokens ?? 0),
        total_output_tokens: acc.total_output_tokens + (row.output_tokens ?? 0),
      }
    },
    { cost_usd: 0, cost_pln: 0, total_calls: 0, total_input_tokens: 0, total_output_tokens: 0 }
  )

  const featureMap = new Map<string, { cost_usd: number; calls: number }>()
  for (const row of monthRows ?? []) {
    const e = featureMap.get(row.feature) ?? { cost_usd: 0, calls: 0 }
    featureMap.set(row.feature, { cost_usd: e.cost_usd + parseFloat(String(row.cost_usd)), calls: e.calls + 1 })
  }
  const by_feature = Array.from(featureMap.entries()).map(([feature, v]) => ({ feature, ...v })).sort((a, b) => b.cost_usd - a.cost_usd)

  const modelMap = new Map<string, { cost_usd: number; calls: number }>()
  for (const row of monthRows ?? []) {
    const e = modelMap.get(row.model) ?? { cost_usd: 0, calls: 0 }
    modelMap.set(row.model, { cost_usd: e.cost_usd + parseFloat(String(row.cost_usd)), calls: e.calls + 1 })
  }
  const by_model = Array.from(modelMap.entries()).map(([model, v]) => ({ model, ...v })).sort((a, b) => b.cost_usd - a.cost_usd)

  const dayMap = new Map<string, { cost_usd: number; calls: number }>()
  for (const row of trendRows ?? []) {
    const day = (row.created_at as string).slice(0, 10)
    const e = dayMap.get(day) ?? { cost_usd: 0, calls: 0 }
    dayMap.set(day, { cost_usd: e.cost_usd + parseFloat(String(row.cost_usd)), calls: e.calls + 1 })
  }
  const daily_trend = Array.from(dayMap.entries()).map(([date, v]) => ({ date, ...v })).sort((a, b) => a.date.localeCompare(b.date))

  // Per-client aggregation — fetch client names in one query
  const clientMap = new Map<string, { cost_usd: number; calls: number }>()
  for (const row of clientRows ?? []) {
    if (!row.client_id) continue
    const e = clientMap.get(row.client_id) ?? { cost_usd: 0, calls: 0 }
    clientMap.set(row.client_id, { cost_usd: e.cost_usd + parseFloat(String(row.cost_usd)), calls: e.calls + 1 })
  }
  let by_client: AiUsageStats['by_client'] = []
  if (clientMap.size > 0) {
    const clientIds = Array.from(clientMap.keys())
    const { data: clients } = await supabase.from('clients').select('id, name').in('id', clientIds)
    const nameById = new Map((clients ?? []).map(c => [c.id, c.name]))
    by_client = Array.from(clientMap.entries())
      .map(([client_id, v]) => ({ client_id, client_name: nameById.get(client_id) ?? 'Nieznany', ...v }))
      .sort((a, b) => b.cost_usd - a.cost_usd)
      .slice(0, 5)
  }

  // Monthly projection based on days elapsed
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysElapsed = Math.max(now.getDate(), 1)
  const projection_month_usd = (month.cost_usd / daysElapsed) * daysInMonth

  const budgetEnv = process.env.AI_MONTHLY_BUDGET_USD
  const budget_usd = budgetEnv ? parseFloat(budgetEnv) : null

  return {
    month,
    by_feature,
    by_model,
    by_client,
    daily_trend,
    recent: (recentRows ?? []).map(r => ({ ...r, cost_usd: parseFloat(String(r.cost_usd)) })) as AiUsageLogEntry[],
    usd_pln_rate: USD_PLN_RATE,
    projection_month_usd,
    budget_usd,
  }
}

export default async function AiCostsPage() {
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return null

  const stats = await fetchAiUsageStats()
  const maxModelCost = Math.max(...stats.by_model.map(m => m.cost_usd), 0.0001)

  const avgCostPerCall = stats.month.total_calls > 0
    ? stats.month.cost_usd / stats.month.total_calls
    : 0

  const budgetPct = stats.budget_usd && stats.budget_usd > 0
    ? (stats.month.cost_usd / stats.budget_usd) * 100
    : null

  const projectionPct = stats.budget_usd && stats.budget_usd > 0
    ? (stats.projection_month_usd / stats.budget_usd) * 100
    : null

  const kpis = [
    { label: 'Koszt AI — ten miesiąc (USD)', value: `$${stats.month.cost_usd.toFixed(4)}`, sub: `kurs ${stats.usd_pln_rate} PLN/USD` },
    { label: 'Prognoza do końca miesiąca', value: `$${stats.projection_month_usd.toFixed(4)}`, sub: projectionPct !== null ? `${projectionPct.toFixed(0)}% budżetu` : 'brak limitu' },
    { label: 'Wywołania API', value: stats.month.total_calls.toLocaleString('pl-PL'), sub: `śr. $${avgCostPerCall.toFixed(5)}/wywołanie` },
    { label: 'Łącznie tokenów', value: (stats.month.total_input_tokens + stats.month.total_output_tokens).toLocaleString('pl-PL'), sub: `wej: ${stats.month.total_input_tokens.toLocaleString('pl-PL')} | wyj: ${stats.month.total_output_tokens.toLocaleString('pl-PL')}` },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <style>{`
        @keyframes barGrow { from { width: 0% } to { width: var(--bar-w) } }
        .cost-bar { animation: barGrow 600ms cubic-bezier(0.4,0,0.2,1) forwards; }
        .usage-row:hover { background: rgba(255,255,255,0.03) !important; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: t.radius.md,
          background: 'rgba(129,140,248,0.12)', border: '1px solid rgba(129,140,248,0.20)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Bot style={{ width: 17, height: 17, color: '#818CF8' }} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: t.text.primary, letterSpacing: '-0.03em' }}>
            Koszty AI
          </h1>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: t.text.muted }}>
            Śledzenie zużycia i kosztów modeli Claude
          </p>
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {kpis.map((kpi, i) => (
          <div key={i} style={{
            background: t.bg.card, border: `1px solid ${t.border.default}`,
            borderRadius: t.radius.lg, padding: '16px 18px',
          }}>
            <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.12em', color: t.text.muted, marginBottom: 10 }}>
              {kpi.label}
            </div>
            <div style={{ fontSize: 22, fontWeight: 300, color: t.text.primary, letterSpacing: '-0.03em', lineHeight: 1 }}>
              {kpi.value}
            </div>
            <div style={{ fontSize: 11, color: t.text.muted, marginTop: 6 }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Budget alert */}
      {budgetPct !== null && budgetPct >= 80 && (
        <div style={{
          padding: '12px 18px', borderRadius: t.radius.md,
          background: budgetPct >= 100 ? 'rgba(239,68,68,0.10)' : 'rgba(234,179,8,0.10)',
          border: `1px solid ${budgetPct >= 100 ? 'rgba(239,68,68,0.30)' : 'rgba(234,179,8,0.30)'}`,
          fontSize: 13,
          color: budgetPct >= 100 ? '#FCA5A5' : '#FDE68A',
        }}>
          {budgetPct >= 100
            ? `Budżet AI przekroczony — ${budgetPct.toFixed(0)}% limitu ($${stats.budget_usd?.toFixed(2)}). Sprawdź użycie.`
            : `Uwaga: ${budgetPct.toFixed(0)}% miesięcznego budżetu AI ($${stats.budget_usd?.toFixed(2)}) wykorzystane. Prognoza: $${stats.projection_month_usd.toFixed(4)}.`
          }
        </div>
      )}

      {/* Trend chart + Model breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>

        {/* Trend */}
        <div style={{ background: t.bg.card, border: `1px solid ${t.border.default}`, borderRadius: t.radius.lg, padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.12em', color: t.text.muted, marginBottom: 16 }}>
            Trend — ostatnie 30 dni (USD)
          </div>
          <TrendChart data={stats.daily_trend} />
        </div>

        {/* By model */}
        <div style={{ background: t.bg.card, border: `1px solid ${t.border.default}`, borderRadius: t.radius.lg, padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.12em', color: t.text.muted, marginBottom: 16 }}>
            Koszt wg modelu
          </div>
          {stats.by_model.length === 0 ? (
            <div style={{ fontSize: 13, color: t.text.muted, paddingTop: 8 }}>Brak danych</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {stats.by_model.map(m => {
                const pct = (m.cost_usd / maxModelCost) * 100
                return (
                  <div key={m.model}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, color: t.text.secondary }}>{modelShort(m.model)}</span>
                      <span style={{ fontSize: 12, color: t.text.muted }}>${m.cost_usd.toFixed(4)} · {m.calls}×</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                      <div
                        className="cost-bar"
                        style={{
                          height: '100%', borderRadius: 2,
                          background: '#818CF8',
                          ['--bar-w' as string]: `${pct}%`,
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Per-client costs */}
      {stats.by_client.length > 0 && (
        <div style={{ background: t.bg.card, border: `1px solid ${t.border.default}`, borderRadius: t.radius.lg, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${t.border.subtle}` }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: t.text.primary }}>TOP klienci — koszt AI (ten miesiąc)</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                {['Klient', 'Wywołania', 'Koszt USD', 'Koszt PLN'].map(h => (
                  <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.10em', color: t.text.muted, borderBottom: `1px solid ${t.border.subtle}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.by_client.map((row, i) => (
                <tr key={row.client_id} className="usage-row" style={{ borderBottom: i < stats.by_client.length - 1 ? `1px solid ${t.border.subtle}` : 'none' }}>
                  <td style={{ padding: '12px 20px', fontSize: 13, color: t.text.primary }}>{row.client_name}</td>
                  <td style={{ padding: '12px 20px', fontSize: 13, color: t.text.secondary }}>{row.calls}</td>
                  <td style={{ padding: '12px 20px', fontSize: 13, color: t.text.secondary, fontFamily: 'monospace' }}>${row.cost_usd.toFixed(4)}</td>
                  <td style={{ padding: '12px 20px', fontSize: 13, color: t.text.secondary }}>{formatPLN(row.cost_usd * stats.usd_pln_rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* By feature table */}
      <div style={{ background: t.bg.card, border: `1px solid ${t.border.default}`, borderRadius: t.radius.lg, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${t.border.subtle}` }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: t.text.primary }}>Koszt wg funkcji — ten miesiąc</span>
        </div>
        {stats.by_feature.length === 0 ? (
          <div style={{ padding: '24px 20px', fontSize: 13, color: t.text.muted }}>
            Brak danych — uruchom migrację <code>scripts/migrations/004_ai_usage_log.sql</code> w Supabase
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                {['Funkcja', 'Wywołania', 'Koszt USD', 'Koszt PLN'].map(h => (
                  <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.10em', color: t.text.muted, borderBottom: `1px solid ${t.border.subtle}` }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.by_feature.map((row, i) => (
                <tr key={row.feature} style={{ borderBottom: i < stats.by_feature.length - 1 ? `1px solid ${t.border.subtle}` : 'none' }}>
                  <td style={{ padding: '12px 20px', fontSize: 13, color: t.text.primary }}>{featureLabel(row.feature)}</td>
                  <td style={{ padding: '12px 20px', fontSize: 13, color: t.text.secondary }}>{row.calls}</td>
                  <td style={{ padding: '12px 20px', fontSize: 13, color: t.text.secondary, fontFamily: 'monospace' }}>${row.cost_usd.toFixed(4)}</td>
                  <td style={{ padding: '12px 20px', fontSize: 13, color: t.text.secondary }}>{formatPLN(row.cost_usd * stats.usd_pln_rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Recent log */}
      <div style={{ background: t.bg.card, border: `1px solid ${t.border.default}`, borderRadius: t.radius.lg, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${t.border.subtle}` }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: t.text.primary }}>Ostatnie wywołania</span>
        </div>
        {stats.recent.length === 0 ? (
          <div style={{ padding: '24px 20px', fontSize: 13, color: t.text.muted }}>Brak danych</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                {['Czas', 'Funkcja', 'Model', 'Tok. wej.', 'Tok. wyj.', 'Koszt USD'].map(h => (
                  <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.10em', color: t.text.muted, borderBottom: `1px solid ${t.border.subtle}` }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.recent.map((row, i) => (
                <tr key={row.id} className="usage-row" style={{ borderBottom: i < stats.recent.length - 1 ? `1px solid ${t.border.subtle}` : 'none' }}>
                  <td style={{ padding: '11px 20px', fontSize: 12, color: t.text.muted }}>{relativeTime(row.created_at)}</td>
                  <td style={{ padding: '11px 20px', fontSize: 13, color: t.text.secondary }}>{featureLabel(row.feature)}</td>
                  <td style={{ padding: '11px 20px', fontSize: 12, color: t.text.muted }}>{modelShort(row.model)}</td>
                  <td style={{ padding: '11px 20px', fontSize: 12, color: t.text.muted, fontFamily: 'monospace' }}>{row.input_tokens.toLocaleString('pl-PL')}</td>
                  <td style={{ padding: '11px 20px', fontSize: 12, color: t.text.muted, fontFamily: 'monospace' }}>{row.output_tokens.toLocaleString('pl-PL')}</td>
                  <td style={{ padding: '11px 20px', fontSize: 12, color: t.text.secondary, fontFamily: 'monospace' }}>${row.cost_usd.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
