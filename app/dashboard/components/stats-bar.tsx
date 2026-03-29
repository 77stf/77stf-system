'use client'

import { TrendingUp, Users, Target, AlertTriangle, CheckCircle } from 'lucide-react'
import { AnimatedCounter } from '@/components/ui/animated-counter'
import { t } from '@/lib/tokens'
import { formatPLN } from '@/lib/format'

interface StatsBarProps {
  revenue: number
  activeClients: number
  activeLeads: number
  alertCount: number
}

// ─── Sparkline (minimal, subtle) ─────────────────────────────────────────────

function buildPath(data: number[], w: number, h: number) {
  if (data.length < 2) return { line: '', area: '' }
  const min = Math.min(...data), max = Math.max(...data)
  const range = max - min || 1
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * w,
    y: h * 0.1 + ((max - v) / range) * (h * 0.8),
  }))
  let line = `M ${pts[0].x},${pts[0].y}`
  for (let i = 1; i < pts.length; i++) {
    const cp = (pts[i - 1].x + pts[i].x) / 2
    line += ` C ${cp},${pts[i - 1].y} ${cp},${pts[i].y} ${pts[i].x},${pts[i].y}`
  }
  return { line, area: line + ` L ${pts[pts.length-1].x},${h} L ${pts[0].x},${h} Z` }
}

function Sparkline({ data, color, id }: { data: number[]; color: string; id: string }) {
  const w = 64, h = 26
  const { line, area } = buildPath(data, w, h)
  if (!line) return null
  return (
    <svg width={w} height={h} style={{ display: 'block', flexShrink: 0, opacity: 0.65 }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity={0.20} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const SP_REVENUE = [18000, 22000, 19500, 28000, 31000, 38000, 42000]
const SP_CLIENTS = [3, 3, 4, 5, 5, 6, 7]
const SP_LEADS   = [8, 6, 9, 7, 11, 8, 4]

// ─── Component ───────────────────────────────────────────────────────────────

export function StatsBar({ revenue, activeClients, activeLeads, alertCount }: StatsBarProps) {
  const hasAlert = alertCount > 0

  const cards = [
    {
      label:      'Przychód łączny',
      Icon:       TrendingUp,
      isRevenue:  true,
      value:      revenue,
      sub:        '↑ 12% vs poprzedni miesiąc',
      subColor:   t.semantic.success,
      sparkData:  SP_REVENUE,
      sparkId:    'sp-rev',
      sparkColor: t.brand.gold,
    },
    {
      label:      'Aktywni klienci',
      Icon:       Users,
      isRevenue:  false,
      value:      activeClients,
      sub:        'aktywnych firm',
      subColor:   t.text.muted,
      sparkData:  SP_CLIENTS,
      sparkId:    'sp-cli',
      sparkColor: 'rgba(242,242,244,0.35)',
    },
    {
      label:      'Leady w pipeline',
      Icon:       Target,
      isRevenue:  false,
      value:      activeLeads,
      sub:        'otwarte szanse',
      subColor:   t.text.muted,
      sparkData:  SP_LEADS,
      sparkId:    'sp-lea',
      sparkColor: 'rgba(242,242,244,0.35)',
    },
    {
      label:      'Alerty systemu',
      Icon:       hasAlert ? AlertTriangle : CheckCircle,
      isRevenue:  false,
      value:      alertCount,
      sub:        hasAlert ? 'wymaga uwagi' : 'wszystko sprawne',
      subColor:   hasAlert ? t.semantic.error : t.semantic.success,
      sparkData:  [0, 1, 0, 2, 1, 0, alertCount],
      sparkId:    'sp-ale',
      sparkColor: hasAlert ? t.semantic.error : t.semantic.success,
    },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
      {cards.map((card, i) => (
        <div
          key={card.label}
          style={{
            borderRadius: t.radius.lg,
            padding: '22px 22px 18px',
            backgroundColor: i === cards.length - 1 && hasAlert
              ? t.semantic.errorBg
              : t.bg.card,
            border: `1px solid ${i === cards.length - 1 && hasAlert ? t.semantic.errorBorder : t.border.default}`,
            boxShadow: t.shadow.card,
            display: 'flex',
            flexDirection: 'column',
            gap: 0,
            animation: `cardEnter 0.32s ease-out ${i * 0.06}s both`,
          }}
        >
          {/* Label + icon */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <span
              style={{
                fontSize: 10, fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.14em',
                color: t.text.muted,
              }}
            >
              {card.label}
            </span>
            <card.Icon
              style={{
                width: 14, height: 14,
                color: i === cards.length - 1 && hasAlert ? t.semantic.error : t.text.muted,
                opacity: 0.75,
              }}
            />
          </div>

          {/* Value — large, light weight (Apple style) */}
          <AnimatedCounter
            value={card.value}
            formatter={card.isRevenue ? formatPLN : (v) => String(Math.round(v))}
            style={{
              fontSize: card.isRevenue ? 28 : 40,
              fontWeight: 300,
              letterSpacing: '-0.045em',
              lineHeight: 1,
              display: 'block',
              marginBottom: 16,
              ...(card.isRevenue ? {
                background: t.brand.gradient,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              } : {
                color: i === cards.length - 1 && hasAlert ? t.semantic.error : t.text.primary,
              }),
            }}
          />

          {/* Trend + sparkline */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 11, color: card.subColor, letterSpacing: '-0.01em' }}>
              {card.sub}
            </span>
            <Sparkline data={card.sparkData} color={card.sparkColor} id={card.sparkId} />
          </div>
        </div>
      ))}
    </div>
  )
}
