'use client'

import { AreaChart, Area, XAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { t } from '@/lib/tokens'

interface TrendChartProps {
  data: { date: string; cost_usd: number; calls: number }[]
}

function CustomTooltip({
  active, payload, label,
}: {
  active?: boolean
  payload?: { dataKey?: string; value?: number }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  const cost = payload.find(p => p.dataKey === 'cost_usd')?.value ?? 0
  const calls = payload.find(p => p.dataKey === 'calls')?.value ?? 0
  return (
    <div style={{
      backgroundColor: t.bg.cardSolid,
      border: `1px solid ${t.border.hover}`,
      borderRadius: t.radius.md,
      padding: '10px 14px',
      boxShadow: t.shadow.cardMd,
      minWidth: 160,
    }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: t.text.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </p>
      <div style={{ fontSize: 13, color: t.text.primary, fontWeight: 600 }}>
        ${cost.toFixed(4)}
      </div>
      <div style={{ fontSize: 12, color: t.text.muted, marginTop: 3 }}>
        {calls} {calls === 1 ? 'wywołanie' : 'wywołań'}
      </div>
    </div>
  )
}

export function TrendChart({ data }: TrendChartProps) {
  const isEmpty = data.length === 0 || data.every(d => d.cost_usd === 0)

  // Format date labels: "2026-03-15" → "15.03"
  const displayData = data.map(d => ({
    ...d,
    label: d.date.slice(8, 10) + '.' + d.date.slice(5, 7),
  }))

  if (isEmpty) {
    return (
      <div style={{
        height: 180,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: t.text.muted, fontSize: 14,
        border: `1px dashed ${t.border.default}`, borderRadius: t.radius.md,
      }}>
        Brak danych — uruchom migration 004 i wywołaj pierwsze AI
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={displayData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#818CF8" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#818CF8" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid horizontal vertical={false} stroke={t.border.subtle} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: t.text.muted }} axisLine={false} tickLine={false} dy={8} />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: t.border.hover, strokeWidth: 1 }} />
        <Area type="monotone" dataKey="cost_usd" stroke="#818CF8" strokeWidth={2} fill="url(#costGrad)" dot={false} activeDot={{ r: 4, fill: '#818CF8', strokeWidth: 0 }} />
        <Area type="monotone" dataKey="calls" stroke="transparent" fill="transparent" />
      </AreaChart>
    </ResponsiveContainer>
  )
}
