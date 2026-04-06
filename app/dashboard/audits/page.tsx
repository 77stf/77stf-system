'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardCheck, Sparkles, ChevronRight, CheckCircle2, Clock, AlertCircle } from 'lucide-react'
import { t } from '@/lib/tokens'
import { formatDate } from '@/lib/format'
import type { Audit } from '@/lib/types'

function statusLabel(s: string) {
  if (s === 'completed') return { label: 'Ukończony', color: t.semantic.success, bg: 'rgba(34,197,94,0.08)' }
  if (s === 'analyzing') return { label: 'Analizuje...', color: t.semantic.warning, bg: 'rgba(234,179,8,0.08)' }
  return { label: 'W trakcie', color: t.text.muted, bg: t.bg.muted }
}

function scoreColor(score: number): string {
  if (score <= 30) return t.semantic.error
  if (score <= 60) return t.semantic.warning
  return t.semantic.success
}

type AuditRow = Omit<Audit, 'client'> & {
  client?: { id: string; name: string; industry?: string; status: string } | null
}

export default function AuditsPage() {
  const router = useRouter()
  const [audits, setAudits] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/audits')
      .then(r => r.json())
      .then((d: { audits?: AuditRow[] }) => setAudits(d.audits ?? []))
      .catch(() => setAudits([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ClipboardCheck style={{ width: 20, height: 20, color: t.brand.gold }} />
            <h1 style={{ fontSize: 22, fontWeight: 800, color: t.text.primary, margin: 0 }}>Audyty Operacyjne</h1>
          </div>
          <p style={{ fontSize: 14, color: t.text.muted, margin: '4px 0 0' }}>
            Analizy AI gotowości firm do automatyzacji
          </p>
        </div>
      </div>

      {/* Table */}
      <div style={{
        backgroundColor: t.bg.card, border: `1px solid ${t.border.default}`,
        borderRadius: t.radius.lg, overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: t.text.muted, fontSize: 14 }}>
            Ładowanie...
          </div>
        ) : audits.length === 0 ? (
          <div style={{ padding: '56px 24px', textAlign: 'center' }}>
            <ClipboardCheck style={{ width: 36, height: 36, color: t.text.muted, margin: '0 auto 14px' }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: t.text.secondary, marginBottom: 6 }}>Brak audytów</div>
            <div style={{ fontSize: 13, color: t.text.muted }}>
              Otwórz profil klienta i kliknij &ldquo;Audyt Operacyjny&rdquo;
            </div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${t.border.default}` }}>
                {['Klient', 'Tytuł', 'Status', 'Wynik', 'Data', ''].map((h, hi) => (
                  <th key={hi} style={{
                    padding: '12px 20px', textAlign: 'left',
                    fontSize: 11, fontWeight: 600, color: t.text.muted,
                    textTransform: 'uppercase' as const, letterSpacing: '0.08em',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {audits.map((audit, i) => {
                const s = statusLabel(audit.status)
                return (
                  <tr
                    key={audit.id}
                    style={{
                      borderBottom: i < audits.length - 1 ? `1px solid ${t.border.default}` : 'none',
                      cursor: 'pointer', transition: 'background 150ms',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = t.bg.muted }}
                    onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent' }}
                    onClick={() => router.push(`/dashboard/clients/${audit.client_id}/audit`)}
                  >
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: t.text.primary }}>{audit.client?.name ?? '—'}</div>
                      {audit.client?.industry && (
                        <div style={{ fontSize: 11, color: t.text.muted, marginTop: 2 }}>{audit.client.industry}</div>
                      )}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ fontSize: 13, color: t.text.secondary }}>{audit.title}</span>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, color: s.color,
                        backgroundColor: s.bg,
                        padding: '3px 10px', borderRadius: t.radius.full,
                      }}>
                        {s.label}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      {audit.score != null
                        ? <span style={{ fontSize: 14, fontWeight: 800, color: scoreColor(audit.score) }}>{audit.score}/100</span>
                        : <span style={{ fontSize: 13, color: t.text.muted }}>—</span>
                      }
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ fontSize: 12, color: t.text.muted }}>{formatDate(audit.created_at)}</span>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <ChevronRight style={{ width: 15, height: 15, color: t.text.muted }} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
