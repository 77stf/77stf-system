import { NextResponse } from 'next/server'
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase'
import { AiUsageLogEntry, AiUsageStats } from '@/lib/types'

export async function GET() {
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })

  const supabase = createSupabaseAdminClient()
  const USD_PLN_RATE = parseFloat(process.env.USD_PLN_RATE ?? '4.0')

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()

  const [
    { data: monthRows },
    { data: trendRows },
    { data: recentRows },
  ] = await Promise.all([
    supabase
      .from('ai_usage_log')
      .select('feature, model, cost_usd, input_tokens, output_tokens')
      .gte('created_at', monthStart),
    supabase
      .from('ai_usage_log')
      .select('cost_usd, created_at')
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: true }),
    supabase
      .from('ai_usage_log')
      .select('id, feature, model, input_tokens, output_tokens, cost_usd, client_id, created_at')
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  // Aggregate month stats
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

  // Group by feature
  const featureMap = new Map<string, { cost_usd: number; calls: number }>()
  for (const row of monthRows ?? []) {
    const existing = featureMap.get(row.feature) ?? { cost_usd: 0, calls: 0 }
    featureMap.set(row.feature, {
      cost_usd: existing.cost_usd + parseFloat(String(row.cost_usd)),
      calls: existing.calls + 1,
    })
  }
  const by_feature = Array.from(featureMap.entries())
    .map(([feature, v]) => ({ feature, ...v }))
    .sort((a, b) => b.cost_usd - a.cost_usd)

  // Group by model
  const modelMap = new Map<string, { cost_usd: number; calls: number }>()
  for (const row of monthRows ?? []) {
    const existing = modelMap.get(row.model) ?? { cost_usd: 0, calls: 0 }
    modelMap.set(row.model, {
      cost_usd: existing.cost_usd + parseFloat(String(row.cost_usd)),
      calls: existing.calls + 1,
    })
  }
  const by_model = Array.from(modelMap.entries())
    .map(([model, v]) => ({ model, ...v }))
    .sort((a, b) => b.cost_usd - a.cost_usd)

  // Daily trend (last 30 days)
  const dayMap = new Map<string, { cost_usd: number; calls: number }>()
  for (const row of trendRows ?? []) {
    const day = row.created_at.slice(0, 10)
    const existing = dayMap.get(day) ?? { cost_usd: 0, calls: 0 }
    dayMap.set(day, {
      cost_usd: existing.cost_usd + parseFloat(String(row.cost_usd)),
      calls: existing.calls + 1,
    })
  }
  const daily_trend = Array.from(dayMap.entries())
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const now2 = new Date()
  const daysInMonth = new Date(now2.getFullYear(), now2.getMonth() + 1, 0).getDate()
  const daysElapsed = Math.max(now2.getDate(), 1)
  const projection_month_usd = (month.cost_usd / daysElapsed) * daysInMonth

  const budgetEnv = process.env.AI_MONTHLY_BUDGET_USD
  const budget_usd = budgetEnv ? parseFloat(budgetEnv) : null

  const stats: AiUsageStats = {
    month,
    by_feature,
    by_model,
    by_client: [],
    daily_trend,
    recent: (recentRows ?? []).map(r => ({
      ...r,
      cost_usd: parseFloat(String(r.cost_usd)),
    })) as AiUsageLogEntry[],
    usd_pln_rate: USD_PLN_RATE,
    projection_month_usd,
    budget_usd,
  }

  return NextResponse.json(stats)
}
