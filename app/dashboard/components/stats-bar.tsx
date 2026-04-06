'use client'

import { TrendingUp, Users, CheckSquare, AlertTriangle, CheckCircle, Bot } from 'lucide-react'
import { AnimatedCounter } from '@/components/ui/animated-counter'
import { t } from '@/lib/tokens'
import { formatPLN } from '@/lib/format'

interface StatsBarProps {
  mrr: number
  totalSetup: number
  activeClients: number
  openTasks: number
  overdueCount: number
  aiCostMonth: number
  aiPct: number
}

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
  const w = 56, h = 24
  const { line, area } = buildPath(data, w, h)
  if (!line) return null
  return (
    <svg width={w} height={h} style={{ display: 'block', flexShrink: 0, opacity: 0.6 }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity={0.22} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function StatsBar({ mrr, totalSetup, activeClients, openTasks, overdueCount, aiCostMonth, aiPct }: StatsBarProps) {
  const hasOverdue = overdueCount > 0
  const aiWarning = aiPct >= 80

  const cards = [
    {
      label:     'MRR',
      Icon:      TrendingUp,
      isRevenue: true,
      value:     mrr,
      sub:       totalSetup > 0 ? `+${formatPLN(totalSetup)} setup` : 'przychód miesięczny',
      subColor:  t.semantic.success,
      sparkData: [mrr * 0.6, mrr * 0.7, mrr * 0.75, mrr * 0.8, mrr * 0.9, mrr * 0.95, mrr],
      sparkId:   'sp-mrr',
      sparkColor: t.brand.gold,
      href: '/dashboard/quotes',
    },
    {
      label:     'Aktywni klienci',
      Icon:      Users,
      isRevenue: false,
      value:     activeClients,
      sub:       'aktywnych + partnerów',
      subColor:  t.text.muted,
      sparkData: [Math.max(0, activeClients - 3), activeClients - 2, activeClients - 2, activeClients - 1, activeClients - 1, activeClients, activeClients],
      sparkId:   'sp-cli',
      sparkColor: 'rgba(242,242,244,0.35)',
      href: '/dashboard/clients',
    },
    {
      label:     'Otwarte zadania',
      Icon:      hasOverdue ? AlertTriangle : CheckSquare,
      isRevenue: false,
      value:     openTasks,
      sub:       hasOverdue ? `${overdueCount} po terminie` : 'wszystkie w terminie',
      subColor:  hasOverdue ? t.semantic.error : t.semantic.success,
      sparkData: [openTasks + 3, openTasks + 2, openTasks + 4, openTasks + 1, openTasks + 2, openTasks + 1, openTasks],
      sparkId:   'sp-tsk',
      sparkColor: hasOverdue ? t.semantic.error : t.semantic.success,
      href: '/dashboard/tasks',
    },
    {
      label:     'Koszty AI (mies.)',
      Icon:      aiWarning ? AlertTriangle : Bot,
      isRevenue: false,
      value:     aiPct,
      sub:       `$${aiCostMonth.toFixed(2)} wydane`,
      subColor:  aiWarning ? t.semantic.error : t.text.muted,
      sparkData: [aiPct * 0.2, aiPct * 0.4, aiPct * 0.5, aiPct * 0.65, aiPct * 0.8, aiPct * 0.9, aiPct],
      sparkId:   'sp-ai',
      sparkColor: aiWarning ? t.semantic.error : t.semantic.info,
      href: '/dashboard/ai-costs',
    },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
      {cards.map((card, i) => (
        <a
          key={card.label}
          href={card.href}
          style={{
            borderRadius: t.radius.lg,
            padding: '20px 20px 16px',
            backgroundColor: i === 2 && hasOverdue
              ? t.semantic.errorBg
              : i === 3 && aiWarning
              ? t.semantic.warningBg
              : t.bg.card,
            border: `1px solid ${
              i === 2 && hasOverdue ? t.semantic.errorBorder
              : i === 3 && aiWarning ? t.semantic.warningBorder
              : t.border.default}`,
            boxShadow: t.shadow.card,
            display: 'flex', flexDirection: 'column', gap: 0,
            animation: `cardEnter 0.32s ease-out ${i * 0.06}s both`,
            textDecoration: 'none',
            transition: 'border-color 0.15s',
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: t.text.muted }}>
              {card.label}
            </span>
            <card.Icon style={{ width: 13, height: 13, color: i === 2 && hasOverdue ? t.semantic.error : i === 3 && aiWarning ? t.semantic.warning : t.text.muted, opacity: 0.7 }} />
          </div>

          <AnimatedCounter
            value={card.value}
            formatter={
              card.isRevenue ? formatPLN
              : card.label === 'Koszty AI (mies.)' ? (v) => `${Math.round(v)}%`
              : (v) => String(Math.round(v))
            }
            style={{
              fontSize: card.isRevenue ? 26 : 38,
              fontWeight: 300,
              letterSpacing: '-0.045em',
              lineHeight: 1,
              display: 'block',
              marginBottom: 14,
              ...(card.isRevenue ? {
                background: t.brand.gradient,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              } : {
                color: i === 2 && hasOverdue ? t.semantic.error
                     : i === 3 && aiWarning ? t.semantic.warning
                     : t.text.primary,
              }),
            }}
          />

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 11, color: card.subColor, letterSpacing: '-0.01em', lineHeight: 1.3 }}>
              {card.sub}
            </span>
            <Sparkline data={card.sparkData} color={card.sparkColor} id={card.sparkId} />
          </div>
        </a>
      ))}
    </div>
  )
}
