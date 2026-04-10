'use client'

import { useState, useEffect, useCallback } from 'react'
import { AlertCircle, Trash2, RefreshCw, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react'
import { t } from '@/lib/tokens'
import { relativeTime } from '@/lib/format'

interface ErrorEntry {
  id: string
  source: string
  message: string
  metadata: Record<string, unknown> | null
  created_at: string
}

function SourceBadge({ source }: { source: string }) {
  const isAI = source.includes('meeting-prep') || source.includes('ingest') || source.includes('analyze')
  const color = isAI ? t.semantic.warning : t.semantic.error
  const bg = isAI ? t.semantic.warningBg : t.semantic.errorBg
  const border = isAI ? t.semantic.warningBorder : t.semantic.errorBorder
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '2px 8px',
      borderRadius: t.radius.full, color, background: bg,
      border: `1px solid ${border}`,
      whiteSpace: 'nowrap' as const,
    }}>
      {source}
    </span>
  )
}

function ErrorRow({ entry }: { entry: ErrorEntry }) {
  const [open, setOpen] = useState(false)
  const hasMetadata = entry.metadata && Object.keys(entry.metadata).length > 0

  return (
    <div style={{
      borderBottom: `1px solid ${t.border.subtle}`,
      padding: '14px 20px',
    }}>
      <div
        style={{
          display: 'flex', alignItems: 'flex-start', gap: 12,
          cursor: hasMetadata ? 'pointer' : 'default',
        }}
        onClick={() => hasMetadata && setOpen(o => !o)}
      >
        <AlertCircle style={{ width: 14, height: 14, color: t.semantic.error, marginTop: 2, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' as const }}>
            <SourceBadge source={entry.source} />
            <span style={{ fontSize: 11, color: t.text.muted }}>{relativeTime(entry.created_at)}</span>
          </div>
          <div style={{
            fontFamily: 'monospace', fontSize: 12,
            color: t.text.secondary, wordBreak: 'break-all' as const,
            lineHeight: 1.5,
          }}>
            {entry.message}
          </div>
        </div>
        {hasMetadata && (
          <div style={{ color: t.text.muted, flexShrink: 0 }}>
            {open
              ? <ChevronDown style={{ width: 14, height: 14 }} />
              : <ChevronRight style={{ width: 14, height: 14 }} />
            }
          </div>
        )}
      </div>

      {open && hasMetadata && (
        <div style={{
          marginTop: 10, marginLeft: 26,
          background: 'rgba(0,0,0,0.25)',
          border: `1px solid ${t.border.subtle}`,
          borderRadius: t.radius.sm,
          padding: '10px 14px',
          fontFamily: 'monospace', fontSize: 11,
          color: t.text.muted, whiteSpace: 'pre-wrap' as const,
        }}>
          {JSON.stringify(entry.metadata, null, 2)}
        </div>
      )}
    </div>
  )
}

type TimeRange = '24h' | '7d' | '30d' | 'all'

const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  '24h': 'Ostatnie 24h',
  '7d': 'Ostatnie 7 dni',
  '30d': 'Ostatnie 30 dni',
  'all': 'Wszystkie',
}

export default function ErrorsPage() {
  const [errors, setErrors] = useState<ErrorEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [clearing, setClearing] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [timeRange, setTimeRange] = useState<TimeRange>('24h')

  const copyAll = () => {
    const text = errors.map(e =>
      `[${e.created_at}] ${e.source}\n${e.message}${e.metadata ? '\n' + JSON.stringify(e.metadata, null, 2) : ''}`
    ).join('\n\n---\n\n')
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const fetchErrors = useCallback(async (range: TimeRange) => {
    setLoading(true)
    setFetchError(null)
    try {
      const res = await fetch(`/api/errors?since=${range}&limit=100`)
      const data = await res.json() as { errors?: ErrorEntry[]; error?: string }
      if (!res.ok || data.error) {
        setFetchError(data.error ?? `HTTP ${res.status}`)
        setErrors([])
      } else {
        setErrors(data.errors ?? [])
      }
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : 'Błąd połączenia')
      setErrors([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchErrors(timeRange) }, [timeRange, fetchErrors])

  const clearAll = async () => {
    if (!confirm('Usunąć wszystkie logi błędów?')) return
    setClearing(true)
    await fetch('/api/errors', { method: 'DELETE' })
    setErrors([])
    setClearing(false)
  }

  const handleRangeChange = (range: TimeRange) => {
    setTimeRange(range)
  }

  return (
    <div style={{ padding: '32px 28px', maxWidth: 900 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: t.text.primary, margin: 0 }}>
            Logi błędów
          </h1>
          <p style={{ fontSize: 13, color: t.text.muted, margin: '4px 0 0' }}>
            {TIME_RANGE_LABELS[timeRange]} — {errors.length} wpisów
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => fetchErrors(timeRange)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: t.bg.overlay, color: t.text.secondary,
              border: `1px solid ${t.border.default}`,
              borderRadius: t.radius.sm, padding: '8px 14px',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <RefreshCw style={{ width: 13, height: 13 }} />
            Odśwież
          </button>
          {errors.length > 0 && (
            <button
              onClick={copyAll}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: t.bg.overlay, color: copied ? t.semantic.success : t.text.secondary,
                border: `1px solid ${copied ? t.semantic.successBorder ?? t.border.default : t.border.default}`,
                borderRadius: t.radius.sm, padding: '8px 14px',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                transition: 'color 200ms, border-color 200ms',
              }}
            >
              {copied ? <Check style={{ width: 13, height: 13 }} /> : <Copy style={{ width: 13, height: 13 }} />}
              {copied ? 'Skopiowano' : 'Kopiuj wszystkie'}
            </button>
          )}
          {errors.length > 0 && (
            <button
              onClick={clearAll}
              disabled={clearing}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: t.semantic.errorBg, color: t.semantic.error,
                border: `1px solid ${t.semantic.errorBorder}`,
                borderRadius: t.radius.sm, padding: '8px 14px',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                opacity: clearing ? 0.6 : 1,
              }}
            >
              <Trash2 style={{ width: 13, height: 13 }} />
              Wyczyść
            </button>
          )}
        </div>
      </div>

      {/* Time range filter */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {(Object.keys(TIME_RANGE_LABELS) as TimeRange[]).map(range => (
          <button
            key={range}
            onClick={() => handleRangeChange(range)}
            style={{
              padding: '6px 14px', borderRadius: t.radius.sm,
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: `1px solid ${timeRange === range ? 'rgba(129,140,248,0.4)' : t.border.subtle}`,
              background: timeRange === range ? 'rgba(129,140,248,0.12)' : 'transparent',
              color: timeRange === range ? '#818CF8' : t.text.muted,
              transition: 'all 150ms',
            }}
          >
            {TIME_RANGE_LABELS[range]}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{
        background: t.bg.card,
        border: `1px solid ${t.border.default}`,
        borderRadius: t.radius.md,
        overflow: 'hidden',
      }}>
        {loading && (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: t.text.muted, fontSize: 13 }}>
            Ładowanie...
          </div>
        )}

        {/* API itself failed — most likely error_log table missing */}
        {!loading && fetchError && (
          <div style={{ padding: '28px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <AlertCircle style={{ width: 16, height: 16, color: t.semantic.error }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: t.semantic.error }}>
                Błąd ładowania logów
              </span>
            </div>
            <div style={{
              fontFamily: 'monospace', fontSize: 12, color: t.text.secondary,
              background: 'rgba(0,0,0,0.3)', padding: '10px 14px',
              borderRadius: t.radius.sm, marginBottom: 14,
              border: `1px solid ${t.border.subtle}`,
            }}>
              {fetchError}
            </div>
            <div style={{ fontSize: 13, color: t.text.muted }}>
              Jeśli błąd zawiera &quot;does not exist&quot; — uruchom migrację{' '}
              <code style={{ fontFamily: 'monospace', fontSize: 12, color: t.semantic.warning }}>
                scripts/migrations/003_error_log.sql
              </code>{' '}
              w Supabase SQL Editor.
            </div>
          </div>
        )}

        {!loading && !fetchError && errors.length === 0 && (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <AlertCircle style={{ width: 32, height: 32, color: t.semantic.success, margin: '0 auto 12px' }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: t.text.secondary, marginBottom: 4 }}>
              Brak błędów
            </div>
            <div style={{ fontSize: 13, color: t.text.muted }}>System działa poprawnie.</div>
          </div>
        )}

        {!loading && !fetchError && errors.map(entry => (
          <ErrorRow key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  )
}
