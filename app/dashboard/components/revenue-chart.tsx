'use client'

import { useState } from 'react'
import { AreaChart, Area, XAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { SpotlightCard } from '@/components/ui/spotlight-card'
import { t } from '@/lib/tokens'
import { formatPLN } from '@/lib/format'

interface RevenueChartProps {
  data: { month: string; paid: number; pending: number }[]
}

type Period = '6M' | '3M' | '1M'

// Pending line color — muted gray-blue, distinct from gold but not colorful
const PENDING_COLOR = 'rgba(242,242,244,0.30)'
const PENDING_STROKE = 'rgba(242,242,244,0.45)'

function CustomTooltip({
  active, payload, label,
}: {
  active?: boolean
  payload?: { dataKey?: string; value?: number; color?: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div
      style={{
        backgroundColor: t.bg.cardSolid,
        border: `1px solid ${t.border.hover}`,
        borderRadius: t.radius.md,
        padding: '12px 16px',
        boxShadow: t.shadow.cardMd,
        minWidth: 180,
      }}
    >
      <p style={{ fontSize: 11, fontWeight: 600, color: t.text.muted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </p>
      {payload.map((entry) => (
        <div key={entry.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: entry.color ?? '#fff' }} />
          <span style={{ fontSize: 13, color: t.text.secondary, flex: 1 }}>
            {entry.dataKey === 'paid' ? 'Zapłacone' : 'Oczekujące'}
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: t.text.primary }}>
            {formatPLN(entry.value as number)}
          </span>
        </div>
      ))}
    </div>
  )
}

export function RevenueChart({ data }: RevenueChartProps) {
  const [period, setPeriod] = useState<Period>('6M')
  const sliceCount = period === '6M' ? 6 : period === '3M' ? 3 : 1
  const displayData = data.slice(-sliceCount)
  const totalPaid = displayData.reduce((s, d) => s + d.paid, 0)
  const totalPending = displayData.reduce((s, d) => s + d.pending, 0)
  const isEmpty = data.length === 0 || data.every((d) => d.paid === 0 && d.pending === 0)

  return (
    <SpotlightCard
      style={{
        borderRadius: t.radius.lg,
        padding: 24,
        backgroundColor: t.bg.card,
        border: `1px solid ${t.border.default}`,
        boxShadow: t.shadow.card,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 22, gap: 16 }}>
        <div>
          <span style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.14em', color: t.text.muted, display: 'block', marginBottom: 10 }}>
            Przychód
          </span>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20 }}>
            <div>
              <div
                style={{
                  fontSize: 22, fontWeight: 300, letterSpacing: '-0.035em', lineHeight: 1,
                  background: t.brand.gradient,
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                  display: 'inline-block',
                }}
              >
                {formatPLN(totalPaid)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5 }}>
                <div style={{ width: 10, height: 2, borderRadius: 2, background: t.brand.gradient }} />
                <span style={{ fontSize: 12, color: t.text.muted }}>Zapłacone</span>
              </div>
            </div>
            <div style={{ width: 1, height: 36, backgroundColor: t.border.default, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 22, fontWeight: 300, color: t.text.muted, letterSpacing: '-0.035em', lineHeight: 1 }}>
                {formatPLN(totalPending)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5 }}>
                <div style={{ width: 10, height: 2, borderRadius: 2, backgroundColor: PENDING_STROKE }} />
                <span style={{ fontSize: 12, color: t.text.muted }}>Oczekujące</span>
              </div>
            </div>
          </div>
        </div>

        {/* Period selector */}
        <div
          style={{
            display: 'flex', gap: 2,
            backgroundColor: t.bg.muted,
            borderRadius: t.radius.md, padding: 3,
            border: `1px solid ${t.border.default}`, flexShrink: 0,
          }}
        >
          {(['6M', '3M', '1M'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: '5px 12px', borderRadius: t.radius.sm,
                fontSize: 12, fontWeight: 500, cursor: 'pointer', border: 'none',
                transition: 'all 150ms',
                background: period === p ? 'rgba(255,255,255,0.10)' : 'transparent',
                color: period === p ? t.text.primary : t.text.muted,
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {isEmpty ? (
        <div
          style={{
            height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: t.text.muted, fontSize: 14,
            border: `1px dashed ${t.border.default}`, borderRadius: t.radius.md,
          }}
        >
          Brak danych — dodaj pierwsze projekty
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={displayData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="rcGold" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={t.brand.gold} stopOpacity={0.25} />
                <stop offset="100%" stopColor={t.brand.gold} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="rcPending" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="rgba(242,242,244,1)" stopOpacity={0.10} />
                <stop offset="100%" stopColor="rgba(242,242,244,1)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid horizontal vertical={false} stroke={t.border.subtle} />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: t.text.muted }} axisLine={false} tickLine={false} dy={8} />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: t.border.hover, strokeWidth: 1 }} />
            <Area type="monotone" dataKey="paid"    stroke={t.brand.gold}   strokeWidth={2}   fill="url(#rcGold)"    dot={false} activeDot={{ r: 4, fill: t.brand.gold,   strokeWidth: 0 }} />
            <Area type="monotone" dataKey="pending" stroke={PENDING_STROKE} strokeWidth={1.5} fill="url(#rcPending)" dot={false} activeDot={{ r: 4, fill: PENDING_STROKE, strokeWidth: 0 }} strokeDasharray="4 3" />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </SpotlightCard>
  )
}
