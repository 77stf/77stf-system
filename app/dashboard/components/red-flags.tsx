'use client'

import { AlertTriangle, Clock } from 'lucide-react'
import { Automation, Client } from '@/lib/types'
import { t } from '@/lib/tokens'
import { relativeTime } from '@/lib/format'

interface RedFlagsProps {
  errors: (Automation & { client?: Client })[]
}

export function RedFlags({ errors }: RedFlagsProps) {
  if (errors.length === 0) return null

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.14em', color: t.text.muted }}>
          Czerwone flagi
        </span>
        <span
          style={{
            fontSize: 12, fontWeight: 600,
            color: t.semantic.error,
            backgroundColor: t.semantic.errorBg,
            border: `1px solid ${t.semantic.errorBorder}`,
            padding: '2px 8px', borderRadius: t.radius.full,
          }}
        >
          {errors.length}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
        {errors.map((automation, i) => (
          <div
            key={automation.id}
            style={{
              padding: '16px 18px',
              borderRadius: t.radius.lg,
              backgroundColor: t.semantic.errorBg,
              border: `1px solid ${t.semantic.errorBorder}`,
              borderLeft: `3px solid ${t.semantic.error}`,
              boxShadow: t.shadow.card,
              animation: `fadeSlide 0.28s ease-out ${i * 0.05}s both`,
            }}
          >
            <div
              style={{
                display: 'flex', alignItems: 'flex-start',
                justifyContent: 'space-between', gap: 10,
                marginBottom: automation.error_message ? 10 : 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <div
                  style={{
                    width: 28, height: 28, borderRadius: t.radius.md,
                    backgroundColor: 'rgba(248,113,113,0.12)',
                    border: `1px solid ${t.semantic.errorBorder}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}
                >
                  <AlertTriangle style={{ width: 13, height: 13, color: t.semantic.error }} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.semantic.error }}>
                    {automation.client?.name ?? 'Nieznany klient'}
                  </div>
                  <div style={{ fontSize: 12, color: t.text.secondary, marginTop: 1 }}>
                    {automation.name}
                  </div>
                </div>
              </div>
              {automation.last_ping && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <Clock style={{ width: 11, height: 11, color: t.text.muted }} />
                  <span style={{ fontSize: 11, color: t.text.muted }}>{relativeTime(automation.last_ping)}</span>
                </div>
              )}
            </div>
            {automation.error_message && (
              <div
                style={{
                  fontSize: 12, color: t.text.secondary, lineHeight: 1.5,
                  fontFamily: 'monospace',
                  backgroundColor: t.bg.muted,
                  border: `1px solid ${t.border.default}`,
                  padding: '8px 10px', borderRadius: t.radius.sm,
                  overflow: 'hidden', display: '-webkit-box',
                  WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                }}
              >
                {automation.error_message}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
