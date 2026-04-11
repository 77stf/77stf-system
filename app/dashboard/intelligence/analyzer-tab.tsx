'use client'

import { useState, useCallback, useRef } from 'react'
import { FlaskConical, Link, FileText, Image, Send, X, Plus, ExternalLink, CheckCircle, XCircle, MinusCircle, Lightbulb } from 'lucide-react'
import { t } from '@/lib/tokens'

// ─── Types ────────────────────────────────────────────────────────────────────

interface WhatIsIt {
  name: string
  category: string
  description: string
  official_url: string | null
}

interface ClientFit {
  fit: boolean
  reason: string
  roi_estimate: string | null
}

interface Alternative {
  name: string
  why_better: string
  pricing: string
}

interface IdeaUpgrade {
  what_owner_really_wants: string
  exists_as_tool: string | null
  variant_simple: { description: string; effort: string }
  variant_medium: { description: string; effort: string }
  variant_advanced: { description: string; effort: string }
  pomysl_2_0: string
  roi_estimate: string
}

interface AnalysisResult {
  what_is_it: WhatIsIt | null
  relevance_score: number
  relevance_reasoning: string
  quick_verdict: 'WDROZ' | 'MONITORUJ' | 'POMIN'
  system_comparison: {
    already_have: string[]
    gap: string
    replaces_or_extends: string
  } | null
  client_matrix: {
    avvlo: ClientFit
    petro_lawa: ClientFit
    galenos_hk: ClientFit
    new_clients: ClientFit
  } | null
  pros: string[] | null
  cons: string[] | null
  alternatives: Alternative[] | null
  is_implementation_best: {
    verdict: 'tak' | 'nie' | 'zależy'
    explanation: string
    better_approach: string | null
  } | null
  recommendation: {
    decision: string
    reasoning: string
    effort_hours: number
    next_steps: string[]
    connect_with: string[]
  } | null
  idea_upgrade: IdeaUpgrade | null
}

type InputMode = 'url' | 'text' | 'image'

// ─── Verdict config ───────────────────────────────────────────────────────────

const VERDICT_CONFIG = {
  WDROZ:    { label: 'Wdróż',    color: '#4ade80', bg: 'rgba(74,222,128,0.1)',    border: 'rgba(74,222,128,0.25)' },
  MONITORUJ: { label: 'Monitoruj', color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',   border: 'rgba(251,191,36,0.25)' },
  POMIN:    { label: 'Pomiń',    color: t.text.muted, bg: t.bg.muted,             border: t.border.subtle },
}

const CATEGORY_LABELS: Record<string, string> = {
  ai_agent:   'Agent AI',
  automation: 'Automatyzacja',
  voice:      'Voice',
  chatbot:    'Chatbot',
  analytics:  'Analityka',
  social:     'Social Media',
  crm:        'CRM',
  other:      'Inne',
}

// ─── Small helper components ──────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: t.text.muted, marginBottom: 10 }}>
      {label}
    </div>
  )
}

function Box({ children, accent }: { children: React.ReactNode; accent?: string }) {
  return (
    <div style={{
      background: t.bg.card,
      border: `1px solid ${t.border.subtle}`,
      borderLeft: accent ? `3px solid ${accent}` : undefined,
      borderRadius: t.radius.md,
      padding: '16px 18px',
    }}>
      {children}
    </div>
  )
}

function ClientRow({ label, client }: { label: string; client: ClientFit }) {
  const color = client.fit ? '#4ade80' : t.text.muted
  const Icon = client.fit ? CheckCircle : XCircle
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, paddingBottom: 10, borderBottom: `1px solid ${t.border.subtle}` }}>
      <Icon size={14} style={{ color, flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: t.text.primary }}>{label}</div>
        <div style={{ fontSize: 11, color: t.text.secondary, lineHeight: 1.5, marginTop: 2 }}>{client.reason}</div>
        {client.roi_estimate && (
          <div style={{ fontSize: 11, color: '#C49A2E', marginTop: 3 }}>ROI: {client.roi_estimate}</div>
        )}
      </div>
    </div>
  )
}

// ─── Score ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const color = score >= 7 ? '#4ade80' : score >= 4 ? '#fbbf24' : t.semantic.error
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <div style={{
        width: 56, height: 56, borderRadius: '50%',
        border: `3px solid ${color}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `${color}10`,
      }}>
        <span style={{ fontSize: 20, fontWeight: 800, color }}>{score}</span>
      </div>
      <span style={{ fontSize: 9, color: t.text.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>/10</span>
    </div>
  )
}

// ─── Full report display ──────────────────────────────────────────────────────

function AnalysisReport({ result, ideaId, onSaveIdea }: {
  result: AnalysisResult
  ideaId: string | null
  onSaveIdea: () => void
}) {
  const verdict = result.quick_verdict
  const vc = VERDICT_CONFIG[verdict] ?? VERDICT_CONFIG.MONITORUJ
  const isFullReport = result.relevance_score >= 4

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Header — verdict + score */}
      <div style={{
        background: vc.bg, border: `1px solid ${vc.border}`,
        borderRadius: t.radius.md, padding: '18px 22px',
        display: 'flex', alignItems: 'center', gap: 20,
      }}>
        <ScoreRing score={result.relevance_score} />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: vc.color }}>{vc.label.toUpperCase()}</span>
            {result.what_is_it && (
              <span style={{ fontSize: 11, fontWeight: 600, color: t.text.muted, padding: '2px 8px', background: t.bg.muted, borderRadius: t.radius.full, border: `1px solid ${t.border.subtle}` }}>
                {CATEGORY_LABELS[result.what_is_it.category] ?? result.what_is_it.category}
              </span>
            )}
          </div>
          <div style={{ fontSize: 13, color: t.text.secondary, lineHeight: 1.6 }}>{result.relevance_reasoning}</div>
        </div>
        {!ideaId && verdict === 'WDROZ' && (
          <button
            onClick={onSaveIdea}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: t.radius.sm,
              background: 'rgba(196,154,46,0.12)', border: '1px solid rgba(196,154,46,0.25)',
              color: '#C49A2E', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
            }}
          >
            <Plus size={12} /> Dodaj do pomysłów
          </button>
        )}
        {ideaId && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#4ade80' }}>
            <CheckCircle size={14} /> Zapisano
          </div>
        )}
      </div>

      {/* Box 1 — What is it */}
      {result.what_is_it && (
        <Box>
          <SectionHeader label="Co to jest" />
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: t.text.primary, marginBottom: 4 }}>{result.what_is_it.name}</div>
              <div style={{ fontSize: 13, color: t.text.secondary, lineHeight: 1.65 }}>{result.what_is_it.description}</div>
            </div>
            {result.what_is_it.official_url && (
              <a href={result.what_is_it.official_url} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#818CF8', textDecoration: 'none', flexShrink: 0, padding: '4px 10px', borderRadius: t.radius.sm, border: '1px solid rgba(129,140,248,0.25)', background: 'rgba(129,140,248,0.08)' }}
              >
                <ExternalLink size={11} /> Strona
              </a>
            )}
          </div>
        </Box>
      )}

      {/* Short report if score < 4 */}
      {!isFullReport && (
        <div style={{ textAlign: 'center', padding: '16px', color: t.text.muted, fontSize: 13 }}>
          Niski wynik trafności — pomijamy szczegółowy raport dla tej treści.
        </div>
      )}

      {/* Full 8-box report */}
      {isFullReport && (
        <>
          {/* Box 3 — System comparison */}
          {result.system_comparison && (
            <Box accent="#818CF8">
              <SectionHeader label="Porównanie z systemem 77STF" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {result.system_comparison.already_have.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, color: t.text.muted, marginBottom: 4 }}>Już mamy:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {result.system_comparison.already_have.map((item, i) => (
                        <span key={i} style={{ fontSize: 11, padding: '2px 8px', borderRadius: t.radius.full, background: t.bg.muted, border: `1px solid ${t.border.subtle}`, color: t.text.secondary }}>{item}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 11, color: t.text.muted, marginBottom: 4 }}>Gap / uzupełnienie:</div>
                  <div style={{ fontSize: 12, color: t.text.secondary, lineHeight: 1.6 }}>{result.system_comparison.gap}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: t.text.muted }}>Relacja:</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#818CF8', padding: '2px 8px', borderRadius: t.radius.full, background: 'rgba(129,140,248,0.1)', border: '1px solid rgba(129,140,248,0.2)' }}>
                    {result.system_comparison.replaces_or_extends}
                  </span>
                </div>
              </div>
            </Box>
          )}

          {/* Box 4 — Client matrix */}
          {result.client_matrix && (
            <Box>
              <SectionHeader label="Matrix klientów — kto zyska" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <ClientRow label="Avvlo (farmacja)" client={result.client_matrix.avvlo} />
                <ClientRow label="Petro-Lawa (paliwo/transport)" client={result.client_matrix.petro_lawa} />
                <ClientRow label="Galenos HK (farmacja)" client={result.client_matrix.galenos_hk} />
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  {result.client_matrix.new_clients.fit ? <CheckCircle size={14} style={{ color: '#4ade80', flexShrink: 0, marginTop: 2 }} /> : <MinusCircle size={14} style={{ color: t.text.muted, flexShrink: 0, marginTop: 2 }} />}
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: t.text.primary }}>Nowi klienci</div>
                    <div style={{ fontSize: 11, color: t.text.secondary, lineHeight: 1.5, marginTop: 2 }}>{result.client_matrix.new_clients.reason}</div>
                  </div>
                </div>
              </div>
            </Box>
          )}

          {/* Box 5 — Pros & cons */}
          {(result.pros || result.cons) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {result.pros && result.pros.length > 0 && (
                <Box accent="#4ade80">
                  <SectionHeader label="Zalety" />
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {result.pros.map((p, i) => (
                      <li key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: t.text.secondary, lineHeight: 1.55 }}>
                        <span style={{ color: '#4ade80', flexShrink: 0 }}>+</span>{p}
                      </li>
                    ))}
                  </ul>
                </Box>
              )}
              {result.cons && result.cons.length > 0 && (
                <Box accent={t.semantic.error}>
                  <SectionHeader label="Wady" />
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {result.cons.map((c, i) => (
                      <li key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: t.text.secondary, lineHeight: 1.55 }}>
                        <span style={{ color: t.semantic.error, flexShrink: 0 }}>−</span>{c}
                      </li>
                    ))}
                  </ul>
                </Box>
              )}
            </div>
          )}

          {/* Box 6 — Alternatives */}
          {result.alternatives && result.alternatives.length > 0 && (
            <Box>
              <SectionHeader label="TOP 3 alternatywy — czy to naprawdę najlepsze?" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {result.alternatives.map((alt, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 12px', background: t.bg.muted, borderRadius: t.radius.sm, border: `1px solid ${t.border.subtle}` }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: t.text.muted, flexShrink: 0, width: 20, textAlign: 'center', marginTop: 1 }}>{i + 1}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: t.text.primary, marginBottom: 2 }}>{alt.name}</div>
                      <div style={{ fontSize: 11, color: t.text.secondary, lineHeight: 1.55 }}>{alt.why_better}</div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: t.radius.full, background: t.bg.card, border: `1px solid ${t.border.subtle}`, color: t.text.muted, flexShrink: 0, alignSelf: 'flex-start' }}>
                      {alt.pricing}
                    </span>
                  </div>
                ))}
              </div>
            </Box>
          )}

          {/* Box 7 — Is implementation best? */}
          {result.is_implementation_best && (
            <Box accent={result.is_implementation_best.verdict === 'tak' ? '#4ade80' : result.is_implementation_best.verdict === 'nie' ? t.semantic.error : '#fbbf24'}>
              <SectionHeader label="Czy to najlepsze wdrożenie? Build vs Buy?" />
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{ padding: '4px 12px', borderRadius: t.radius.full, fontSize: 12, fontWeight: 700, flexShrink: 0,
                  background: result.is_implementation_best.verdict === 'tak' ? 'rgba(74,222,128,0.1)' : result.is_implementation_best.verdict === 'nie' ? 'rgba(248,113,113,0.1)' : 'rgba(251,191,36,0.1)',
                  color: result.is_implementation_best.verdict === 'tak' ? '#4ade80' : result.is_implementation_best.verdict === 'nie' ? t.semantic.error : '#fbbf24',
                  border: `1px solid ${result.is_implementation_best.verdict === 'tak' ? 'rgba(74,222,128,0.25)' : result.is_implementation_best.verdict === 'nie' ? 'rgba(248,113,113,0.25)' : 'rgba(251,191,36,0.25)'}`,
                }}>
                  {result.is_implementation_best.verdict.toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 13, color: t.text.secondary, lineHeight: 1.65, marginBottom: result.is_implementation_best.better_approach ? 8 : 0 }}>
                    {result.is_implementation_best.explanation}
                  </div>
                  {result.is_implementation_best.better_approach && (
                    <div style={{ fontSize: 12, color: '#fbbf24', lineHeight: 1.6, padding: '8px 12px', background: 'rgba(251,191,36,0.05)', borderRadius: t.radius.sm, border: '1px solid rgba(251,191,36,0.15)' }}>
                      Lepsze podejście: {result.is_implementation_best.better_approach}
                    </div>
                  )}
                </div>
              </div>
            </Box>
          )}

          {/* Box 8 — Recommendation */}
          {result.recommendation && (
            <Box accent="#C49A2E">
              <SectionHeader label="Rekomendacja i następne kroki" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 13, color: t.text.secondary, lineHeight: 1.65 }}>{result.recommendation.reasoning}</div>
                {result.recommendation.effort_hours > 0 && (
                  <div style={{ fontSize: 12, color: t.text.muted }}>
                    Szacowany nakład: <span style={{ color: t.text.primary, fontWeight: 600 }}>{result.recommendation.effort_hours}h</span>
                  </div>
                )}
                {result.recommendation.next_steps.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, color: t.text.muted, marginBottom: 6 }}>Następne kroki:</div>
                    <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {result.recommendation.next_steps.map((step, i) => (
                        <li key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: t.text.secondary }}>
                          <span style={{ color: '#C49A2E', fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>{step}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                {result.recommendation.connect_with.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, color: t.text.muted, marginBottom: 6 }}>Połącz z:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {result.recommendation.connect_with.map((item, i) => (
                        <span key={i} style={{ fontSize: 11, padding: '2px 9px', borderRadius: t.radius.full, background: 'rgba(196,154,46,0.1)', border: '1px solid rgba(196,154,46,0.25)', color: '#C49A2E' }}>{item}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Box>
          )}

          {/* Idea Upgrade — own idea mode */}
          {result.idea_upgrade && (
            <Box accent="#818CF8">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Lightbulb size={14} style={{ color: '#818CF8' }} />
                <SectionHeader label="Twój pomysł 2.0 — Analizator ulepszył go 1000x" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: t.text.muted, marginBottom: 4 }}>Co naprawdę chcesz osiągnąć:</div>
                  <div style={{ fontSize: 13, color: t.text.primary, lineHeight: 1.65, fontWeight: 500 }}>{result.idea_upgrade.what_owner_really_wants}</div>
                </div>
                {result.idea_upgrade.exists_as_tool && (
                  <div style={{ fontSize: 12, color: '#fbbf24', padding: '8px 12px', background: 'rgba(251,191,36,0.05)', borderRadius: t.radius.sm, border: '1px solid rgba(251,191,36,0.15)' }}>
                    Gotowe narzędzie które to robi: <strong>{result.idea_upgrade.exists_as_tool}</strong>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  {([
                    { label: 'Wariant prosty', v: result.idea_upgrade.variant_simple },
                    { label: 'Wariant średni', v: result.idea_upgrade.variant_medium },
                    { label: 'Wariant zaawansowany', v: result.idea_upgrade.variant_advanced },
                  ] as const).map(({ label, v }) => (
                    <div key={label} style={{ padding: '12px', background: t.bg.muted, borderRadius: t.radius.sm, border: `1px solid ${t.border.subtle}` }}>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#818CF8', marginBottom: 4 }}>{label}</div>
                      <div style={{ fontSize: 11, color: t.text.secondary, lineHeight: 1.55, marginBottom: 6 }}>{v.description}</div>
                      <div style={{ fontSize: 10, color: t.text.muted }}>{v.effort}</div>
                    </div>
                  ))}
                </div>
                <div>
                  <div style={{ fontSize: 11, color: t.text.muted, marginBottom: 4 }}>Rozbudowana wizja:</div>
                  <div style={{ fontSize: 13, color: t.text.secondary, lineHeight: 1.7 }}>{result.idea_upgrade.pomysl_2_0}</div>
                </div>
                <div style={{ fontSize: 12, color: '#4ade80', padding: '8px 12px', background: 'rgba(74,222,128,0.05)', borderRadius: t.radius.sm, border: '1px solid rgba(74,222,128,0.15)' }}>
                  ROI: {result.idea_upgrade.roi_estimate}
                </div>
              </div>
            </Box>
          )}
        </>
      )}
    </div>
  )
}

// ─── Main AnalyzerTab component ───────────────────────────────────────────────

export function AnalyzerTab() {
  const [mode, setMode] = useState<InputMode>('url')
  const [input, setInput] = useState('')
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [imageName, setImageName] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState('')
  const [ideaId, setIdeaId] = useState<string | null>(null)
  const [analysisId, setAnalysisId] = useState<string | null>(null)
  const [savingIdea, setSavingIdea] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageName(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const b64 = ev.target?.result as string
      setImageBase64(b64)
    }
    reader.readAsDataURL(file)
  }, [])

  const analyze = useCallback(async () => {
    const inp = mode === 'image' ? imageBase64 : input.trim()
    if (!inp) return

    setAnalyzing(true)
    setError('')
    setResult(null)
    setIdeaId(null)
    setAnalysisId(null)

    try {
      const res = await fetch('/api/intelligence/analyze-implementation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: inp,
          input_type: mode,
        }),
      })

      if (res.ok) {
        const data = await res.json() as {
          analysis: AnalysisResult
          analysis_id: string | null
          idea_id: string | null
          is_own_idea: boolean
        }
        setResult(data.analysis)
        setAnalysisId(data.analysis_id)
        setIdeaId(data.idea_id)
      } else {
        const { error: msg } = await res.json() as { error: string }
        setError(msg ?? 'Błąd analizy')
      }
    } catch {
      setError('Błąd połączenia — spróbuj ponownie.')
    }

    setAnalyzing(false)
  }, [mode, input, imageBase64])

  const saveIdea = useCallback(async () => {
    if (!result || !analysisId) return
    setSavingIdea(true)

    const res = await fetch('/api/intelligence/analyze-implementation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: input.trim() || (imageBase64 ?? ''),
        input_type: mode,
        save_to_ideas: true,
      }),
    })

    if (res.ok) {
      const data = await res.json() as { idea_id: string | null }
      if (data.idea_id) setIdeaId(data.idea_id)
    }
    setSavingIdea(false)
  }, [result, analysisId, input, imageBase64, mode])

  const clear = useCallback(() => {
    setResult(null)
    setInput('')
    setImageBase64(null)
    setImageName('')
    setError('')
    setIdeaId(null)
    setAnalysisId(null)
  }, [])

  const canSubmit = mode === 'image' ? !!imageBase64 : input.trim().length > 5

  return (
    <div style={{ maxWidth: 860 }}>
      <p style={{ color: t.text.muted, fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
        Wklej cokolwiek — link do rolki na IG, strony narzędzia, Reddit thread, screenshot lub własny pomysł.
        Analizator porówna to z całym systemem 77STF, oceni czy wdrożenie jest optymalne i wyliczy ROI per klient.
      </p>

      {/* Mode tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {([
          { id: 'url' as InputMode, label: 'Link / URL', icon: Link },
          { id: 'text' as InputMode, label: 'Tekst / pomysł', icon: FileText },
          { id: 'image' as InputMode, label: 'Screenshot', icon: Image },
        ]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => { setMode(id); setResult(null); setError('') }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: t.radius.sm,
              background: mode === id ? 'rgba(129,140,248,0.15)' : 'transparent',
              border: `1px solid ${mode === id ? 'rgba(129,140,248,0.35)' : t.border.subtle}`,
              color: mode === id ? '#818CF8' : t.text.muted,
              fontSize: 12, fontWeight: mode === id ? 600 : 400, cursor: 'pointer',
            }}
          >
            <Icon size={12} /> {label}
          </button>
        ))}
      </div>

      {/* Input area */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {mode === 'image' ? (
          <div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
            {imageBase64 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: t.bg.input, border: `1px solid ${t.border.default}`, borderRadius: t.radius.md }}>
                <Image size={16} style={{ color: '#818CF8' }} />
                <span style={{ flex: 1, fontSize: 13, color: t.text.secondary }}>{imageName}</span>
                <button onClick={() => { setImageBase64(null); setImageName('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.text.muted, display: 'flex', alignItems: 'center' }}>
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                style={{
                  width: '100%', padding: '32px 20px', borderRadius: t.radius.md,
                  background: t.bg.input, border: `2px dashed ${t.border.default}`,
                  color: t.text.muted, fontSize: 13, cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                }}
              >
                <Image size={24} />
                Kliknij aby wybrać screenshot
              </button>
            )}
          </div>
        ) : (
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void analyze() }}
            rows={mode === 'text' ? 5 : 3}
            placeholder={mode === 'url'
              ? 'https://instagram.com/reel/... lub https://youtube.com/... lub dowolny URL'
              : 'Opisz swój pomysł... Analizator oceni go, sprawdzi czy istnieje gotowe narzędzie i zaproponuje ulepszoną wersję 2.0'
            }
            style={{
              width: '100%', boxSizing: 'border-box',
              background: t.bg.input, border: `1px solid ${t.border.default}`,
              borderRadius: t.radius.md, padding: '12px 14px',
              color: t.text.primary, fontSize: 13, lineHeight: 1.6,
              outline: 'none', resize: 'vertical', fontFamily: 'inherit',
            }}
          />
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={() => void analyze()}
            disabled={analyzing || !canSubmit}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              background: (analyzing || !canSubmit) ? t.bg.muted : 'rgba(129,140,248,0.85)',
              border: 'none', borderRadius: t.radius.sm, padding: '9px 20px',
              color: (analyzing || !canSubmit) ? t.text.muted : '#fff',
              fontSize: 13, fontWeight: 700, cursor: (analyzing || !canSubmit) ? 'not-allowed' : 'pointer',
            }}
          >
            <FlaskConical size={14} />
            {analyzing ? 'Analizuję...' : 'Analizuj'}
          </button>
          {result && (
            <button onClick={clear} style={{ background: 'none', border: `1px solid ${t.border.subtle}`, borderRadius: t.radius.sm, padding: '8px 14px', color: t.text.muted, fontSize: 12, cursor: 'pointer' }}>
              Wyczyść
            </button>
          )}
          <span style={{ fontSize: 11, color: t.text.muted, marginLeft: 'auto' }}>
            {analyzing ? 'Sonnet analizuje — 15-25 sek.' : 'Sonnet · Ctrl+Enter · limit 15/min'}
          </span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ color: t.semantic.error, background: t.semantic.errorBg, border: `1px solid ${t.semantic.errorBorder}`, borderRadius: t.radius.sm, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Loading state */}
      {analyzing && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '24px 0' }}>
          {[180, 120, 200, 100].map((w, i) => (
            <div key={i} style={{ height: 14, borderRadius: 6, background: t.bg.muted, width: w, opacity: 0.6 }} />
          ))}
        </div>
      )}

      {/* Report */}
      {result && !analyzing && (
        <AnalysisReport result={result} ideaId={ideaId} onSaveIdea={savingIdea ? () => void 0 : () => void saveIdea()} />
      )}

      {/* Send to ideas button if saved */}
      {ideaId && (
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle size={14} style={{ color: '#4ade80' }} />
          <span style={{ fontSize: 12, color: '#4ade80' }}>Zapisano do Pomysłów</span>
          <a href="/dashboard/ideas" style={{ fontSize: 12, color: '#818CF8', textDecoration: 'none', marginLeft: 4 }}>
            Otwórz Pomysły →
          </a>
        </div>
      )}

      {/* Hint about own idea mode */}
      {!result && !analyzing && mode === 'text' && (
        <div style={{ padding: '12px 16px', background: 'rgba(129,140,248,0.05)', border: '1px solid rgba(129,140,248,0.15)', borderRadius: t.radius.md, fontSize: 12, color: t.text.muted, lineHeight: 1.6 }}>
          <Send size={12} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle', color: '#818CF8' }} />
          Tryb <strong style={{ color: '#818CF8' }}>Ulepsz mój pomysł</strong> — opisz swój pomysł po polsku.
          Analizator zidentyfikuje co naprawdę chcesz osiągnąć, sprawdzi czy istnieje gotowe narzędzie
          i zaproponuje wariant prosty (1-2h), średni i zaawansowany + rozbudowaną wizję.
        </div>
      )}
    </div>
  )
}
