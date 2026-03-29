'use client'

import { SpotlightCard } from '@/components/ui/spotlight-card'
import { AnimatedCounter } from '@/components/ui/animated-counter'
import { t } from '@/lib/tokens'
import { formatPLN } from '@/lib/format'

interface PipelineSummaryProps {
  leads: number
  active: number
  partners: number
  totalLeadValue: number
  totalActiveValue: number
  totalPartnerValue: number
}

export function PipelineSummary({
  leads, active, partners,
  totalLeadValue, totalActiveValue, totalPartnerValue,
}: PipelineSummaryProps) {
  const total = leads + active + partners || 1
  const estimatedMRR = totalActiveValue / 12 + totalPartnerValue / 12
  const totalPipelineValue = totalLeadValue + totalActiveValue + totalPartnerValue

  const stages = [
    { label: 'Leady',     count: leads,    value: totalLeadValue,   color: t.semantic.warning,  proportion: leads / total },
    { label: 'Aktywni',   count: active,   value: totalActiveValue,  color: t.brand.gold,         proportion: active / total },
    { label: 'Partnerzy', count: partners, value: totalPartnerValue, color: t.semantic.success,   proportion: partners / total },
  ]

  return (
    <SpotlightCard
      style={{
        borderRadius: t.radius.lg,
        padding: 24,
        backgroundColor: t.bg.card,
        border: `1px solid ${t.border.default}`,
        boxShadow: t.shadow.card,
        display: 'flex', flexDirection: 'column', height: '100%',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <span style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.14em', color: t.text.muted }}>
          Pipeline
        </span>
        <span
          style={{
            fontSize: 12, fontWeight: 500, color: t.text.secondary,
            backgroundColor: t.bg.muted,
            border: `1px solid ${t.border.default}`,
            padding: '3px 10px', borderRadius: t.radius.full,
          }}
        >
          {total} firm
        </span>
      </div>

      {/* Stages */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
        {stages.map((stage, i) => (
          <div key={stage.label}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: stage.color, flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 400, color: t.text.secondary }}>{stage.label}</span>
              </div>
              <div>
                <span style={{ fontSize: 14, fontWeight: 500, color: t.text.primary, marginRight: 6 }}>{stage.count}</span>
                <span style={{ fontSize: 12, color: t.text.muted }}>{formatPLN(stage.value)}</span>
              </div>
            </div>
            <div
              style={{
                height: 4, backgroundColor: t.bg.muted, borderRadius: t.radius.full,
                overflow: 'hidden', border: `1px solid ${t.border.subtle}`,
              }}
            >
              <div
                style={{
                  height: '100%', backgroundColor: stage.color,
                  borderRadius: t.radius.full,
                  minWidth: stage.count > 0 ? 4 : 0,
                  opacity: 0.85,
                  width: `${stage.proportion * 100}%`,
                  transformOrigin: 'left center',
                  animation: `progressExpand 0.8s ease-out ${i * 0.12 + 0.2}s both`,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div style={{ height: 1, backgroundColor: t.border.default, margin: '20px 0 16px' }} />

      {/* MRR + total */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <span style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.14em', color: t.text.muted, display: 'block', marginBottom: 4 }}>
            Est. MRR
          </span>
          <AnimatedCounter
            value={estimatedMRR}
            formatter={formatPLN}
            style={{
              fontSize: 22, fontWeight: 300, letterSpacing: '-0.035em', display: 'inline-block',
              background: t.brand.gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}
          />
        </div>
        <div>
          <span style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.14em', color: t.text.muted, display: 'block', marginBottom: 4 }}>
            Wartość pipeline
          </span>
          <span style={{ fontSize: 16, fontWeight: 300, letterSpacing: '-0.025em', color: t.text.secondary }}>
            {formatPLN(totalPipelineValue)}
          </span>
        </div>
      </div>
    </SpotlightCard>
  )
}
