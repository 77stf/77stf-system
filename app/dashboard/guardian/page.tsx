'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Shield, RefreshCw, AlertTriangle, AlertCircle, CheckCircle, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'
import { t } from '@/lib/tokens'
import { relativeTime } from '@/lib/format'

// ─── Types ────────────────────────────────────────────────────────────────────

type AlertSeverity = 'critical' | 'warning' | 'info'

interface GuardianAlert {
  type: string
  severity: AlertSeverity
  action_type: string
  client_id?: string
  client_name?: string
  title: string
  detail: string
  action: string
  action_link?: string
  recommend_prompt?: string
  days_overdue?: number
}

interface Report {
  id: string
  generated_at: string
  summary: string
  alert_count: number
  critical: number
  warnings: number
  trigger: string
  alerts: GuardianAlert[]
}

interface RecommendStep { step: string; detail: string }
interface RecommendResult { title: string; steps: RecommendStep[]; why: string }

// ─── Severity config ──────────────────────────────────────────────────────────

const SEV: Record<AlertSeverity, { color: string; bg: string; border: string; Icon: React.ElementType; label: string }> = {
  critical: { color: t.semantic.error,   bg: t.semantic.errorBg,   border: t.semantic.errorBorder,   Icon: AlertCircle,   label: 'Pilne'  },
  warning:  { color: t.semantic.warning, bg: t.semantic.warningBg, border: t.semantic.warningBorder, Icon: AlertTriangle, label: 'Uwaga'  },
  info:     { color: t.text.muted,       bg: t.bg.muted,           border: t.border.subtle,          Icon: Shield,        label: 'Info'   },
}

const TYPE_ICONS: Record<string, string> = {
  client_inactivity: '👤',
  quote_no_response: '📄',
  lead_no_followup:  '🎯',
  ai_budget_alert:   '💰',
  stack_error:       '⚡',
}

// ─── Recommendation panel — structured steps ──────────────────────────────────

function RecommendPanel({ result }: { result: RecommendResult }) {
  return (
    <div style={{ borderTop: `1px solid rgba(129,140,248,0.20)`, padding: '16px 18px', background: 'rgba(129,140,248,0.035)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#818CF8' }}>
          Plan działania
        </span>
        <span style={{ fontSize: 12, color: t.text.secondary, fontWeight: 500 }}>— {result.title}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: result.why ? 14 : 0 }}>
        {result.steps.map((s, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{
              width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
              background: 'rgba(129,140,248,0.15)', border: '1px solid rgba(129,140,248,0.30)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 700, color: '#818CF8',
            }}>
              {i + 1}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.text.primary, lineHeight: 1.4 }}>{s.step}</div>
              {s.detail && (
                <div style={{ fontSize: 12, color: t.text.muted, marginTop: 2, lineHeight: 1.5 }}>{s.detail}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {result.why && (
        <div style={{
          marginTop: 4, padding: '10px 14px',
          background: 'rgba(129,140,248,0.06)', border: '1px solid rgba(129,140,248,0.18)',
          borderRadius: t.radius.sm, fontSize: 12, color: t.text.secondary, lineHeight: 1.6,
        }}>
          <span style={{ fontWeight: 700, color: '#818CF8' }}>Dlaczego ważne: </span>
          {result.why}
        </div>
      )}
    </div>
  )
}

// ─── Alert card ───────────────────────────────────────────────────────────────

function AlertCard({ alert }: { alert: GuardianAlert }) {
  const sev = SEV[alert.severity]
  const { Icon } = sev
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<RecommendResult | null>(null)
  const [open, setOpen] = useState(false)

  async function loadRecommendation() {
    if (result) { setOpen(o => !o); return }
    setLoading(true)
    try {
      const res = await fetch('/api/guardian/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: alert.recommend_prompt, alert_type: alert.type }),
      })
      const data = await res.json() as RecommendResult
      setResult(data)
      setOpen(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ background: sev.bg, border: `1px solid ${sev.border}`, borderRadius: t.radius.md, overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <Icon size={15} style={{ color: sev.color, flexShrink: 0, marginTop: 2 }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Title row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: t.text.primary }}>
              {TYPE_ICONS[alert.type] ?? '•'} {alert.title}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
              padding: '1px 7px', borderRadius: t.radius.full,
              color: sev.color, border: `1px solid ${sev.border}`, background: 'transparent',
            }}>{sev.label}</span>
          </div>

          {/* Detail */}
          <p style={{ margin: '0 0 10px', fontSize: 12, color: t.text.secondary, lineHeight: 1.6 }}>
            {alert.detail}
          </p>

          {/* Next step */}
          <div style={{ fontSize: 12, fontWeight: 600, color: sev.color, marginBottom: 10 }}>
            → {alert.action}
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {alert.action_link && (
              <a
                href={alert.action_link}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  fontSize: 12, fontWeight: 600,
                  padding: '5px 12px', borderRadius: t.radius.sm,
                  background: 'rgba(255,255,255,0.06)', border: `1px solid ${t.border.default}`,
                  color: t.text.primary, textDecoration: 'none',
                }}
              >
                {alert.action_type === 'crm' ? 'Otwórz profil' : 'Przejdź'}
                <ExternalLink size={10} />
              </a>
            )}
            {alert.recommend_prompt && (
              <button
                onClick={loadRecommendation}
                disabled={loading}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  fontSize: 12, fontWeight: 600,
                  padding: '5px 12px', borderRadius: t.radius.sm,
                  background: open ? 'rgba(129,140,248,0.14)' : 'rgba(129,140,248,0.07)',
                  border: `1px solid ${open ? 'rgba(129,140,248,0.38)' : 'rgba(129,140,248,0.20)'}`,
                  color: '#818CF8', cursor: loading ? 'wait' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? 'Ładuję...' : open ? 'Ukryj plan' : 'Jak rozwiązać?'}
                {!loading && (open ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
              </button>
            )}
          </div>
        </div>
      </div>

      {open && result && <RecommendPanel result={result} />}
    </div>
  )
}

// ─── Monitoring rules ─────────────────────────────────────────────────────────

const RULES = [
  { icon: '👤', label: 'Klienci bez kontaktu > 30 dni' },
  { icon: '📄', label: 'Wyceny bez odpowiedzi > 7 dni' },
  { icon: '🎯', label: 'Leady bez zadania > 48h' },
  { icon: '💰', label: 'Koszty AI > 80% budżetu' },
  { icon: '⚡', label: 'Wdrożenia w błędzie > 24h' },
]

// ─── Main page ────────────────────────────────────────────────────────────────

const AUTO_SCAN_THRESHOLD_MS = 60 * 60 * 1000 // 1h — auto-scan if last report older than this
const REFRESH_INTERVAL_MS    = 10 * 60 * 1000  // refresh reports list every 10 min

export default function GuardianPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const autoScanned = useRef(false)

  // Fetch saved reports
  const fetchReports = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    try {
      const res = await fetch('/api/guardian')
      if (res.ok) {
        const { reports: data } = await res.json() as { reports: Report[] }
        setReports(data)
        setLastRefresh(new Date())
        return data as Report[]
      }
    } finally {
      if (!quiet) setLoading(false)
    }
    return []
  }, [])

  // Run a scan and prepend result
  const runScan = useCallback(async () => {
    setScanning(true)
    try {
      const res = await fetch('/api/guardian/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger: 'auto' }),
      })
      if (res.ok) {
        const data = await res.json() as Report
        setReports(prev => [data, ...prev.filter(r => r.id !== data.id)])
        setExpandedId(data.id) // auto-expand latest
      }
    } finally {
      setScanning(false)
    }
  }, [])

  // On mount: load reports, auto-scan if stale
  useEffect(() => {
    void fetchReports().then(data => {
      if (autoScanned.current) return
      autoScanned.current = true
      const latest = data[0]
      if (!latest) { void runScan(); return }
      const age = Date.now() - new Date(latest.generated_at).getTime()
      if (age > AUTO_SCAN_THRESHOLD_MS) void runScan()
      else setExpandedId(latest.id) // show latest immediately
    })
  }, [fetchReports, runScan])

  // Periodic refresh (quiet — no loading spinner)
  useEffect(() => {
    const id = setInterval(() => void fetchReports(true), REFRESH_INTERVAL_MS)
    return () => clearInterval(id)
  }, [fetchReports])

  const latest = reports[0]
  const hasCritical = (latest?.critical ?? 0) > 0
  const hasWarnings = (latest?.warnings ?? 0) > 0

  return (
    <div style={{ padding: '28px 32px', maxWidth: 860 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: t.radius.sm,
            background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.26)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Shield size={17} style={{ color: '#60A5FA' }} />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, letterSpacing: '-0.3px', color: t.text.primary }}>
              Opiekun Systemu
            </h1>
            <p style={{ margin: 0, fontSize: 12, color: t.text.muted }}>
              Automatyczny monitoring · {lastRefresh ? `odświeżono ${relativeTime(lastRefresh.toISOString())}` : 'ładowanie...'}
            </p>
          </div>
        </div>

        {/* Small refresh — secondary, not main CTA */}
        <button
          onClick={() => void runScan()}
          disabled={scanning}
          title="Uruchom skan teraz"
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: t.radius.sm,
            background: 'transparent', border: `1px solid ${t.border.default}`,
            color: t.text.muted, fontSize: 12, cursor: scanning ? 'wait' : 'pointer',
            opacity: scanning ? 0.6 : 1, transition: 'all 0.15s',
          }}
        >
          <RefreshCw size={12} style={{ animation: scanning ? 'spin 1s linear infinite' : 'none' }} />
          {scanning ? 'Skanowanie...' : 'Skanuj'}
        </button>
      </div>

      {/* ── Status banner — always visible ── */}
      {loading ? (
        <div style={{
          background: t.bg.card, border: `1px solid ${t.border.subtle}`,
          borderRadius: t.radius.md, padding: '16px 20px', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <RefreshCw size={15} style={{ color: t.text.muted, animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: 13, color: t.text.muted }}>Ładuję dane systemu...</span>
        </div>
      ) : latest ? (
        <div style={{
          background: hasCritical ? t.semantic.errorBg : hasWarnings ? t.semantic.warningBg : t.semantic.successBg,
          border: `1px solid ${hasCritical ? t.semantic.errorBorder : hasWarnings ? t.semantic.warningBorder : t.semantic.successBorder}`,
          borderRadius: t.radius.md, padding: '16px 20px', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          {hasCritical
            ? <AlertCircle size={18} style={{ color: t.semantic.error, flexShrink: 0 }} />
            : hasWarnings
              ? <AlertTriangle size={18} style={{ color: t.semantic.warning, flexShrink: 0 }} />
              : <CheckCircle size={18} style={{ color: t.semantic.success, flexShrink: 0 }} />
          }
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.text.primary, marginBottom: 2 }}>
              {hasCritical
                ? `${latest.critical} ${latest.critical === 1 ? 'sprawa wymaga' : 'sprawy wymagają'} działania`
                : hasWarnings
                  ? `${latest.warnings} ${latest.warnings === 1 ? 'ostrzeżenie' : 'ostrzeżeń'} do sprawdzenia`
                  : 'System działa sprawnie'}
            </div>
            {latest.summary && (
              <div style={{ fontSize: 13, color: t.text.secondary }}>{latest.summary}</div>
            )}
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: hasCritical ? t.semantic.error : hasWarnings ? t.semantic.warning : t.semantic.success, lineHeight: 1 }}>
              {latest.alert_count}
            </div>
            <div style={{ fontSize: 10, color: t.text.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>
              {latest.alert_count === 1 ? 'alert' : 'alertów'}
            </div>
          </div>
        </div>
      ) : scanning ? (
        <div style={{
          background: t.bg.card, border: `1px solid ${t.border.subtle}`,
          borderRadius: t.radius.md, padding: '16px 20px', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <RefreshCw size={15} style={{ color: '#60A5FA', animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: 13, color: t.text.secondary }}>Opiekun skanuje system — to zajmie chwilę...</span>
        </div>
      ) : null}

      {/* ── Latest report alerts — auto-expanded ── */}
      {latest && latest.alerts.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: t.text.muted, marginBottom: 12 }}>
            Aktywne alerty
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {latest.alerts.map((alert, i) => (
              <AlertCard key={i} alert={alert} />
            ))}
          </div>
        </div>
      )}

      {latest && latest.alert_count === 0 && (
        <div style={{
          background: t.semantic.successBg, border: `1px solid ${t.semantic.successBorder}`,
          borderRadius: t.radius.md, padding: '20px', marginBottom: 28,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <CheckCircle size={18} style={{ color: t.semantic.success, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.text.primary }}>Wszystko sprawne</div>
            <div style={{ fontSize: 12, color: t.text.muted }}>Żadnych alertów w ostatnim skanie.</div>
          </div>
        </div>
      )}

      {/* ── Rules reference — compact ── */}
      <div style={{
        background: t.bg.card, border: `1px solid ${t.border.subtle}`,
        borderRadius: t.radius.md, padding: '14px 18px', marginBottom: 24,
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: t.text.muted, marginBottom: 10 }}>
          Co jest monitorowane
        </div>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          {RULES.map(r => (
            <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13 }}>{r.icon}</span>
              <span style={{ fontSize: 11, color: t.text.muted }}>{r.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── History — collapsed rows ── */}
      {reports.length > 1 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: t.text.muted, marginBottom: 10 }}>
            Historia skanów
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {reports.slice(1).map(report => (
              <button
                key={report.id}
                onClick={() => setExpandedId(expandedId === report.id ? null : report.id)}
                style={{
                  width: '100%', background: t.bg.card,
                  border: `1px solid ${report.critical > 0 ? t.semantic.errorBorder : t.border.subtle}`,
                  borderRadius: t.radius.sm, padding: '10px 14px',
                  display: 'flex', alignItems: 'center', gap: 10,
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                {report.critical > 0
                  ? <AlertCircle size={13} style={{ color: t.semantic.error, flexShrink: 0 }} />
                  : report.warnings > 0
                    ? <AlertTriangle size={13} style={{ color: t.semantic.warning, flexShrink: 0 }} />
                    : <CheckCircle size={13} style={{ color: t.semantic.success, flexShrink: 0 }} />
                }
                <span style={{ fontSize: 12, color: t.text.secondary, flex: 1 }}>{relativeTime(report.generated_at)}</span>
                {report.alert_count > 0 && (
                  <span style={{ fontSize: 11, color: t.text.muted }}>{report.alert_count} alertów</span>
                )}
                {report.alert_count === 0 && (
                  <span style={{ fontSize: 11, color: t.semantic.success }}>OK</span>
                )}
                {expandedId === report.id
                  ? <ChevronUp size={12} style={{ color: t.text.muted, flexShrink: 0 }} />
                  : <ChevronDown size={12} style={{ color: t.text.muted, flexShrink: 0 }} />
                }
              </button>
            ))}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }`}</style>
    </div>
  )
}
