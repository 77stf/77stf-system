'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { t } from '@/lib/tokens'
import { formatPLN } from '@/lib/format'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PortalData {
  client: {
    id: string
    name: string
    industry: string | null
    status: string
    owner_name: string | null
    owner_email: string | null
    owner_phone: string | null
  }
  stack: {
    id: string
    name: string
    category: string
    status: string
    description: string | null
    monthly_value_pln: number | null
  }[]
  quotes: {
    id: string
    title: string
    status: string
    setup_fee: number
    monthly_fee: number
    valid_until: string | null
    created_at: string
    updated_at: string
  }[]
  audit: {
    id: string
    title: string
    status: string
    score: number | null
    ai_summary: string | null
    completed_at: string | null
  } | null
}

// ─── Status maps ──────────────────────────────────────────────────────────────

const STACK_STATUS_LABEL: Record<string, string> = {
  idea:        'Koncepcja',
  planned:     'Zaplanowane',
  in_progress: 'W realizacji',
  live:        'Aktywne',
  deprecated:  'Wycofane',
  error:       'Błąd',
}

const STACK_STATUS_COLOR: Record<string, { color: string; bg: string; border: string }> = {
  live:        { color: '#4ade80', bg: 'rgba(74,222,128,0.09)', border: 'rgba(74,222,128,0.22)' },
  in_progress: { color: '#818CF8', bg: 'rgba(129,140,248,0.09)', border: 'rgba(129,140,248,0.22)' },
  planned:     { color: '#fbbf24', bg: 'rgba(251,191,36,0.09)', border: 'rgba(251,191,36,0.22)' },
  error:       { color: '#f87171', bg: 'rgba(248,113,113,0.09)', border: 'rgba(248,113,113,0.22)' },
  idea:        { color: 'rgba(242,242,244,0.45)', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.08)' },
  deprecated:  { color: 'rgba(242,242,244,0.28)', bg: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.06)' },
}

const CATEGORY_ICON: Record<string, string> = {
  automation: '⚡',
  integration: '🔗',
  ai_agent: '🤖',
  data: '📊',
  voice: '🎙️',
  reporting: '📈',
}

const QUOTE_STATUS_LABEL: Record<string, string> = {
  draft:    'Szkic',
  sent:     'Oczekuje na decyzję',
  accepted: 'Zaakceptowana',
  rejected: 'Odrzucona',
  expired:  'Wygasła',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ClientPortalPage() {
  const params = useParams()
  const clientId = params.clientId as string

  const [data, setData] = useState<PortalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [accepting, setAccepting] = useState<string | null>(null)
  const [acceptedIds, setAcceptedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch(`/api/portal/${clientId}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else setData(d)
      })
      .catch(() => setError('Nie udało się załadować danych portalu.'))
      .finally(() => setLoading(false))
  }, [clientId])

  async function acceptQuote(quoteId: string) {
    setAccepting(quoteId)
    try {
      const res = await fetch(`/api/portal/${clientId}/quotes/${quoteId}/accept`, { method: 'POST' })
      if (res.ok) {
        setAcceptedIds(s => new Set([...s, quoteId]))
      }
    } finally {
      setAccepting(null)
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
      <div style={{ color: t.text.muted, fontSize: 14 }}>Ładowanie...</div>
    </div>
  )

  if (error || !data) return (
    <div style={{
      padding: 24,
      background: t.semantic.errorBg,
      border: `1px solid ${t.semantic.errorBorder}`,
      borderRadius: t.radius.md,
      color: t.semantic.error,
      fontSize: 14,
    }}>
      {error || 'Brak dostępu do tego portalu.'}
    </div>
  )

  const { client, stack, quotes, audit } = data

  const liveItems = stack.filter(s => s.status === 'live')
  const inProgressItems = stack.filter(s => s.status === 'in_progress')
  const plannedItems = stack.filter(s => ['planned', 'idea'].includes(s.status))
  const totalMonthlyValue = liveItems.reduce((sum, s) => sum + (s.monthly_value_pln ?? 0), 0)
  const pendingQuotes = quotes.filter(q => q.status === 'sent' && !acceptedIds.has(q.id))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: '-0.5px' }}>
            {client.name}
          </h1>
          <p style={{ margin: '6px 0 0', color: t.text.muted, fontSize: 14 }}>
            {client.industry ?? ''}{client.owner_name ? ` · ${client.owner_name}` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {pendingQuotes.length > 0 && (
            <span style={{
              fontSize: 12, fontWeight: 700,
              padding: '5px 12px',
              borderRadius: t.radius.full,
              background: 'rgba(196,154,46,0.12)',
              border: '1px solid rgba(196,154,46,0.35)',
              color: t.brand.gold,
            }}>
              {pendingQuotes.length} wycena do zatwierdzenia
            </span>
          )}
          <a href="mailto:kontakt@77stf.pl" style={{
            fontSize: 13, fontWeight: 600,
            padding: '8px 16px',
            borderRadius: t.radius.sm,
            background: t.brand.gold,
            color: '#111114',
            textDecoration: 'none',
            display: 'inline-block',
          }}>
            Kontakt z 77STF
          </a>
        </div>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
        {[
          { label: 'Aktywnych wdrożeń', value: liveItems.length, unit: '' },
          { label: 'W realizacji', value: inProgressItems.length, unit: '' },
          { label: 'Zaplanowanych', value: plannedItems.length, unit: '' },
          { label: 'Wartość miesięczna', value: formatPLN(totalMonthlyValue), unit: '/mies.', raw: true },
        ].map(card => (
          <div key={card.label} style={{
            padding: '20px 20px',
            background: t.bg.card,
            border: `1px solid ${t.border.default}`,
            borderRadius: t.radius.md,
          }}>
            <div style={{ fontSize: 12, color: t.text.muted, marginBottom: 8 }}>{card.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: t.text.primary }}>
              {card.raw ? card.value : card.value}
              {card.unit && <span style={{ fontSize: 13, fontWeight: 400, color: t.text.muted }}> {card.unit}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Pending quotes */}
      {pendingQuotes.length > 0 && (
        <section>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px', color: t.text.primary }}>
            Wyceny do zatwierdzenia
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {pendingQuotes.map(quote => (
              <div key={quote.id} style={{
                padding: '20px 24px',
                background: 'rgba(196,154,46,0.04)',
                border: `1px solid ${t.border.gold}`,
                borderRadius: t.radius.md,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 16,
              }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: t.text.primary }}>{quote.title}</div>
                  <div style={{ fontSize: 13, color: t.text.muted, marginTop: 4 }}>
                    Wdrożenie: {formatPLN(quote.setup_fee)} jednorazowo
                    {quote.monthly_fee > 0 && ` · ${formatPLN(quote.monthly_fee)}/mies.`}
                    {quote.valid_until && ` · Ważna do ${new Date(quote.valid_until).toLocaleDateString('pl-PL')}`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <a href={`mailto:kontakt@77stf.pl?subject=Pytanie o wycenę: ${encodeURIComponent(quote.title)}`}
                    style={{
                      fontSize: 13, fontWeight: 500,
                      padding: '8px 16px',
                      borderRadius: t.radius.sm,
                      border: `1px solid ${t.border.default}`,
                      color: t.text.secondary,
                      textDecoration: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      display: 'inline-block',
                    }}>
                    Zapytaj
                  </a>
                  <button
                    onClick={() => acceptQuote(quote.id)}
                    disabled={accepting === quote.id}
                    style={{
                      fontSize: 13, fontWeight: 700,
                      padding: '8px 20px',
                      borderRadius: t.radius.sm,
                      background: t.brand.gold,
                      color: '#111114',
                      border: 'none',
                      cursor: accepting === quote.id ? 'wait' : 'pointer',
                      opacity: accepting === quote.id ? 0.7 : 1,
                    }}>
                    {accepting === quote.id ? 'Zapisuję...' : 'Akceptuję'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Accepted quotes confirmation */}
      {acceptedIds.size > 0 && (
        <div style={{
          padding: '16px 20px',
          background: t.semantic.successBg,
          border: `1px solid ${t.semantic.successBorder}`,
          borderRadius: t.radius.md,
          color: t.semantic.success,
          fontSize: 14,
        }}>
          Wycena zaakceptowana. Skontaktujemy się z Tobą w ciągu 24h.
        </div>
      )}

      {/* Stack deployments */}
      <section>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px', color: t.text.primary }}>
          Stack wdrożeń
        </h2>

        {stack.length === 0 ? (
          <div style={{
            padding: 32, textAlign: 'center',
            background: t.bg.card,
            border: `1px solid ${t.border.default}`,
            borderRadius: t.radius.md,
            color: t.text.muted, fontSize: 14,
          }}>
            Brak wdrożeń w systemie. Skontaktuj się z 77STF aby rozpocząć.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {stack.map(item => {
              const statusStyle = STACK_STATUS_COLOR[item.status] ?? STACK_STATUS_COLOR.idea
              return (
                <div key={item.id} style={{
                  padding: '16px 20px',
                  background: t.bg.card,
                  border: `1px solid ${t.border.default}`,
                  borderRadius: t.radius.md,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 12,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 20 }}>{CATEGORY_ICON[item.category] ?? '⚙️'}</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: t.text.primary }}>{item.name}</div>
                      {item.description && (
                        <div style={{ fontSize: 12, color: t.text.muted, marginTop: 2 }}>{item.description}</div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {item.monthly_value_pln != null && item.monthly_value_pln > 0 && (
                      <span style={{ fontSize: 13, color: t.text.muted }}>
                        {formatPLN(item.monthly_value_pln)}/mies.
                      </span>
                    )}
                    <span style={{
                      fontSize: 11, fontWeight: 700,
                      padding: '3px 10px',
                      borderRadius: t.radius.full,
                      color: statusStyle.color,
                      background: statusStyle.bg,
                      border: `1px solid ${statusStyle.border}`,
                    }}>
                      {STACK_STATUS_LABEL[item.status] ?? item.status}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Audit summary */}
      {audit && audit.status === 'completed' && (
        <section>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px', color: t.text.primary }}>
            Wynik Audytu Cyfrowego
          </h2>
          <div style={{
            padding: '24px',
            background: t.bg.card,
            border: `1px solid ${t.border.default}`,
            borderRadius: t.radius.md,
            display: 'flex',
            gap: 24,
            flexWrap: 'wrap',
            alignItems: 'flex-start',
          }}>
            {audit.score != null && (
              <div style={{ textAlign: 'center', minWidth: 80 }}>
                <div style={{
                  width: 72, height: 72,
                  borderRadius: '50%',
                  background: audit.score >= 70
                    ? 'rgba(74,222,128,0.1)' : audit.score >= 40
                    ? 'rgba(251,191,36,0.1)' : 'rgba(248,113,113,0.1)',
                  border: `2px solid ${audit.score >= 70 ? t.semantic.success : audit.score >= 40 ? t.semantic.warning : t.semantic.error}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, fontWeight: 800,
                  color: audit.score >= 70 ? t.semantic.success : audit.score >= 40 ? t.semantic.warning : t.semantic.error,
                  margin: '0 auto 8px',
                }}>
                  {audit.score}
                </div>
                <div style={{ fontSize: 11, color: t.text.muted }}>wynik</div>
              </div>
            )}
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: t.text.primary, marginBottom: 8 }}>
                {audit.title}
              </div>
              {audit.ai_summary && (
                <p style={{ fontSize: 13, color: t.text.secondary, lineHeight: 1.7, margin: 0 }}>
                  {audit.ai_summary.slice(0, 300)}{audit.ai_summary.length > 300 ? '...' : ''}
                </p>
              )}
              {audit.completed_at && (
                <div style={{ fontSize: 11, color: t.text.muted, marginTop: 8 }}>
                  Audyt przeprowadzony: {new Date(audit.completed_at).toLocaleDateString('pl-PL')}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* All quotes history */}
      {quotes.length > 0 && (
        <section>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px', color: t.text.primary }}>
            Historia Wycen
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {quotes.map(quote => {
              const isAccepted = quote.status === 'accepted' || acceptedIds.has(quote.id)
              return (
                <div key={quote.id} style={{
                  padding: '14px 20px',
                  background: t.bg.card,
                  border: `1px solid ${t.border.subtle}`,
                  borderRadius: t.radius.md,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 8,
                }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: t.text.primary }}>{quote.title}</div>
                    <div style={{ fontSize: 12, color: t.text.muted, marginTop: 2 }}>
                      {formatPLN(quote.setup_fee)} setup
                      {quote.monthly_fee > 0 && ` · ${formatPLN(quote.monthly_fee)}/mies.`}
                      {' · '}{new Date(quote.updated_at).toLocaleDateString('pl-PL')}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 600,
                    padding: '3px 10px',
                    borderRadius: t.radius.full,
                    ...(isAccepted
                      ? { color: t.semantic.success, background: t.semantic.successBg, border: `1px solid ${t.semantic.successBorder}` }
                      : quote.status === 'rejected'
                      ? { color: t.semantic.error, background: t.semantic.errorBg, border: `1px solid ${t.semantic.errorBorder}` }
                      : { color: t.text.muted, background: t.bg.muted, border: `1px solid ${t.border.subtle}` }
                    ),
                  }}>
                    {isAccepted ? 'Zaakceptowana' : QUOTE_STATUS_LABEL[quote.status] ?? quote.status}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Footer note */}
      <div style={{
        padding: '16px 20px',
        borderTop: `1px solid ${t.border.subtle}`,
        color: t.text.muted, fontSize: 12,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: 8,
      }}>
        <span>Twój portal wdrożeń AI · 77STF</span>
        <a href="mailto:kontakt@77stf.pl" style={{ color: t.text.muted, textDecoration: 'none' }}>
          kontakt@77stf.pl
        </a>
      </div>

    </div>
  )
}
