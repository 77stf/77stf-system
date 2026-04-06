'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, ArrowRight, Sparkles, CheckCircle2, AlertCircle,
  Settings2, Cpu, TrendingUp, Headphones, BarChart3,
  Clock, ChevronRight, Loader2, Target, Lock, DollarSign,
} from 'lucide-react'
import { t } from '@/lib/tokens'
import type { Audit, AuditCategoryId, AuditFinding, AuditQuoteItem, AuditContextData, AuditImplementation } from '@/lib/types'
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
  kontekst: Target,
}

// Main categories (without consultant-only 'kontekst')
const MAIN_CATEGORIES = AUDIT_CATEGORIES.filter(c => !c.consultantOnly)
const KONTEKST_CATEGORY = AUDIT_CATEGORIES.find(c => c.id === 'kontekst')!

// Step layout:
// 0 = consultant zone (context_data)
// 1..5 = main categories (MAIN_CATEGORIES[step-1])
// 6 = kontekst (consultant-only strategic questions)
// 7 = review

const TOTAL_STEPS = 8 // 0..7

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function RadioGroup({
  label, options, value, onChange,
}: {
  label: string
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: t.text.muted, marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {options.map(o => (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            style={{
              padding: '5px 12px', borderRadius: t.radius.full, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', transition: 'all 150ms',
              border: `1px solid ${value === o.value ? t.brand.gold : t.border.default}`,
              background: value === o.value ? 'rgba(196,154,46,0.12)' : 'transparent',
              color: value === o.value ? t.brand.gold : t.text.muted,
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Consultant Context Step (Step 0) ─────────────────────────────────────────

function ConsultantContextStep({
  contextData,
  onChange,
}: {
  contextData: AuditContextData
  onChange: (data: AuditContextData) => void
}) {
  const update = (patch: Partial<AuditContextData>) => onChange({ ...contextData, ...patch })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 10,
          backgroundColor: 'rgba(99,102,241,0.12)',
          border: `1px solid rgba(99,102,241,0.25)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Lock style={{ width: 20, height: 20, color: '#818CF8' }} />
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: t.text.primary }}>Strefa Konsultanta</div>
          <div style={{ fontSize: 13, color: t.text.muted, marginTop: 2 }}>
            Kontekst finansowy i decyzyjny — widoczny tylko dla Ciebie, niezbędny do wyceny
          </div>
        </div>
      </div>

      {/* Financial profile */}
      <div style={{
        border: `1px solid rgba(99,102,241,0.2)`,
        borderRadius: t.radius.md, padding: '16px 18px',
        backgroundColor: 'rgba(99,102,241,0.03)',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#818CF8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Profil finansowy
        </div>

        <RadioGroup
          label="Orientacyjne przychody miesięczne:"
          options={[
            { value: '<50k', label: '< 50k' },
            { value: '50-200k', label: '50–200k' },
            { value: '200-500k', label: '200–500k' },
            { value: '500k-2M', label: '500k–2M' },
            { value: '>2M', label: '> 2M PLN' },
          ]}
          value={contextData.revenue_range ?? ''}
          onChange={v => update({ revenue_range: v as AuditContextData['revenue_range'] })}
        />

        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: t.text.muted, marginBottom: 8 }}>
            Struktura zespołu (FTE):
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {([
              { key: 'team_sales', label: 'Sprzedaż' },
              { key: 'team_cs', label: 'Obsługa klienta' },
              { key: 'team_ops', label: 'Operacje/admin' },
            ] as const).map(({ key, label }) => (
              <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 11, color: t.text.muted }}>{label}</label>
                <input
                  type="number"
                  min="0"
                  max="99"
                  value={contextData[key] ?? ''}
                  onChange={e => update({ [key]: parseInt(e.target.value) || 0 })}
                  style={{
                    width: 70, padding: '6px 10px', borderRadius: t.radius.sm,
                    border: `1px solid ${t.border.default}`, background: t.bg.card,
                    color: t.text.primary, fontSize: 14, fontWeight: 600, textAlign: 'center',
                    outline: 'none',
                  }}
                />
              </div>
            ))}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, color: t.text.muted }}>Koszt/h brutto (PLN)</label>
              <input
                type="number"
                min="0"
                value={contextData.hourly_cost_pln ?? ''}
                onChange={e => update({ hourly_cost_pln: parseInt(e.target.value) || 0 })}
                style={{
                  width: 100, padding: '6px 10px', borderRadius: t.radius.sm,
                  border: `1px solid ${t.border.default}`, background: t.bg.card,
                  color: t.text.primary, fontSize: 14, fontWeight: 600, textAlign: 'center',
                  outline: 'none',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Budget */}
      <div style={{
        border: `1px solid rgba(99,102,241,0.2)`,
        borderRadius: t.radius.md, padding: '16px 18px',
        backgroundColor: 'rgba(99,102,241,0.03)',
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#818CF8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Orientacyjny budżet wdrożeniowy
        </div>

        <RadioGroup
          label="Jednorazowo (setup):"
          options={[
            { value: '<10k', label: '< 10k' },
            { value: '10-30k', label: '10–30k' },
            { value: '30-80k', label: '30–80k' },
            { value: '>80k', label: '> 80k PLN' },
          ]}
          value={contextData.budget_setup ?? ''}
          onChange={v => update({ budget_setup: v as AuditContextData['budget_setup'] })}
        />

        <RadioGroup
          label="Miesięcznie (opieka):"
          options={[
            { value: '<1k', label: '< 1k' },
            { value: '1-3k', label: '1–3k' },
            { value: '3-6k', label: '3–6k' },
            { value: '>6k', label: '> 6k PLN' },
          ]}
          value={contextData.budget_monthly ?? ''}
          onChange={v => update({ budget_monthly: v as AuditContextData['budget_monthly'] })}
        />
      </div>

      {/* Decision */}
      <div style={{
        border: `1px solid rgba(99,102,241,0.2)`,
        borderRadius: t.radius.md, padding: '16px 18px',
        backgroundColor: 'rgba(99,102,241,0.03)',
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#818CF8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Decyzyjność
        </div>

        <RadioGroup
          label="Kto decyduje:"
          options={[
            { value: 'owner', label: 'Właściciel sam' },
            { value: 'board', label: 'Zarząd / wspólnicy' },
            { value: 'investor', label: 'Inwestor zewnętrzny' },
          ]}
          value={contextData.decision_maker ?? ''}
          onChange={v => update({ decision_maker: v as AuditContextData['decision_maker'] })}
        />

        <RadioGroup
          label="Gotowość:"
          options={[
            { value: 'now', label: 'Teraz — gotowi' },
            { value: '1-3m', label: '1–3 miesiące' },
            { value: 'planning', label: 'Dopiero planują' },
          ]}
          value={contextData.timeline ?? ''}
          onChange={v => update({ timeline: v as AuditContextData['timeline'] })}
        />
      </div>

      {/* External context */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: t.text.muted, marginBottom: 6 }}>
          Kontekst zewnętrzny (Google Maps, konkurenci, uwagi rynkowe):
        </div>
        <textarea
          value={contextData.external_context ?? ''}
          onChange={e => update({ external_context: e.target.value })}
          placeholder='Np. "Google Maps: 127 opinii, 4.2/5. Konkurenci: DOZ.pl, Gemini, apteki sieciowe. Uwagi: wchodzą regulacje URPL od 2026..."'
          rows={3}
          style={{
            width: '100%', background: t.bg.muted,
            border: `1px solid ${t.border.default}`,
            borderRadius: t.radius.sm, padding: '10px 12px',
            color: t.text.primary, fontSize: 13, lineHeight: 1.6,
            resize: 'vertical' as const, outline: 'none',
            fontFamily: 'inherit', boxSizing: 'border-box' as const,
          }}
        />
      </div>
    </div>
  )
}

// ─── Progress dots (5 main categories only) ───────────────────────────────────

function StepProgress({ current, answers }: { current: number; answers: Record<string, string> }) {
  // current: 1-5 maps to MAIN_CATEGORIES[0-4], 6 = kontekst, 7 = review
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
      {MAIN_CATEGORIES.map((cat, i) => {
        const stepForCat = i + 1 // steps 1-5
        const filled = cat.questions.filter(q => answers[q.id]?.trim()).length
        const total = cat.questions.filter(q => q.required).length
        const done = filled >= total && total > 0
        const active = current === stepForCat
        const Icon = CATEGORY_ICONS[cat.id]
        return (
          <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
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
            {i < MAIN_CATEGORIES.length - 1 && (
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
  const isConsultant = cat.consultantOnly

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 10,
          backgroundColor: isConsultant ? 'rgba(99,102,241,0.12)' : 'rgba(196,154,46,0.12)',
          border: `1px solid ${isConsultant ? 'rgba(99,102,241,0.25)' : 'rgba(196,154,46,0.2)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {isConsultant
            ? <Lock style={{ width: 20, height: 20, color: '#818CF8' }} />
            : <Icon style={{ width: 20, height: 20, color: t.brand.gold }} />
          }
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: t.text.primary }}>{cat.label}</span>
            {isConsultant && (
              <span style={{
                fontSize: 10, fontWeight: 700, color: '#818CF8',
                backgroundColor: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
                padding: '2px 8px', borderRadius: t.radius.full,
              }}>Tylko konsultant</span>
            )}
          </div>
          <div style={{ fontSize: 13, color: t.text.muted, marginTop: 2 }}>{cat.description}</div>
        </div>
      </div>

      {cat.questions.map((q, qi) => (
        <div key={q.id} style={{
          backgroundColor: t.bg.muted,
          border: `1px solid ${answers[q.id]?.trim() ? 'rgba(34,197,94,0.2)' : t.border.default}`,
          borderRadius: t.radius.md, padding: '16px 18px',
          transition: 'border-color 200ms',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
            <span style={{
              fontSize: 11, fontWeight: 700,
              color: isConsultant ? '#818CF8' : t.brand.gold,
              backgroundColor: isConsultant ? 'rgba(99,102,241,0.1)' : 'rgba(196,154,46,0.1)',
              border: `1px solid ${isConsultant ? 'rgba(99,102,241,0.2)' : 'rgba(196,154,46,0.2)'}`,
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
            onFocus={e => { e.currentTarget.style.borderColor = isConsultant ? '#818CF8' : t.brand.gold }}
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
      <div style={{ fontSize: 14, color: t.text.muted }}>Sprawdź kompletność odpowiedzi przed analizą AI.</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {AUDIT_CATEGORIES.map(cat => {
          const filled = cat.questions.filter(q => answers[q.id]?.trim()).length
          const requiredFilled = cat.questions.filter(q => q.required && answers[q.id]?.trim()).length
          const requiredTotal = cat.questions.filter(q => q.required).length
          const allRequired = requiredFilled === requiredTotal
          const Icon = CATEGORY_ICONS[cat.id]
          const isConsultant = cat.consultantOnly
          return (
            <div key={cat.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px',
              backgroundColor: allRequired ? 'rgba(34,197,94,0.05)' : t.bg.muted,
              border: `1px solid ${allRequired ? 'rgba(34,197,94,0.2)' : t.border.default}`,
              borderRadius: t.radius.sm,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {isConsultant
                  ? <Lock style={{ width: 15, height: 15, color: '#818CF8' }} />
                  : <Icon style={{ width: 15, height: 15, color: t.text.muted }} />
                }
                <span style={{ fontSize: 13, fontWeight: 600, color: t.text.primary }}>{cat.label}</span>
                {isConsultant && (
                  <span style={{ fontSize: 10, color: '#818CF8' }}>· konsultant</span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: t.text.muted }}>{filled}/{cat.questions.length} pytań</span>
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
          marginTop: 8, background: t.brand.gold, color: '#000', border: 'none',
          borderRadius: t.radius.md, padding: '14px 28px',
          fontSize: 15, fontWeight: 700, cursor: analyzing ? 'not-allowed' : 'pointer',
          opacity: analyzing ? 0.7 : 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          transition: 'all 150ms',
        }}
        onMouseEnter={e => { if (!analyzing) e.currentTarget.style.transform = 'translateY(-1px)' }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}
      >
        {analyzing
          ? <><Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} /> Claude analizuje...</>
          : <><Sparkles style={{ width: 16, height: 16 }} /> Analizuj z AI</>
        }
      </button>
      {analyzing && (
        <p style={{ fontSize: 13, color: t.text.muted, textAlign: 'center', margin: 0 }}>
          Claude analizuje odpowiedzi i generuje rekomendacje z kalkulacją ROI — może potrwać 15-25 sekund...
        </p>
      )}
    </div>
  )
}

// ─── Create Quote Modal ────────────────────────────────────────────────────────

function CreateQuoteModal({
  implementations,
  onClose,
  onCreated,
  auditId,
}: {
  implementations: AuditImplementation[]
  onClose: () => void
  onCreated: (quoteId: string) => void
  auditId: string
}) {
  const router = useRouter()
  const [selections, setSelections] = useState<Record<string, 'A' | 'B' | 'C'>>(() => {
    const init: Record<string, 'A' | 'B' | 'C'> = {}
    implementations.forEach(impl => { init[impl.name] = impl.recommended_variant })
    return init
  })
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getSelectedVariant = (impl: AuditImplementation) => {
    const idx = selections[impl.name] === 'A' ? 0 : selections[impl.name] === 'B' ? 1 : 2
    return impl.variants[Math.min(idx, impl.variants.length - 1)]
  }

  const totalSetup = implementations.reduce((sum, impl) => {
    const v = getSelectedVariant(impl)
    return sum + (v?.setup_pln ?? 0)
  }, 0)

  const totalMonthly = implementations.reduce((sum, impl) => {
    const v = getSelectedVariant(impl)
    return sum + (v?.monthly_pln ?? 0)
  }, 0)

  const totalRoi = implementations.reduce((s, i) => s + i.annual_roi_pln, 0)
  const roiMultiple = totalSetup > 0 ? (totalRoi / totalSetup).toFixed(1) : '—'

  const create = async () => {
    setCreating(true)
    setError(null)
    try {
      const res = await fetch(`/api/audits/${auditId}/create-quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variant_selections: selections }),
      })
      const data = await res.json() as { quote_id?: string; error?: string }
      if (!res.ok || !data.quote_id) throw new Error(data.error ?? 'Błąd tworzenia wyceny')
      onCreated(data.quote_id)
      router.push(`/dashboard/quotes`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd serwera')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 20,
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        backgroundColor: t.bg.card, border: `1px solid ${t.border.default}`,
        borderRadius: t.radius.xl, padding: '24px 28px', maxWidth: 600, width: '100%',
        maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <DollarSign style={{ width: 18, height: 18, color: t.brand.gold }} />
            <span style={{ fontSize: 16, fontWeight: 700, color: t.text.primary }}>Generuj Wycenę z Audytu</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.text.muted, fontSize: 18 }}>×</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          {implementations.map(impl => {
            const selected = selections[impl.name] ?? impl.recommended_variant
            return (
              <div key={impl.name} style={{
                padding: '14px 16px', backgroundColor: t.bg.muted,
                border: `1px solid ${t.border.default}`, borderRadius: t.radius.md,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.text.primary }}>{impl.name}</div>
                    <div style={{ fontSize: 11, color: t.semantic.success, marginTop: 2 }}>
                      ROI: {formatPLN(impl.annual_roi_pln)}/rok · zwrot {impl.payback_months?.toFixed(1) ?? '?'} mies.
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {impl.variants.map((v, idx) => {
                    const variantKey = idx === 0 ? 'A' : idx === 1 ? 'B' : 'C'
                    const isSelected = selected === variantKey
                    const isRecommended = impl.recommended_variant === variantKey
                    return (
                      <button
                        key={variantKey}
                        onClick={() => setSelections(s => ({ ...s, [impl.name]: variantKey as 'A' | 'B' | 'C' }))}
                        style={{
                          padding: '6px 12px', borderRadius: t.radius.sm, fontSize: 11, fontWeight: 600,
                          cursor: 'pointer', transition: 'all 150ms',
                          border: `1px solid ${isSelected ? t.brand.gold : t.border.default}`,
                          background: isSelected ? 'rgba(196,154,46,0.12)' : 'transparent',
                          color: isSelected ? t.brand.gold : t.text.muted,
                          position: 'relative' as const,
                        }}
                      >
                        {variantKey}: {formatPLN(v.setup_pln)} / {formatPLN(v.monthly_pln)}mies
                        {isRecommended && (
                          <span style={{
                            position: 'absolute', top: -6, right: -6,
                            fontSize: 8, background: t.brand.gold, color: '#000',
                            padding: '1px 4px', borderRadius: t.radius.full, fontWeight: 700,
                          }}>AI</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* Totals */}
        <div style={{
          padding: '14px 16px', backgroundColor: t.bg.overlay,
          border: `1px solid ${t.border.default}`, borderRadius: t.radius.md, marginBottom: 16,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <span style={{ fontSize: 12, color: t.text.muted }}>Setup: </span>
              <span style={{ fontSize: 16, fontWeight: 800, color: t.brand.gold }}>{formatPLN(totalSetup)}</span>
              <span style={{ fontSize: 12, color: t.text.muted, marginLeft: 12 }}>Miesięcznie: </span>
              <span style={{ fontSize: 16, fontWeight: 800, color: t.text.primary }}>{formatPLN(totalMonthly)}</span>
            </div>
            <div style={{ fontSize: 12, color: t.semantic.success, fontWeight: 700 }}>
              ROI {roiMultiple}× rocznie
            </div>
          </div>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', backgroundColor: t.semantic.errorBg, border: `1px solid ${t.semantic.errorBorder}`, borderRadius: t.radius.sm, marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: t.semantic.error }}>{error}</span>
          </div>
        )}

        <button
          onClick={create}
          disabled={creating}
          style={{
            width: '100%', background: t.brand.gold, color: '#000', border: 'none',
            borderRadius: t.radius.md, padding: '13px 24px',
            fontSize: 14, fontWeight: 700, cursor: creating ? 'not-allowed' : 'pointer',
            opacity: creating ? 0.7 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {creating ? <Loader2 style={{ width: 15, height: 15, animation: 'spin 1s linear infinite' }} /> : <ChevronRight style={{ width: 15, height: 15 }} />}
          {creating ? 'Tworzę wycenę...' : 'Utwórz wycenę →'}
        </button>
      </div>
    </div>
  )
}

// ─── Results view ─────────────────────────────────────────────────────────────

function AuditResults({
  audit,
  onNewAudit,
}: {
  audit: Audit
  clientId: string
  onNewAudit: () => void
}) {
  const [showQuoteModal, setShowQuoteModal] = useState(false)
  const findings = (audit.findings ?? []) as AuditFinding[]
  const quoteItems = (audit.recommendations ?? []) as AuditQuoteItem[]
  const implementations = ((audit as unknown as { implementations?: AuditImplementation[] }).implementations ?? []) as AuditImplementation[]
  const scores = audit.ai_scores ?? {}

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>

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
                <span style={{ fontSize: 12, color: t.text.muted }}>
                  ({audit.score <= 30 ? 'duży potencjał automatyzacji' : audit.score <= 60 ? 'częściowa cyfryzacja' : 'dobra baza'})
                </span>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {implementations.length > 0 && (
              <button
                onClick={() => setShowQuoteModal(true)}
                style={{
                  background: t.brand.gold, color: '#000', border: 'none',
                  borderRadius: t.radius.md, padding: '9px 18px',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <DollarSign style={{ width: 14, height: 14 }} />
                Generuj wycenę
              </button>
            )}
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
          <p style={{ fontSize: 14, color: t.text.secondary, lineHeight: 1.7, margin: 0 }}>{audit.ai_summary}</p>
        )}
      </Card>

      {/* Score cards (5 main only) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
        {MAIN_CATEGORIES.map(cat => {
          const score = scores[cat.id] ?? 0
          const Icon = CATEGORY_ICONS[cat.id]
          return (
            <Card key={cat.id} style={{ padding: '14px 16px', textAlign: 'center' }}>
              <Icon style={{ width: 18, height: 18, color: scoreColor(score), margin: '0 auto 8px' }} />
              <div style={{ fontSize: 24, fontWeight: 800, color: scoreColor(score), lineHeight: 1 }}>{score}</div>
              <div style={{ fontSize: 10, color: t.text.muted, marginTop: 4, lineHeight: 1.3 }}>
                {cat.label.split(' ')[0]}
              </div>
            </Card>
          )
        })}
      </div>

      {/* Findings + quote items */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <AlertCircle style={{ width: 15, height: 15, color: t.text.muted }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: t.text.primary }}>Obserwacje ({findings.length})</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {findings.map((f, i) => (
              <div key={i} style={{
                padding: '10px 12px', backgroundColor: t.bg.muted,
                border: `1px solid ${t.border.default}`,
                borderLeft: `3px solid ${severityColor(f.severity)}`,
                borderRadius: t.radius.sm,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: severityColor(f.severity), textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {f.severity === 'high' ? 'Krytyczne' : f.severity === 'medium' ? 'Ważne' : 'Informacja'}
                  </span>
                  <span style={{ fontSize: 10, color: t.text.muted }}>· {f.category}</span>
                </div>
                <p style={{ fontSize: 12, color: t.text.secondary, margin: '0 0 6px', lineHeight: 1.5 }}>{f.finding}</p>
                <p style={{ fontSize: 12, color: t.semantic.success, margin: 0, lineHeight: 1.5 }}>→ {f.recommendation}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <DollarSign style={{ width: 15, height: 15, color: t.brand.gold }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: t.text.primary }}>Proponowane rozwiązania</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {quoteItems.sort((a, b) => a.priority - b.priority).map((item, i) => (
              <div key={i} style={{
                padding: '10px 12px', backgroundColor: t.bg.muted,
                border: `1px solid ${t.border.default}`, borderRadius: t.radius.sm,
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10,
              }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: t.text.primary, marginBottom: 2 }}>
                    {i + 1}. {item.name}
                  </div>
                  <div style={{ fontSize: 11, color: t.text.muted }}>{item.description}</div>
                  <span style={{
                    fontSize: 10, color: t.text.muted, backgroundColor: t.bg.overlay,
                    border: `1px solid ${t.border.default}`,
                    padding: '1px 6px', borderRadius: t.radius.full, display: 'inline-block', marginTop: 4,
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

      {showQuoteModal && (
        <CreateQuoteModal
          implementations={implementations}
          auditId={audit.id}
          onClose={() => setShowQuoteModal(false)}
          onCreated={() => setShowQuoteModal(false)}
        />
      )}
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
  const [answers, setAnswers] = useState<Record<string, string>>(existingAudit?.answers ?? {})
  const [contextData, setContextData] = useState<AuditContextData>(existingAudit?.context_data ?? {})

  // step: 0 = consultant zone, 1-5 = main categories, 6 = kontekst, 7 = review
  const [step, setStep] = useState(0)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)

  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const contextSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showResults = audit?.status === 'completed'
  const inWizard = auditId !== null || showResults
  const REVIEW_STEP = 7 // step index for review

  const startAudit = useCallback(async () => {
    if (auditId) return
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
      setStep(0) // start with consultant zone
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd serwera')
    } finally {
      setStarting(false)
    }
  }, [auditId, clientId, clientName])

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

  const saveContextData = useCallback((data: AuditContextData) => {
    if (!auditId) return
    if (contextSaveTimer.current) clearTimeout(contextSaveTimer.current)
    contextSaveTimer.current = setTimeout(async () => {
      await fetch(`/api/audits/${auditId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context_data: data }),
      })
    }, 800)
  }, [auditId])

  const handleAnswer = (qId: string, value: string) => {
    const next = { ...answers, [qId]: value }
    setAnswers(next)
    saveAnswers(next)
  }

  const handleContextChange = (data: AuditContextData) => {
    setContextData(data)
    saveContextData(data)
  }

  const goNext = async () => {
    if (step >= 1 && auditId) {
      await fetch(`/api/audits/${auditId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      })
    }
    setStep(s => Math.min(s + 1, REVIEW_STEP))
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
    setContextData({})
    setStep(0)
    setError(null)
  }

  // Map step to category index: step 1-5 = idx 0-4 (main), step 6 = idx 5 (kontekst)
  const getCategoryIdx = (s: number) => s - 1

  const stepLabel = (s: number) => {
    if (s === 0) return 'Strefa Konsultanta'
    if (s === REVIEW_STEP) return 'Przegląd'
    const cat = AUDIT_CATEGORIES[getCategoryIdx(s)]
    return cat?.label ?? ''
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        textarea { font-family: inherit; }
        textarea::placeholder { color: ${t.text.muted}; opacity: 0.7; }
        input[type="number"]::-webkit-inner-spin-button { opacity: 0.5; }
      `}</style>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => router.push(`/dashboard/clients/${clientId}`)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: t.text.muted, fontSize: 14, padding: 0 }}
          >
            <ArrowLeft style={{ width: 16, height: 16 }} />
            {clientName}
          </button>
          <span style={{ color: t.border.default }}>/</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: t.text.primary }}>Audyt Operacyjny</span>
        </div>
        {inWizard && !showResults && (
          <span style={{ fontSize: 12, color: t.text.muted }}>
            {stepLabel(step)} · Krok {step + 1} z {REVIEW_STEP + 1}
          </span>
        )}
      </div>

      {/* Landing */}
      {!inWizard && !showResults && (
        <Card style={{ maxWidth: 560 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              backgroundColor: 'rgba(196,154,46,0.12)', border: `1px solid rgba(196,154,46,0.25)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Sparkles style={{ width: 22, height: 22, color: t.brand.gold }} />
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, color: t.text.primary }}>Audyt Operacyjny AI</div>
              <div style={{ fontSize: 13, color: t.text.muted, marginTop: 2 }}>{clientName}</div>
            </div>
          </div>
          <p style={{ fontSize: 14, color: t.text.secondary, lineHeight: 1.7, marginBottom: 20 }}>
            29 pytań w 5 kategoriach + kontekst konsultanta. Claude przeanalizuje odpowiedzi i wygeneruje scoringi, obserwacje, wdrożenia z ROI i wycenę do zatwierdzenia.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
            {AUDIT_CATEGORIES.map(cat => {
              const Icon = CATEGORY_ICONS[cat.id]
              const isConsultant = cat.consultantOnly
              return (
                <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {isConsultant
                    ? <Lock style={{ width: 14, height: 14, color: '#818CF8' }} />
                    : <Icon style={{ width: 14, height: 14, color: t.brand.gold }} />
                  }
                  <span style={{ fontSize: 13, color: isConsultant ? '#818CF8' : t.text.muted }}>
                    <strong style={{ color: t.text.secondary }}>{cat.label}</strong>
                    {isConsultant ? ' — tylko konsultant' : ` — ${cat.description}`}
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
          {/* Progress dots for main categories (steps 1-5) */}
          {step >= 1 && step <= 5 && (
            <StepProgress current={step} answers={answers} />
          )}

          {/* Consultant zone indicator for step 0 */}
          {step === 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 16px', borderRadius: t.radius.full,
                backgroundColor: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)',
              }}>
                <Lock style={{ width: 12, height: 12, color: '#818CF8' }} />
                <span style={{ fontSize: 12, color: '#818CF8', fontWeight: 600 }}>Strefa Konsultanta — widoczna tylko dla Ciebie</span>
              </div>
            </div>
          )}

          {/* Kontekst step indicator */}
          {step === 6 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 16px', borderRadius: t.radius.full,
                backgroundColor: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)',
              }}>
                <Lock style={{ width: 12, height: 12, color: '#818CF8' }} />
                <span style={{ fontSize: 12, color: '#818CF8', fontWeight: 600 }}>Notatki konsultanta — niewidoczne dla klienta</span>
              </div>
            </div>
          )}

          <Card>
            {step === 0 && (
              <ConsultantContextStep contextData={contextData} onChange={handleContextChange} />
            )}
            {step >= 1 && step <= AUDIT_CATEGORIES.length && (
              <CategoryStep categoryIdx={getCategoryIdx(step)} answers={answers} onChange={handleAnswer} />
            )}
            {step === REVIEW_STEP && (
              <ReviewStep answers={answers} onAnalyze={analyze} analyzing={analyzing} />
            )}

            {error && (
              <div style={{ marginTop: 16, padding: '10px 14px', backgroundColor: t.semantic.errorBg, border: `1px solid ${t.semantic.errorBorder}`, borderRadius: t.radius.sm }}>
                <span style={{ fontSize: 13, color: t.semantic.error }}>{error}</span>
              </div>
            )}
          </Card>

          {/* Navigation */}
          {step < REVIEW_STEP && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                onClick={goPrev}
                disabled={step === 0}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'none', border: `1px solid ${t.border.default}`,
                  borderRadius: t.radius.md, padding: '9px 16px', fontSize: 13, fontWeight: 600,
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
                  fontSize: 13, fontWeight: 600, color: t.text.secondary, cursor: 'pointer',
                }}
              >
                {step === REVIEW_STEP - 1 ? 'Przejdź do przeglądu' : 'Następna'}
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
