'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  FileText,
  CheckCircle2,
  Clock,
  Pencil,
  Trash2,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react'
import { t } from '@/lib/tokens'
import { formatPLN, formatDate, relativeTime } from '@/lib/format'
import { Quote, QuoteStatus } from '@/lib/types'
import { NewQuoteModal } from './new-quote-modal'

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  QuoteStatus,
  { label: string; color: string; bg: string; border: string }
> = {
  draft: {
    label: 'Szkic',
    color: t.text.muted,
    bg: t.bg.muted,
    border: t.border.subtle,
  },
  sent: {
    label: 'Wysłana',
    color: t.semantic.info,
    bg: t.semantic.infoBg,
    border: t.semantic.infoBorder,
  },
  accepted: {
    label: 'Zaakceptowana',
    color: t.semantic.success,
    bg: t.semantic.successBg,
    border: t.semantic.successBorder,
  },
  rejected: {
    label: 'Odrzucona',
    color: t.semantic.error,
    bg: t.semantic.errorBg,
    border: t.semantic.errorBorder,
  },
  expired: {
    label: 'Wygasla',
    color: t.semantic.warning,
    bg: t.semantic.warningBg,
    border: t.semantic.warningBorder,
  },
}

// ─── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: number | string
  sub: string
  icon: React.ReactNode
  index: number
  highlight?: boolean
}

function StatCard({ label, value, sub, icon, index, highlight }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06 }}
      style={{
        borderRadius: t.radius.lg,
        padding: '20px 22px',
        backgroundColor: t.bg.card,
        border: `1px solid ${highlight ? t.semantic.successBorder : t.border.default}`,
        boxShadow: t.shadow.card,
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.14em',
            color: t.text.muted,
          }}
        >
          {label}
        </span>
        <span style={{ color: highlight ? t.semantic.success : t.text.muted, opacity: 0.75 }}>
          {icon}
        </span>
      </div>
      <span
        style={{
          fontSize: 36,
          fontWeight: 300,
          letterSpacing: '-0.04em',
          lineHeight: 1,
          color: highlight ? t.semantic.success : t.text.primary,
          display: 'block',
          marginBottom: 12,
        }}
      >
        {value}
      </span>
      <span style={{ fontSize: 11, color: t.text.muted }}>{sub}</span>
    </motion.div>
  )
}

// ─── Delete confirm ───────────────────────────────────────────────────────────

interface DeleteConfirmProps {
  quoteTitle: string
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}

function DeleteConfirm({ quoteTitle, onConfirm, onCancel, loading }: DeleteConfirmProps) {
  return (
    <>
      <div
        onClick={onCancel}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.60)',
          backdropFilter: 'blur(4px)',
          zIndex: 300,
        }}
      />
      <div
        role="alertdialog"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 301,
          width: 420,
          backgroundColor: t.bg.cardSolid,
          border: `1px solid ${t.semantic.errorBorder}`,
          borderRadius: t.radius.lg,
          boxShadow: t.shadow.cardLg,
          padding: '24px',
        }}
      >
        <div style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: t.radius.md,
              backgroundColor: t.semantic.errorBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <AlertTriangle style={{ width: 18, height: 18, color: t.semantic.error }} />
          </div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 600, color: t.text.primary, margin: '0 0 6px' }}>
              Usunac wycene?
            </p>
            <p style={{ fontSize: 13, color: t.text.muted, margin: 0, lineHeight: 1.5 }}>
              <strong style={{ color: t.text.secondary }}>{quoteTitle}</strong> zostanie trwale
              usunieta. Tej operacji nie mozna cofnac.
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            style={{
              padding: '8px 18px',
              borderRadius: t.radius.sm,
              border: `1px solid ${t.border.default}`,
              backgroundColor: 'transparent',
              color: t.text.secondary,
              fontSize: 13,
              fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            Anuluj
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            style={{
              padding: '8px 18px',
              borderRadius: t.radius.sm,
              border: `1px solid ${t.semantic.errorBorder}`,
              backgroundColor: t.semantic.errorBg,
              color: t.semantic.error,
              fontSize: 13,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Usuwanie...' : 'Usun'}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Status change dropdown ───────────────────────────────────────────────────

interface StatusDropdownProps {
  quote: Quote
  onStatusChange: (id: string, status: QuoteStatus) => Promise<void>
}

function StatusBadge({ quote, onStatusChange }: StatusDropdownProps) {
  const [open, setOpen] = useState(false)
  const cfg = STATUS_CONFIG[quote.status]

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '3px 10px',
          borderRadius: t.radius.full,
          fontSize: 11,
          fontWeight: 500,
          color: cfg.color,
          backgroundColor: cfg.bg,
          border: `1px solid ${cfg.border}`,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        {cfg.label}
        <ChevronRight style={{ width: 10, height: 10, transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 150ms' }} />
      </button>

      {open && (
        <>
          <div
            onClick={(e) => {
              e.stopPropagation()
              setOpen(false)
            }}
            style={{ position: 'fixed', inset: 0, zIndex: 50 }}
          />
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: 4,
              backgroundColor: t.bg.cardSolid,
              border: `1px solid ${t.border.default}`,
              borderRadius: t.radius.sm,
              boxShadow: t.shadow.cardMd,
              zIndex: 51,
              overflow: 'hidden',
              minWidth: 150,
            }}
          >
            {(Object.keys(STATUS_CONFIG) as QuoteStatus[]).map((s) => {
              const c = STATUS_CONFIG[s]
              return (
                <button
                  key={s}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setOpen(false)
                    if (s !== quote.status) onStatusChange(quote.id, s)
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    padding: '8px 12px',
                    background: s === quote.status ? t.bg.overlay : 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    borderBottom: `1px solid ${t.border.subtle}`,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = t.bg.cardHover
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                      s === quote.status ? t.bg.overlay : 'transparent'
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      backgroundColor: c.color,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: 13, color: t.text.primary }}>{c.label}</span>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [tableMissing, setTableMissing] = useState(false)

  const [modalOpen, setModalOpen] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<Quote | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // ── Fetch quotes ──────────────────────────────────────────────────────────
  const fetchQuotes = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const res = await fetch('/api/quotes')
      const json = await res.json()
      if (json.table_missing) {
        setTableMissing(true)
        setQuotes([])
      } else if (!res.ok) {
        setFetchError(json.error ?? 'Nieznany błąd')
      } else {
        setQuotes(json.quotes ?? [])
      }
    } catch {
      setFetchError('Błąd połączenia z serwerem.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchQuotes()
  }, [fetchQuotes])

  // ── Status change ─────────────────────────────────────────────────────────
  const handleStatusChange = async (id: string, status: QuoteStatus) => {
    // Optimistic update
    setQuotes((prev) =>
      prev.map((q) => (q.id === id ? { ...q, status } : q))
    )
    try {
      const res = await fetch(`/api/quotes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        // Rollback on failure
        fetchQuotes()
      }
    } catch {
      fetchQuotes()
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/quotes/${deleteTarget.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json()
        setDeleteError(json.error ?? 'Nie udało się usunąć wyceny.')
        setDeleteLoading(false)
        return
      }
      setQuotes((prev) => prev.filter((q) => q.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch {
      setDeleteError('Błąd połączenia z serwerem.')
    } finally {
      setDeleteLoading(false)
    }
  }

  // ── Optimistic prepend on create ──────────────────────────────────────────
  const handleQuoteCreated = (quote: Quote) => {
    setQuotes((prev) => [quote, ...prev])
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalCount = quotes.length
  const acceptedCount = quotes.filter((q) => q.status === 'accepted').length
  const inProgressCount = quotes.filter((q) => q.status === 'sent' || q.status === 'draft').length
  const acceptedValue = quotes
    .filter((q) => q.status === 'accepted')
    .reduce((sum, q) => sum + q.setup_fee + q.monthly_fee, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* ── Page header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 600,
              color: t.text.primary,
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            Wyceny
          </h1>
          <p style={{ fontSize: 14, color: t.text.muted, margin: '6px 0 0' }}>
            Oferty i wyceny dla klientów
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            padding: '9px 18px',
            borderRadius: t.radius.sm,
            background: t.brand.gradient,
            border: 'none',
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: t.shadow.btn,
            whiteSpace: 'nowrap',
          }}
        >
          <Plus style={{ width: 15, height: 15 }} />
          Nowa wycena
        </button>
      </div>

      {/* ── Stats row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        <StatCard
          label="Wszystkie wyceny"
          value={totalCount}
          sub="łącznie w systemie"
          icon={<FileText style={{ width: 14, height: 14 }} />}
          index={0}
        />
        <StatCard
          label="Zaakceptowane"
          value={acceptedCount}
          sub={acceptedValue > 0 ? `Łączna wartość: ${formatPLN(acceptedValue)}` : 'brak zaakceptowanych'}
          icon={<CheckCircle2 style={{ width: 14, height: 14 }} />}
          index={1}
          highlight={acceptedCount > 0}
        />
        <StatCard
          label="W trakcie"
          value={inProgressCount}
          sub="szkice i wysłane"
          icon={<Clock style={{ width: 14, height: 14 }} />}
          index={2}
        />
      </div>

      {/* ── Table / states ── */}
      {loading ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '80px 0',
            gap: 12,
            color: t.text.muted,
            fontSize: 14,
          }}
        >
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: '50%',
              border: `2px solid ${t.border.default}`,
              borderTopColor: t.text.secondary,
              animation: 'spin 0.8s linear infinite',
              flexShrink: 0,
            }}
          />
          Ładowanie wycen...
        </div>
      ) : tableMissing ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '80px 0',
            gap: 14,
            borderRadius: t.radius.lg,
            backgroundColor: t.bg.card,
            border: `1px solid ${t.semantic.warningBorder}`,
          }}
        >
          <AlertTriangle style={{ width: 40, height: 40, color: t.semantic.warning, opacity: 0.7 }} />
          <span style={{ fontSize: 16, fontWeight: 600, color: t.text.primary }}>
            Tabela wycen nie istnieje
          </span>
          <p style={{ fontSize: 13, color: t.text.muted, textAlign: 'center', maxWidth: 400, margin: 0, lineHeight: 1.6 }}>
            Uruchom migrację SQL, aby utworzyć tabele{' '}
            <code
              style={{
                fontFamily: 'monospace',
                fontSize: 12,
                padding: '1px 6px',
                backgroundColor: t.bg.muted,
                borderRadius: t.radius.xs,
                color: t.text.secondary,
              }}
            >
              quotes
            </code>{' '}
            i{' '}
            <code
              style={{
                fontFamily: 'monospace',
                fontSize: 12,
                padding: '1px 6px',
                backgroundColor: t.bg.muted,
                borderRadius: t.radius.xs,
                color: t.text.secondary,
              }}
            >
              quote_items
            </code>{' '}
            w Supabase.
          </p>
          <span style={{ fontSize: 12, color: t.text.placeholder }}>
            Uruchom migrację SQL w panelu Supabase
          </span>
        </div>
      ) : fetchError ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '60px 0',
            gap: 12,
            borderRadius: t.radius.lg,
            backgroundColor: t.semantic.errorBg,
            border: `1px solid ${t.semantic.errorBorder}`,
          }}
        >
          <AlertTriangle style={{ width: 32, height: 32, color: t.semantic.error }} />
          <span style={{ fontSize: 14, color: t.semantic.error }}>{fetchError}</span>
          <button
            onClick={fetchQuotes}
            style={{
              padding: '7px 16px',
              borderRadius: t.radius.sm,
              border: `1px solid ${t.semantic.errorBorder}`,
              backgroundColor: 'transparent',
              color: t.semantic.error,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Spróbuj ponownie
          </button>
        </div>
      ) : quotes.length === 0 ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '80px 0',
            gap: 14,
            borderRadius: t.radius.lg,
            backgroundColor: t.bg.card,
            border: `1px solid ${t.border.subtle}`,
          }}
        >
          <FileText style={{ width: 44, height: 44, color: t.text.placeholder }} />
          <span style={{ fontSize: 16, fontWeight: 600, color: t.text.primary }}>
            Brak wycen
          </span>
          <span style={{ fontSize: 14, color: t.text.muted }}>
            Kliknij &ldquo;Nowa wycena&rdquo; żeby stworzyć pierwszą ofertę
          </span>
          <button
            onClick={() => setModalOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '9px 18px',
              borderRadius: t.radius.sm,
              background: t.brand.gradient,
              border: 'none',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: t.shadow.btn,
              marginTop: 4,
            }}
          >
            <Plus style={{ width: 15, height: 15 }} />
            Nowa wycena
          </button>
        </div>
      ) : (
        /* ── Quotes table ── */
        <div
          style={{
            borderRadius: t.radius.lg,
            backgroundColor: t.bg.card,
            border: `1px solid ${t.border.default}`,
            boxShadow: t.shadow.card,
            overflow: 'hidden',
          }}
        >
          {/* Table header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 100px 140px 140px 80px',
              gap: 12,
              padding: '10px 20px',
              backgroundColor: t.bg.muted,
              borderBottom: `1px solid ${t.border.default}`,
            }}
          >
            {['Klient / Tytuł', 'Status', 'Rabat', 'Wdrożenie', 'Miesięcznie', ''].map((col) => (
              <span
                key={col}
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: t.text.placeholder,
                }}
              >
                {col}
              </span>
            ))}
          </div>

          {/* Rows */}
          <AnimatePresence initial={false}>
            {quotes.map((quote, index) => (
              <motion.div
                key={quote.id}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                transition={{ duration: 0.22, delay: index === 0 ? 0 : 0 }}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 100px 140px 140px 80px',
                  gap: 12,
                  padding: '14px 20px',
                  alignItems: 'center',
                  borderBottom: `1px solid ${t.border.subtle}`,
                  transition: 'background-color 120ms',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.backgroundColor = t.bg.cardHover
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent'
                }}
              >
                {/* Client + Title */}
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    {quote.client?.name && (
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: t.text.primary,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {quote.client.name}
                      </span>
                    )}
                    {quote.client?.industry && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 500,
                          color: t.text.muted,
                          padding: '2px 7px',
                          borderRadius: t.radius.full,
                          backgroundColor: t.bg.muted,
                          border: `1px solid ${t.border.subtle}`,
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                        }}
                      >
                        {quote.client.industry}
                      </span>
                    )}
                  </div>
                  <p
                    style={{
                      fontSize: 12,
                      color: t.text.secondary,
                      margin: 0,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {quote.title}
                  </p>
                </div>

                {/* Status badge (clickable) */}
                <div>
                  <StatusBadge quote={quote} onStatusChange={handleStatusChange} />
                  <div style={{ fontSize: 10, color: t.text.placeholder, marginTop: 4 }}>
                    {relativeTime(quote.created_at)}
                  </div>
                </div>

                {/* Discount */}
                <span
                  style={{
                    fontSize: 13,
                    color: quote.discount_pct > 0 ? t.semantic.warning : t.text.muted,
                  }}
                >
                  {quote.discount_pct > 0 ? `-${quote.discount_pct}%` : '—'}
                </span>

                {/* Setup fee */}
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: t.text.primary }}>
                    {formatPLN(quote.setup_fee)}
                  </span>
                  {quote.valid_until && (
                    <div style={{ fontSize: 10, color: t.text.placeholder, marginTop: 2 }}>
                      do {formatDate(quote.valid_until)}
                    </div>
                  )}
                </div>

                {/* Monthly fee */}
                <span style={{ fontSize: 13, fontWeight: 600, color: t.text.primary }}>
                  {quote.monthly_fee > 0 ? (
                    <>
                      {formatPLN(quote.monthly_fee)}
                      <span style={{ fontSize: 11, fontWeight: 400, color: t.text.muted }}>/mc</span>
                    </>
                  ) : (
                    <span style={{ color: t.text.muted }}>—</span>
                  )}
                </span>

                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button
                    type="button"
                    aria-label="Edytuj wycenę"
                    title="Edytuj"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 30,
                      height: 30,
                      borderRadius: t.radius.xs,
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: t.text.muted,
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor = t.bg.overlay
                      ;(e.currentTarget as HTMLButtonElement).style.color = t.text.primary
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'
                      ;(e.currentTarget as HTMLButtonElement).style.color = t.text.muted
                    }}
                  >
                    <Pencil style={{ width: 14, height: 14 }} />
                  </button>
                  <button
                    type="button"
                    aria-label="Usuń wycenę"
                    title="Usuń"
                    onClick={() => {
                      setDeleteError(null)
                      setDeleteTarget(quote)
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 30,
                      height: 30,
                      borderRadius: t.radius.xs,
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: t.text.muted,
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor = t.semantic.errorBg
                      ;(e.currentTarget as HTMLButtonElement).style.color = t.semantic.error
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'
                      ;(e.currentTarget as HTMLButtonElement).style.color = t.text.muted
                    }}
                  >
                    <Trash2 style={{ width: 14, height: 14 }} />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Table footer: count */}
          <div
            style={{
              padding: '10px 20px',
              borderTop: `1px solid ${t.border.subtle}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
            }}
          >
            <span style={{ fontSize: 12, color: t.text.placeholder }}>
              {quotes.length} {quotes.length === 1 ? 'wycena' : quotes.length < 5 ? 'wyceny' : 'wycen'} łącznie
            </span>
          </div>
        </div>
      )}

      {/* Delete error (outside dialog, rare) */}
      {deleteError && !deleteTarget && (
        <div
          style={{
            padding: '10px 14px',
            backgroundColor: t.semantic.errorBg,
            border: `1px solid ${t.semantic.errorBorder}`,
            borderRadius: t.radius.sm,
            fontSize: 13,
            color: t.semantic.error,
          }}
        >
          {deleteError}
        </div>
      )}

      {/* ── Modals ── */}
      <NewQuoteModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={handleQuoteCreated}
      />

      {deleteTarget && (
        <DeleteConfirm
          quoteTitle={deleteTarget.title}
          onConfirm={handleDeleteConfirm}
          onCancel={() => {
            setDeleteTarget(null)
            setDeleteError(null)
          }}
          loading={deleteLoading}
        />
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
