'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  Zap, Link2, Brain, Database, Mic, BarChart2,
  RefreshCw, ChevronDown, ChevronUp, ArrowRight,
  AlertTriangle, CheckCircle2, Clock, Layers,
} from 'lucide-react'
import { t } from '@/lib/tokens'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface WatchlistTool {
  name: string
  category: string
  status: string
  description: string
  client_count: number
  metadata: Record<string, unknown>
}

interface UpdateCheckResult {
  tool_name: string
  has_update: boolean
  update_title?: string
  update_summary?: string
  recommendation?: string
  severity?: 'major' | 'minor' | 'patch'
  version_info?: string
  checked_at: string
}

type CheckState = 'idle' | 'checking' | 'done' | 'error'

// ─── Config ────────────────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  automation: Zap,
  integration: Link2,
  ai_agent: Brain,
  data: Database,
  voice: Mic,
  reporting: BarChart2,
}

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  automation:  { label: 'Automatyzacja', color: '#F59E0B' },
  integration: { label: 'Integracja',    color: '#60A5FA' },
  ai_agent:    { label: 'AI Agent',      color: '#818CF8' },
  data:        { label: 'Dane',          color: '#34D399' },
  voice:       { label: 'Głos',          color: '#F87171' },
  reporting:   { label: 'Raportowanie',  color: '#A78BFA' },
}

const SEVERITY_CONFIG = {
  major: { label: 'Duża zmiana', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)' },
  minor: { label: 'Nowe funkcje', color: '#818CF8', bg: 'rgba(129,140,248,0.1)', border: 'rgba(129,140,248,0.25)' },
  patch: { label: 'Poprawki', color: '#34D399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.25)' },
}

// ─── Tool card ─────────────────────────────────────────────────────────────────

function ToolCard({
  tool,
  checkState,
  result,
  onCheck,
}: {
  tool: WatchlistTool
  checkState: CheckState
  result: UpdateCheckResult | null
  onCheck: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const Icon = CATEGORY_ICONS[tool.category] ?? Layers
  const catConfig = CATEGORY_LABELS[tool.category] ?? { label: tool.category, color: t.text.muted }
  const sev = result?.severity ? SEVERITY_CONFIG[result.severity] : null
  const hasUpdate = result?.has_update === true
  const checked = checkState === 'done'
  const checking = checkState === 'checking'

  // Determine border accent color
  let borderTop: string = t.border.subtle
  if (checked && hasUpdate) borderTop = SEVERITY_CONFIG[result!.severity ?? 'minor'].color
  else if (checked && !hasUpdate) borderTop = '#34D399'

  return (
    <div style={{
      background: t.bg.card,
      border: `1px solid ${t.border.default}`,
      borderTop: `3px solid ${borderTop}`,
      borderRadius: t.radius.md,
      padding: '16px 18px',
      display: 'flex', flexDirection: 'column', gap: 10,
      transition: 'border-color 0.3s',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{
          width: 34, height: 34, borderRadius: t.radius.sm,
          background: `${catConfig.color}15`,
          border: `1px solid ${catConfig.color}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon size={15} style={{ color: catConfig.color }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: t.text.primary }}>{tool.name}</span>
            {/* Status badge */}
            {checked && hasUpdate && sev && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: t.radius.full,
                color: sev.color, background: sev.bg, border: `1px solid ${sev.border}`,
                textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                {sev.label}
              </span>
            )}
            {checked && !hasUpdate && (
              <span style={{
                fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: t.radius.full,
                color: '#34D399', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)',
                textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>Aktualne</span>
            )}
          </div>
          <div style={{ fontSize: 11, color: t.text.muted, marginTop: 2 }}>
            <span style={{ color: catConfig.color }}>{catConfig.label}</span>
            {' · '}
            <span>{tool.client_count} {tool.client_count === 1 ? 'klient' : 'klientów'}</span>
            {result?.version_info && (
              <><span> · </span><span style={{ fontFamily: 'monospace', color: t.text.secondary }}>{result.version_info}</span></>
            )}
          </div>
        </div>

        {/* Check button */}
        <button
          onClick={onCheck}
          disabled={checking}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'transparent', border: `1px solid ${t.border.subtle}`,
            borderRadius: t.radius.sm, padding: '5px 10px',
            color: t.text.muted, fontSize: 11, fontWeight: 600,
            cursor: checking ? 'not-allowed' : 'pointer',
            flexShrink: 0, transition: 'all 0.15s',
            opacity: checking ? 0.6 : 1,
          }}
          title="Sprawdź aktualizacje"
        >
          <RefreshCw size={11} style={{ animation: checking ? 'spin 1s linear infinite' : 'none' }} />
          {checking ? 'Sprawdzam...' : checked ? 'Odśwież' : 'Sprawdź'}
        </button>
      </div>

      {/* Description */}
      {tool.description && (
        <p style={{ fontSize: 12, color: t.text.secondary, lineHeight: 1.55, margin: 0 }}>
          {tool.description}
        </p>
      )}

      {/* Update details (expandable) */}
      {checked && hasUpdate && result && (
        <div style={{
          background: `${SEVERITY_CONFIG[result.severity ?? 'minor'].color}08`,
          border: `1px solid ${SEVERITY_CONFIG[result.severity ?? 'minor'].border}`,
          borderRadius: t.radius.sm, padding: '12px 14px',
        }}>
          <button
            onClick={() => setExpanded(e => !e)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', background: 'none', border: 'none',
              cursor: 'pointer', padding: 0,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: t.text.primary }}>{result.update_title}</span>
            {expanded ? <ChevronUp size={14} style={{ color: t.text.muted }} /> : <ChevronDown size={14} style={{ color: t.text.muted }} />}
          </button>

          {expanded && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {result.update_summary && (
                <p style={{ fontSize: 12, color: t.text.secondary, lineHeight: 1.55, margin: 0 }}>
                  {result.update_summary}
                </p>
              )}
              {result.recommendation && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: 12 }}>
                  <ArrowRight size={12} style={{ color: SEVERITY_CONFIG[result.severity ?? 'minor'].color, flexShrink: 0, marginTop: 2 }} />
                  <span style={{ color: t.text.secondary }}>{result.recommendation}</span>
                </div>
              )}
              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <a
                  href={`/dashboard/intelligence?tab=analyzer&prefill=${encodeURIComponent(result.update_title ?? tool.name)}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    fontSize: 11, fontWeight: 600, padding: '5px 11px',
                    borderRadius: t.radius.sm, textDecoration: 'none',
                    background: `${SEVERITY_CONFIG[result.severity ?? 'minor'].color}18`,
                    border: `1px solid ${SEVERITY_CONFIG[result.severity ?? 'minor'].border}`,
                    color: SEVERITY_CONFIG[result.severity ?? 'minor'].color,
                  }}
                >
                  <Brain size={10} /> Analizuj głębiej
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Up to date indicator */}
      {checked && !hasUpdate && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: '#34D399' }}>
          <CheckCircle2 size={12} />
          <span>Brak znanych aktualizacji — narzędzie aktualne na kwiecień 2026</span>
        </div>
      )}

      {/* Checked timestamp */}
      {checked && result?.checked_at && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: t.text.muted }}>
          <Clock size={9} />
          <span>Sprawdzono: {new Date(result.checked_at).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      )}
    </div>
  )
}

// ─── Summary strip ─────────────────────────────────────────────────────────────

function SummaryStrip({
  tools,
  checkStates,
  results,
}: {
  tools: WatchlistTool[]
  checkStates: Record<string, CheckState>
  results: Record<string, UpdateCheckResult>
}) {
  const checkedCount = Object.values(checkStates).filter(s => s === 'done').length
  const updatesFound = Object.values(results).filter(r => r.has_update).length
  const majorCount = Object.values(results).filter(r => r.has_update && r.severity === 'major').length

  if (checkedCount === 0) return null

  return (
    <div style={{
      display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap',
    }}>
      {[
        { label: 'Sprawdzonych', value: `${checkedCount} / ${tools.length}`, color: t.text.secondary },
        { label: 'Aktualizacji', value: String(updatesFound), color: updatesFound > 0 ? '#F59E0B' : '#34D399' },
        { label: 'Ważnych zmian', value: String(majorCount), color: majorCount > 0 ? '#F87171' : t.text.muted },
      ].map(s => (
        <div key={s.label} style={{
          background: t.bg.card, border: `1px solid ${t.border.subtle}`,
          borderRadius: t.radius.md, padding: '10px 16px',
          flex: '1 1 100px',
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: t.text.muted, marginBottom: 3 }}>{s.label}</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export function TechMonitorTab() {
  const [tools, setTools] = useState<WatchlistTool[]>([])
  const [loading, setLoading] = useState(true)
  const [checkStates, setCheckStates] = useState<Record<string, CheckState>>({})
  const [results, setResults] = useState<Record<string, UpdateCheckResult>>({})
  const [checkingAll, setCheckingAll] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/intelligence/tech-monitor')
      .then(r => r.ok ? r.json() as Promise<{ tools: WatchlistTool[] }> : null)
      .then(d => {
        if (d?.tools) setTools(d.tools)
        setLoading(false)
      })
      .catch(() => { setLoading(false); setError('Błąd ładowania narzędzi') })
  }, [])

  const checkTool = useCallback(async (toolName: string, description?: string, category?: string) => {
    setCheckStates(prev => ({ ...prev, [toolName]: 'checking' }))
    try {
      const res = await fetch('/api/intelligence/tech-monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool_name: toolName, description, category }),
      })
      if (!res.ok) throw new Error('API error')
      const data = await res.json() as { results: UpdateCheckResult[] }
      const result = data.results?.[0]
      if (result) {
        setResults(prev => ({ ...prev, [toolName]: result }))
      }
      setCheckStates(prev => ({ ...prev, [toolName]: 'done' }))
    } catch {
      setCheckStates(prev => ({ ...prev, [toolName]: 'error' }))
    }
  }, [])

  const checkAll = useCallback(async () => {
    if (tools.length === 0 || checkingAll) return
    setCheckingAll(true)
    setError('')

    // Check in batches of 5 to avoid rate limits
    const batchSize = 5
    for (let i = 0; i < tools.length; i += batchSize) {
      const batch = tools.slice(i, i + batchSize)
      batch.forEach(tool => setCheckStates(prev => ({ ...prev, [tool.name]: 'checking' })))

      try {
        const res = await fetch('/api/intelligence/tech-monitor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tools: batch.map(tool => ({ name: tool.name, description: tool.description, category: tool.category })),
          }),
        })
        if (res.ok) {
          const data = await res.json() as { results: UpdateCheckResult[] }
          for (const result of (data.results ?? [])) {
            setResults(prev => ({ ...prev, [result.tool_name]: result }))
            setCheckStates(prev => ({ ...prev, [result.tool_name]: 'done' }))
          }
          // Mark any that didn't get a result as done too
          batch.forEach(tool => {
            setCheckStates(prev => prev[tool.name] === 'checking' ? { ...prev, [tool.name]: 'done' } : prev)
          })
        } else {
          batch.forEach(tool => setCheckStates(prev => ({ ...prev, [tool.name]: 'error' })))
        }
      } catch {
        batch.forEach(tool => setCheckStates(prev => ({ ...prev, [tool.name]: 'error' })))
      }

      // Small pause between batches
      if (i + batchSize < tools.length) {
        await new Promise(resolve => setTimeout(resolve, 800))
      }
    }
    setCheckingAll(false)
  }, [tools, checkingAll])

  // Group tools by category
  const byCategory = tools.reduce<Record<string, WatchlistTool[]>>((acc, tool) => {
    const cat = tool.category
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(tool)
    return acc
  }, {})

  const updatesFound = Object.values(results).filter(r => r.has_update).length

  return (
    <div style={{ maxWidth: 960 }}>
      {/* Description */}
      <p style={{ color: t.text.muted, fontSize: 13, marginBottom: 18, lineHeight: 1.6 }}>
        Monitoruj aktualizacje narzędzi z Twojego i klientów stacku. Kliknij &quot;Sprawdź wszystkie&quot; — Claude przegląda znane zmiany do kwietnia 2026 i oznacza narzędzia z dostępnymi aktualizacjami.
      </p>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <button
          onClick={checkAll}
          disabled={checkingAll || loading || tools.length === 0}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: checkingAll ? 'rgba(129,140,248,0.08)' : 'rgba(129,140,248,0.15)',
            border: '1px solid rgba(129,140,248,0.35)',
            borderRadius: t.radius.sm, padding: '8px 16px',
            color: '#818CF8', fontSize: 13, fontWeight: 600,
            cursor: (checkingAll || loading || tools.length === 0) ? 'not-allowed' : 'pointer',
            opacity: (checkingAll || loading || tools.length === 0) ? 0.6 : 1,
          }}
        >
          <RefreshCw size={13} style={{ animation: checkingAll ? 'spin 1s linear infinite' : 'none' }} />
          {checkingAll ? 'Sprawdzam wszystkie...' : `Sprawdź wszystkie (${tools.length})`}
        </button>

        {updatesFound > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
            borderRadius: t.radius.sm, padding: '7px 14px',
            color: '#F59E0B', fontSize: 12, fontWeight: 600,
          }}>
            <AlertTriangle size={12} />
            {updatesFound} {updatesFound === 1 ? 'aktualizacja' : 'aktualizacji'} do wdrożenia
          </div>
        )}
      </div>

      {/* Summary */}
      <SummaryStrip tools={tools} checkStates={checkStates} results={results} />

      {/* Error */}
      {error && (
        <div style={{ fontSize: 13, color: t.semantic.error, marginBottom: 16 }}>{error}</div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ color: t.text.muted, fontSize: 13 }}>Ładowanie watchlisty...</div>
      )}

      {/* Empty state */}
      {!loading && tools.length === 0 && (
        <div style={{
          background: t.bg.card, border: `1px solid ${t.border.subtle}`,
          borderRadius: t.radius.md, padding: '32px 24px', textAlign: 'center',
        }}>
          <Layers size={28} style={{ color: t.text.muted, margin: '0 auto 12px' }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: t.text.secondary, marginBottom: 6 }}>
            Brak narzędzi w watchliście
          </div>
          <div style={{ fontSize: 12, color: t.text.muted, lineHeight: 1.6 }}>
            Dodaj wdrożenia do klientów w Stack Intelligence — pojawią się tutaj automatycznie.
          </div>
        </div>
      )}

      {/* Tools grouped by category */}
      {!loading && tools.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {Object.entries(byCategory).map(([cat, catTools]) => {
            const catConfig = CATEGORY_LABELS[cat] ?? { label: cat, color: t.text.muted }
            return (
              <div key={cat}>
                <div style={{
                  fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.15em', color: catConfig.color,
                  marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <span style={{ width: 4, height: 4, borderRadius: '50%', background: catConfig.color, display: 'inline-block' }} />
                  {catConfig.label} ({catTools.length})
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
                  {catTools.map(tool => (
                    <ToolCard
                      key={tool.name}
                      tool={tool}
                      checkState={checkStates[tool.name] ?? 'idle'}
                      result={results[tool.name] ?? null}
                      onCheck={() => checkTool(tool.name, tool.description, tool.category)}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}
