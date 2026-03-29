'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, ArrowRight, Sparkles, CheckCircle2, AlertCircle,
  Settings2, Cpu, TrendingUp, Headphones, BarChart3,
  Clock, ChevronRight, Loader2,
} from 'lucide-react'
import { t } from '@/lib/tokens'
import type { Audit, AuditCategoryId, AuditFinding, AuditQuoteItem } from '@/lib/types'
import { AUDIT_CATEGORIES } from '@/lib/audit-questions'
import { formatPLN } from '@/lib/format'

// ─── Props ────────────────────────────────────────────────────────────────────

interface AuditWizardProps {
  clientId: string
  clientName: string
  clientIndustry?: string
  existingAudit: Audit | null
}

// ─── Icons per category ───────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<AuditCategoryId, React.ElementType> = {
  procesy: Settings2,
  technologia: Cpu,
  sprzedaz: TrendingUp,
  obsluga: Headphones,
  dane: BarChart3,
}

// ─── Score color ──────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score <= 30) return t.semantic.error
  if (score <= 60) return t.semantic.warning
  return t.semantic.success
}

function severityColor(s: string): string {
  if (s === 'high') return t.semantic.error
  if (s === 'medium') return t.semantic.warning
  return t.semantic.success
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      backgroundColor: t.bg.card, border: `1px solid ${t.border.default}`,
      borderRadius: t.radius.lg, padding: '20px 24px', boxShadow: t.shadow.card,
      ...style,
    }}>
      {children}
    </div>
  )
}

// ─── Progress dots ────────────────────────────────────────────────────────────

function StepProgress({ current, answers }: { current: number; answers: Record<string, string> }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
      {AUDIT_CATEGORIES.map((cat, i) => {
        const filled = cat.questions.filter(q => answers[q.id]?.trim()).length
        const total = cat.questions.filter(q => q.required).length
        const done = filled >= total && total > 0
        const active = i === current
        const Icon = CATEGORY_ICONS[cat.id]
        return (
          <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: active ? t.brand.gold : done ? 'rgba(34,197,94,0.15)' : t.bg.muted,
                border: `2px solid ${active ? t.brand.gold : done ? t.semantic.success : t.border.default}`,
                transition: 'all 200ms',
              }}>
                {done && !active
                  ? <CheckCircle2 style={{ width: 16, height: 16, color: t.semantic.success }} />
                  : <Icon style={{ width: 15, height: 15, color: active ? '#000' : t.text.muted }} />
                }
              </div>
              <span style={{ fontSize: 10, color: active ? t.text.primary : t.text.muted, fontWeight: active ? 700 : 400 }}>
                {cat.label.split(' ')[0]}
              </span>
            </div>
            {i < AUDIT_CATEGORIES.length - 1 && (
              <div style={{
                width: 32, height: 2, marginBottom: 20,
                backgroundColor: done ? t.semantic.success : t.border.default,
                transition: 'background-color 200ms',
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Category step ────────────────────────────────────────────────────────────

function CategoryStep({
  categoryIdx,
  answers,
  onChange,
}: {
  categoryIdx: number
  answers: Record<string, string>
  onChange: (qId: string, value: string) => void
}) {
  const cat = AUDIT_CATEGORIES[categoryIdx]
  const Icon = CATEGORY_ICONS[cat.id]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Category header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 10,
          backgroundColor: 'rgba(196,154,46,0.12)',
          border: `1px solid rgba(196,154,46,0.2)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon style={{ width: 20, height: 20, color: t.brand.gold }} />
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: t.text.primary }}>{cat.label}</div>
          <div style={{ fontSize: 13, color: t.text.muted, marginTop: 2 }}>{cat.description}</div>
        </div>
      </div>

      {/* Questions */}
      {cat.questions.map((q, qi) => (
        <div key={q.id} style={{
          backgroundColor: t.bg.muted,
          border: `1px solid ${answers[q.id]?.trim() ? 'rgba(34,197,94,0.2)' : t.border.default}`,
          borderRadius: t.radius.md, padding: '16px 18px',
          transition: 'border-color 200ms',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
            <span style={{
              fontSize: 11, fontWeight: 700, color: t.brand.gold,
              backgroundColor: 'rgba(196,154,46,0.1)',
              border: `1px solid rgba(196,154,46,0.2)`,
              padding: '2px 8px', borderRadius: t.radius.full, flexShrink: 0, marginTop: 1,
            }}>
              P{qi + 1}{q.required ? '' : ' (opcjonalne)'}
            </span>
            <span style={{ fontSize: 14, color: t.text.primary, lineHeight: 1.55, fontWeight: 500 }}>
              {q.question}
            </span>
          </div>
          <textarea
            value={answers[q.id] ?? ''}
            onChange={e => onChange(q.id, e.target.value)}
            placeholder={q.placeholder}
            rows={3}
            style={{
              width: '100%', background: t.bg.card,
              border: `1px solid ${t.border.default}`,
              borderRadius: t.radius.sm, padding: '10px 12px',
              color: t.text.primary, fontSize: 13, lineHeight: 1.6,
              resize: 'vertical' as const, outline: 'none',
              fontFamily: 'inherit', boxSizing: 'border-box' as const,
            }}
            onFocus={e => { e.currentTarget.style.borderColor = t.brand.gold }}
            onBlur={e => { e.currentTarget.style.borderColor = t.border.default }}
          />
        </div>
      ))}
    </div>
  )
}

// ─── Review step ──────────────────────────────────────────────────────────────

function ReviewStep({
  answers,
  onAnalyze,
  analyzing,
}: {
  answers: Record<string, string>
  onAnalyze: () => void
  analyzing: boolean
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: t.text.primary }}>Przegląd i Analiza</div>
      <div style={{ fontSize: 14, color: t.text.muted }}>
        Sprawdź kompletność odpowiedzi przed analizą AI.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {AUDIT_CATEGORIES.map(cat => {
          const filled = cat.questions.filter(q => answers[q.id]?.trim()).length
          const requiredFilled = cat.questions.filter(q => q.required && answers[q.id]?.trim()).length
          const requiredTotal = cat.questions.filter(q => q.required).length
          const allRequired = requiredFilled === requiredTotal
          const Icon = CATEGORY_ICONS[cat.id]
          return (
            <div key={cat.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px',
              backgroundColor: allRequired ? 'rgba(34,197,94,0.05)' : t.bg.muted,
              border: `1px solid ${allRequired ? 'rgba(34,197,94,0.2)' : t.border.default}`,
              borderRadius: t.radius.sm,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon style={{ width: 15, height: 15, color: t.text.muted }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: t.text.primary }}>{cat.label}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: t.text.muted }}>
                  {filled}/{cat.questions.length} pytań
                </span>
                {allRequired
                  ? <CheckCircle2 style={{ width: 15, height: 15, color: t.semantic.success }} />
                  : <Clock style={{ width: 15, height: 15, color: t.semantic.warning }} />
                }
              </div>
            </div>
          )
        })}
      </div>

      <button
        onClick={onAnalyze}
        disabled={analyzing}
        style={{
          marginTop: 8,
          background: t.brand.gold, color: '#000', border: 'none',
          borderRadius: t.radius.md, padding: '14px 28px',
          fontSize: 15, fontWeight: 700,
          cursor: analyzing ? 'not-allowed' : 'pointer',
          opacity: analyzing ? 0.7 : 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          transition: 'all 150ms',
        }}
        onMouseEnter={e => { if (!analyzing) e.currentTarget.style.transform = 'translateY(-1px)' }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}
      >
        {analyzing
          ? <><Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} /> Analizuję z Claude...</>
          : <><Sparkles style={{ width: 16, height: 16 }} /> Analizuj z AI</>
        }
      </button>
      {analyzing && (
        <p style={{ fontSize: 13, color: t.text.muted, textAlign: 'center', margin: 0 }}>
          Claude analizuje odpowiedzi i generuje rekomendacje — może potrwać 10-20 sekund...
        </p>
      )}
    </div>
  )
}

// ─── Results view ─────────────────────────────────────────────────────────────

function AuditResults({
  audit,
  clientId,
  onNewAudit,
}: {
  audit: Audit
  clientId: string
  onNewAudit: () => void
}) {
  const router = useRouter()
  const findings = (audit.findings ?? []) as AuditFinding[]
  const quoteItems = (audit.recommendations ?? []) as AuditQuoteItem[]
  const scores = audit.ai_scores ?? {}

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Summary header */}
      <Card style={{ borderTop: `3px solid ${t.brand.gold}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles style={{ width: 17, height: 17, color: t.brand.gold }} />
              <span style={{ fontSize: 16, fontWeight: 700, color: t.text.primary }}>Wyniki Audytu Operacyjnego</span>
            </div>
            {audit.score !== null && audit.score !== undefined && (
              <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, color: t.text.muted }}>Ogólny wynik:</span>
                <span style={{ fontSize: 22, fontWeight: 800, color: scoreColor(audit.score) }}>
                  {audit.score}/100
                </span>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => router.push(`/dashboard/quotes`)}
              style={{
                background: t.brand.gold, color: '#000', border: 'none',
                borderRadius: t.radius.md, padding: '9px 18px',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <ChevronRight style={{ width: 14, height: 14 }} />
              Utwórz wycenę
            </button>
            <button
              onClick={onNewAudit}
              style={{
                background: 'none', color: t.text.secondary,
                border: `1px solid ${t.border.default}`,
                borderRadius: t.radius.md, padding: '9px 16px',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Nowy audyt
            </button>
          </div>
        </div>
        {audit.ai_summary && (
          <p style={{ fontSize: 14, color: t.text.secondary, lineHeight: 1.7, margin: 0 }}>
            {audit.ai_summary}
          </p>
        )}
      </Card>

      {/* Score cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
        {AUDIT_CATEGORIES.map(cat => {
          const score = scores[cat.id] ?? 0
          const Icon = CATEGORY_ICONS[cat.id]
          return (
            <Card key={cat.id} style={{ padding: '14px 16px', textAlign: 'center' }}>
              <Icon style={{ width: 18, height: 18, color: scoreColor(score), margin: '0 auto 8px' }} />
              <div style={{ fontSize: 24, fontWeight: 800, color: scoreColor(score), lineHeight: 1 }}>
                {score}
              </div>
              <div style={{ fontSize: 10, color: t.text.muted, marginTop: 4, lineHeight: 1.3 }}>
                {cat.label.split(' ')[0]}
              </div>
            </Card>
          )
        })}
      </div>

      {/* Two column: findings + quote items */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Findings */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <AlertCircle style={{ width: 15, height: 15, color: t.text.muted }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: t.text.primary }}>Obserwacje ({findings.length})</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {findings.map((f, i) => (
              <div key={i} style={{
                padding: '10px 12px',
                backgroundColor: t.bg.muted,
                border: `1px solid ${t.border.default}`,
                borderLeft: `3px solid ${severityColor(f.severity)}`,
                borderRadius: t.radius.sm,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: severityColor(f.severity),
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                  }}>
                    {f.severity === 'high' ? 'Krytyczne' : f.severity === 'medium' ? 'Ważne' : 'Informacja'}
                  </span>
                  <span style={{ fontSize: 10, color: t.text.muted }}>· {f.category}</span>
                </div>
                <p style={{ fontSize: 12, color: t.text.secondary, margin: '0 0 6px', lineHeight: 1.5 }}>{f.finding}</p>
                <p style={{ fontSize: 12, color: t.semantic.success, margin: 0, lineHeight: 1.5 }}>
                  → {f.recommendation}
                </p>
              </div>
            ))}
          </div>
        </Card>

        {/* Quote items */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <ChevronRight style={{ width: 15, height: 15, color: t.brand.gold }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: t.text.primary }}>Proponowane rozwiązania</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {quoteItems.sort((a, b) => a.priority - b.priority).map((item, i) => (
              <div key={i} style={{
                padding: '10px 12px',
                backgroundColor: t.bg.muted,
                border: `1px solid ${t.border.default}`,
                borderRadius: t.radius.sm,
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10,
              }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: t.text.primary, marginBottom: 2 }}>
                    {i + 1}. {item.name}
                  </div>
                  <div style={{ fontSize: 11, color: t.text.muted }}>{item.description}</div>
                  <span style={{
                    fontSize: 10, color: t.text.muted,
                    backgroundColor: t.bg.overlay,
                    border: `1px solid ${t.border.default}`,
                    padding: '1px 6px', borderRadius: t.radius.full,
                    display: 'inline-block', marginTop: 4,
                  }}>
                    {item.category === 'setup' ? 'Wdrożenie' : item.category === 'monthly' ? 'Miesięcznie' : 'Jednorazowe'}
                  </span>
                </div>
                <span style={{ fontSize: 14, fontWeight: 800, color: t.brand.gold, flexShrink: 0 }}>
                  {formatPLN(item.price)}
                </span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, padding: '10px 12px', backgroundColor: t.bg.overlay, borderRadius: t.radius.sm }}>
            <div style={{ fontSize: 12, color: t.text.muted, marginBottom: 2 }}>Szacowana wartość wdrożenia:</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: t.brand.gold }}>
              {formatPLN(quoteItems.filter(i => i.category === 'setup').reduce((s, i) => s + i.price, 0))} setup
              {' + '}
              {formatPLN(quoteItems.filter(i => i.category === 'monthly').reduce((s, i) => s + i.price, 0))}/mies
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

export function AuditWizard({ clientId, clientName, existingAudit }: AuditWizardProps) {
  const router = useRouter()

  const [audit, setAudit] = useState<Audit | null>(
    existingAudit?.status === 'completed' ? existingAudit : null
  )
  const [auditId, setAuditId] = useState<string | null>(
    existingAudit && existingAudit.status !== 'completed' ? existingAudit.id : null
  )
  const [answers, setAnswers] = useState<Record<string, string>>(
    existingAudit?.answers ?? {}
  )
  const [step, setStep] = useState(0)   // 0-4 = category steps, 5 = review
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)

  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // If completed audit exists, show results directly
  const showResults = audit?.status === 'completed'
  const inWizard = auditId !== null || showResults
  const displayName = clientName

  // Start or resume audit
  const startAudit = useCallback(async () => {
    if (auditId) { return }  // already started
    setStarting(true)
    setError(null)
    try {
      const res = await fetch('/api/audits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, title: `Audyt Operacyjny — ${clientName}` }),
      })
      const data = await res.json() as { audit?: Audit; error?: string }
      if (!res.ok || !data.audit) throw new Error(data.error ?? 'Błąd tworzenia audytu')
      setAuditId(data.audit.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd serwera')
    } finally {
      setStarting(false)
    }
  }, [auditId, clientId, clientName])

  // Autosave answers (debounced)
  const saveAnswers = useCallback((newAnswers: Record<string, string>) => {
    if (!auditId) return
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    autosaveTimer.current = setTimeout(async () => {
      await fetch(`/api/audits/${auditId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: newAnswers }),
      })
    }, 800)
  }, [auditId])

  const handleAnswer = (qId: string, value: string) => {
    const next = { ...answers, [qId]: value }
    setAnswers(next)
    saveAnswers(next)
  }

  const goNext = async () => {
    // Save current step immediately before navigation
    if (auditId) {
      await fetch(`/api/audits/${auditId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      })
    }
    setStep(s => Math.min(s + 1, AUDIT_CATEGORIES.length))
  }

  const goPrev = () => setStep(s => Math.max(s - 1, 0))

  const analyze = async () => {
    if (!auditId) return
    setAnalyzing(true)
    setError(null)
    try {
      const res = await fetch(`/api/audits/${auditId}/analyze`, { method: 'POST' })
      const data = await res.json() as { audit?: Audit; error?: string }
      if (!res.ok || !data.audit) throw new Error(data.error ?? 'Błąd analizy')
      setAudit(data.audit)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd analizy AI')
    } finally {
      setAnalyzing(false)
    }
  }

  const startNewAudit = () => {
    setAudit(null)
    setAuditId(null)
    setAnswers({})
    setStep(0)
    setError(null)
  }

  const TOTAL_STEPS = AUDIT_CATEGORIES.length + 1  // 5 categories + 1 review

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        textarea { font-family: inherit; }
        textarea::placeholder { color: ${t.text.muted}; opacity: 0.7; }
      `}</style>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => router.push(`/dashboard/clients/${clientId}`)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'none', border: 'none', cursor: 'pointer',
              color: t.text.muted, fontSize: 14, padding: 0,
            }}
          >
            <ArrowLeft style={{ width: 16, height: 16 }} />
            {displayName}
          </button>
          <span style={{ color: t.border.default }}>/</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: t.text.primary }}>Audyt Operacyjny</span>
        </div>
        {!showResults && inWizard && (
          <span style={{ fontSize: 12, color: t.text.muted }}>
            Krok {step + 1} z {TOTAL_STEPS}
          </span>
        )}
      </div>

      {/* Landing — not yet started */}
      {!inWizard && !showResults && (
        <Card style={{ maxWidth: 560 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              backgroundColor: 'rgba(196,154,46,0.12)',
              border: `1px solid rgba(196,154,46,0.25)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Sparkles style={{ width: 22, height: 22, color: t.brand.gold }} />
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, color: t.text.primary }}>Audyt Operacyjny AI</div>
              <div style={{ fontSize: 13, color: t.text.muted, marginTop: 2 }}>{displayName}</div>
            </div>
          </div>
          <p style={{ fontSize: 14, color: t.text.secondary, lineHeight: 1.7, marginBottom: 20 }}>
            25 pytań w 5 kategoriach. Claude przeanalizuje odpowiedzi i wygeneruje:
            scoringi, obserwacje, rekomendacje gotowe do wyceny.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
            {AUDIT_CATEGORIES.map(cat => {
              const Icon = CATEGORY_ICONS[cat.id]
              return (
                <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Icon style={{ width: 14, height: 14, color: t.brand.gold }} />
                  <span style={{ fontSize: 13, color: t.text.muted }}>
                    <strong style={{ color: t.text.secondary }}>{cat.label}</strong> — {cat.description}
                  </span>
                </div>
              )
            })}
          </div>
          {error && (
            <div style={{ padding: '10px 14px', backgroundColor: t.semantic.errorBg, border: `1px solid ${t.semantic.errorBorder}`, borderRadius: t.radius.sm, marginBottom: 16 }}>
              <span style={{ fontSize: 13, color: t.semantic.error }}>{error}</span>
            </div>
          )}
          <button
            onClick={startAudit}
            disabled={starting}
            style={{
              background: t.brand.gold, color: '#000', border: 'none',
              borderRadius: t.radius.md, padding: '11px 24px',
              fontSize: 14, fontWeight: 700, cursor: starting ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            {starting ? <Loader2 style={{ width: 15, height: 15, animation: 'spin 1s linear infinite' }} /> : <Sparkles style={{ width: 15, height: 15 }} />}
            Rozpocznij audyt
          </button>
        </Card>
      )}

      {/* Wizard in progress */}
      {inWizard && !showResults && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Progress */}
          <StepProgress current={step} answers={answers} />

          <Card>
            {step < AUDIT_CATEGORIES.length
              ? <CategoryStep categoryIdx={step} answers={answers} onChange={handleAnswer} />
              : <ReviewStep answers={answers} onAnalyze={analyze} analyzing={analyzing} />
            }

            {error && (
              <div style={{ marginTop: 16, padding: '10px 14px', backgroundColor: t.semantic.errorBg, border: `1px solid ${t.semantic.errorBorder}`, borderRadius: t.radius.sm }}>
                <span style={{ fontSize: 13, color: t.semantic.error }}>{error}</span>
              </div>
            )}
          </Card>

          {/* Navigation */}
          {step < AUDIT_CATEGORIES.length && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                onClick={goPrev}
                disabled={step === 0}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'none', border: `1px solid ${t.border.default}`,
                  borderRadius: t.radius.md, padding: '9px 16px',
                  fontSize: 13, fontWeight: 600,
                  color: step === 0 ? t.text.muted : t.text.secondary,
                  cursor: step === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                <ArrowLeft style={{ width: 14, height: 14 }} />
                Poprzednia
              </button>
              <button
                onClick={goNext}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: t.bg.overlay, border: `1px solid ${t.border.default}`,
                  borderRadius: t.radius.md, padding: '9px 16px',
                  fontSize: 13, fontWeight: 600, color: t.text.secondary,
                  cursor: 'pointer',
                }}
              >
                {step < AUDIT_CATEGORIES.length - 1 ? 'Następna kategoria' : 'Przejdź do przeglądu'}
                <ArrowRight style={{ width: 14, height: 14 }} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {showResults && audit && (
        <AuditResults audit={audit} clientId={clientId} onNewAudit={startNewAudit} />
      )}
    </div>
  )
}
