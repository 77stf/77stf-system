'use client'

import { useState, useCallback } from 'react'
import { t } from '@/lib/tokens'
import { Plus, Trash2, ChevronDown, CheckSquare, Square, Loader2, CalendarDays } from 'lucide-react'
import { relativeTime } from '@/lib/format'
import { PlanPanel } from './plan-panel'

type IdeaCategory = 'implementation' | 'system_upgrade' | 'owner_idea' | 'tool' | 'integration'
type IdeaPriority = 'critical' | 'high' | 'medium' | 'low'
type IdeaStatus = 'new' | 'considering' | 'planned' | 'in_progress' | 'rejected' | 'done'
type IdeaSourceAgent = 'analyzer' | 'radar' | 'guardian' | 'second_brain' | 'manual'

interface Idea {
  id: string
  title: string
  category: IdeaCategory
  description?: string
  priority: IdeaPriority
  status: IdeaStatus
  source_agent?: IdeaSourceAgent
  source_url?: string
  effort_hours?: number
  roi_notes?: string
  metadata?: Record<string, unknown>
  created_at: string
  updated_at: string
}

interface PlanSession {
  session_number: number
  title: string
  goal: string
  idea_ids: string[]
  idea_titles: string[]
  idea_scores: { id: string; score: number; score_reason: string }[]
  duration_hours: number
  complexity: 'low' | 'medium' | 'high'
  prerequisites: string[]
  steps: string[]
  suggested_date: string
  suggested_time: string
  session_type: 'weekday' | 'weekend'
}

interface DevelopmentPlan {
  plan_title: string
  generated_at: string
  total_sessions: number
  total_hours: number
  priority_reasoning: string
  openrouter_tip: string | null
  sessions: PlanSession[]
}

const CATEGORY_LABELS: Record<IdeaCategory, string> = {
  implementation:  'Wdrożenie',
  system_upgrade:  'Ulepszenie systemu',
  owner_idea:      'Mój pomysł',
  tool:            'Narzędzie',
  integration:     'Integracja',
}

const PRIORITY_CONFIG: Record<IdeaPriority, { label: string; color: string; bg: string }> = {
  critical: { label: 'Krytyczny', color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
  high:     { label: 'Wysoki',    color: '#fb923c', bg: 'rgba(251,146,60,0.1)' },
  medium:   { label: 'Średni',    color: '#fbbf24', bg: 'rgba(251,191,36,0.1)' },
  low:      { label: 'Niski',     color: t.text.muted, bg: t.bg.muted },
}

const STATUS_CONFIG: Record<IdeaStatus, { label: string; color: string }> = {
  new:         { label: 'Nowy',        color: '#818CF8' },
  considering: { label: 'Do przemyśl.', color: '#fbbf24' },
  planned:     { label: 'Zaplanowany', color: '#22d3ee' },
  in_progress: { label: 'W trakcie',   color: '#fb923c' },
  rejected:    { label: 'Odrzucony',   color: t.text.muted },
  done:        { label: 'Zrobione',    color: '#4ade80' },
}

const SOURCE_LABELS: Record<IdeaSourceAgent, string> = {
  analyzer:     '🔬 Analizator',
  radar:        '📡 Radar',
  guardian:     '🛡️ Opiekun',
  second_brain: '🧠 Drugi Mózg',
  manual:       '✍️ Ręcznie',
}

const ACTIVE_STATUSES: IdeaStatus[] = ['new', 'considering', 'planned', 'in_progress']
const DONE_STATUSES: IdeaStatus[] = ['done', 'rejected']
const PLANNABLE_STATUSES: IdeaStatus[] = ['new', 'considering']

export function IdeasBoard({ initialIdeas }: { initialIdeas: Idea[] }) {
  const [ideas, setIdeas] = useState(initialIdeas)
  const [filterStatus, setFilterStatus] = useState<IdeaStatus | 'all'>('all')
  const [filterCategory, setFilterCategory] = useState<IdeaCategory | 'all'>('all')
  const [showNew, setShowNew] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newCategory, setNewCategory] = useState<IdeaCategory>('owner_idea')
  const [newPriority, setNewPriority] = useState<IdeaPriority>('medium')
  const [newDesc, setNewDesc] = useState('')
  const [creating, setCreating] = useState(false)
  const [showDone, setShowDone] = useState(false)

  // ─── Plan mode ───────────────────────────────────────────────────────────────
  const [planMode, setPlanMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [planning, setPlanning] = useState(false)
  const [plan, setPlan] = useState<DevelopmentPlan | null>(null)
  const [planMarkdown, setPlanMarkdown] = useState('')

  const filtered = ideas.filter(i => {
    if (filterStatus !== 'all' && i.status !== filterStatus) return false
    if (filterCategory !== 'all' && i.category !== filterCategory) return false
    return true
  })

  const active = filtered.filter(i => ACTIVE_STATUSES.includes(i.status))
  const done = filtered.filter(i => DONE_STATUSES.includes(i.status))

  // Ideas eligible for planning (not already planned/in_progress/done/rejected)
  const plannable = active.filter(i => PLANNABLE_STATUSES.includes(i.status))

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else if (next.size < 10) next.add(id)
      return next
    })
  }, [])

  const exitPlanMode = () => {
    setPlanMode(false)
    setSelectedIds(new Set())
  }

  const generatePlan = useCallback(async () => {
    if (selectedIds.size === 0) return
    setPlanning(true)

    const res = await fetch('/api/ideas/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idea_ids: [...selectedIds] }),
    })

    setPlanning(false)

    if (res.ok) {
      const { plan: generatedPlan, markdown } = await res.json() as { plan: DevelopmentPlan; markdown: string }
      setPlan(generatedPlan)
      setPlanMarkdown(markdown)
      // Update idea statuses locally
      setIdeas(prev => prev.map(idea =>
        selectedIds.has(idea.id) ? { ...idea, status: 'planned' as IdeaStatus } : idea
      ))
      exitPlanMode()
    }
  }, [selectedIds])

  async function createIdea() {
    if (!newTitle.trim()) return
    setCreating(true)
    const res = await fetch('/api/ideas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newTitle.trim(),
        category: newCategory,
        priority: newPriority,
        description: newDesc.trim() || undefined,
        source_agent: 'manual',
      }),
    })
    if (res.ok) {
      const { data } = await res.json() as { data: Idea }
      setIdeas(prev => [data, ...prev])
      setNewTitle(''); setNewDesc(''); setShowNew(false)
    }
    setCreating(false)
  }

  async function updateStatus(id: string, status: IdeaStatus) {
    const res = await fetch(`/api/ideas?id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) setIdeas(prev => prev.map(i => i.id === id ? { ...i, status } : i))
  }

  async function deleteIdea(id: string) {
    await fetch(`/api/ideas?id=${id}`, { method: 'DELETE' })
    setIdeas(prev => prev.filter(i => i.id !== id))
  }

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {!planMode && (
          <>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as IdeaStatus | 'all')}
              style={{ padding: '6px 10px', background: t.bg.input, border: `1px solid ${t.border.subtle}`, borderRadius: 7, fontSize: 12, color: t.text.secondary, outline: 'none' }}
            >
              <option value="all">Wszystkie statusy</option>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>

            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value as IdeaCategory | 'all')}
              style={{ padding: '6px 10px', background: t.bg.input, border: `1px solid ${t.border.subtle}`, borderRadius: 7, fontSize: 12, color: t.text.secondary, outline: 'none' }}
            >
              <option value="all">Wszystkie kategorie</option>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </>
        )}

        <div style={{ marginLeft: planMode ? 0 : 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {planMode ? (
            <>
              <span style={{ fontSize: 12, color: t.text.muted }}>
                {selectedIds.size === 0
                  ? 'Zaznacz pomysły do zaplanowania (maks. 10)'
                  : `Zaznaczono ${selectedIds.size} z ${plannable.length}`}
              </span>
              {selectedIds.size > 0 && (
                <button
                  onClick={() => void generatePlan()}
                  disabled={planning}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '7px 16px', borderRadius: 7,
                    background: planning ? t.bg.muted : 'rgba(129,140,248,0.85)',
                    border: 'none', color: planning ? t.text.muted : '#fff',
                    fontSize: 13, fontWeight: 600, cursor: planning ? 'not-allowed' : 'pointer',
                  }}
                >
                  {planning ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <CalendarDays size={13} />}
                  {planning ? 'Generuję plan...' : `Wygeneruj plan (${selectedIds.size})`}
                </button>
              )}
              <button
                onClick={exitPlanMode}
                style={{ padding: '7px 12px', borderRadius: 7, background: 'none', border: `1px solid ${t.border.subtle}`, color: t.text.muted, fontSize: 12, cursor: 'pointer' }}
              >
                Anuluj
              </button>
            </>
          ) : (
            <>
              {plannable.length > 0 && (
                <button
                  onClick={() => { setPlanMode(true); setShowNew(false) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 14px', borderRadius: 7,
                    background: 'rgba(129,140,248,0.1)', border: '1px solid rgba(129,140,248,0.25)',
                    color: '#818CF8', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  <CalendarDays size={13} /> Zaplanuj wdrożenia
                </button>
              )}
              <button
                onClick={() => setShowNew(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 14px', borderRadius: 7,
                  background: 'rgba(196,154,46,0.12)', border: '1px solid rgba(196,154,46,0.25)',
                  color: '#C49A2E', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                <Plus size={13} /> Nowy pomysł
              </button>
            </>
          )}
        </div>
      </div>

      {/* Plan mode hint */}
      {planMode && (
        <div style={{ padding: '10px 14px', background: 'rgba(129,140,248,0.05)', border: '1px solid rgba(129,140,248,0.15)', borderRadius: 8, marginBottom: 16, fontSize: 12, color: t.text.muted, lineHeight: 1.6 }}>
          <strong style={{ color: '#818CF8' }}>Tryb planowania:</strong> Zaznacz pomysły które chcesz wdrożyć. Claude wygeneruje konkretny plan sesji kodowania z krokami, oceną AI 1-10 i linkami do Google Kalendarza. Maks. 10 naraz.
        </div>
      )}

      {/* New idea form */}
      {showNew && !planMode && (
        <div style={{ background: t.bg.card, border: `1px solid ${t.border.default}`, borderRadius: 10, padding: '16px 18px', marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.text.primary, marginBottom: 12 }}>Nowy pomysł</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="Tytuł pomysłu..."
              style={{ padding: '8px 12px', background: t.bg.input, border: `1px solid ${t.border.subtle}`, borderRadius: 7, fontSize: 13, color: t.text.primary, outline: 'none' }}
            />
            <textarea
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              placeholder="Opis (opcjonalnie)..."
              rows={2}
              style={{ padding: '8px 12px', background: t.bg.input, border: `1px solid ${t.border.subtle}`, borderRadius: 7, fontSize: 12, color: t.text.primary, outline: 'none', resize: 'none', fontFamily: 'inherit' }}
            />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <select value={newCategory} onChange={e => setNewCategory(e.target.value as IdeaCategory)} style={{ padding: '7px 10px', background: t.bg.input, border: `1px solid ${t.border.subtle}`, borderRadius: 7, fontSize: 12, color: t.text.secondary, outline: 'none' }}>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select value={newPriority} onChange={e => setNewPriority(e.target.value as IdeaPriority)} style={{ padding: '7px 10px', background: t.bg.input, border: `1px solid ${t.border.subtle}`, borderRadius: 7, fontSize: 12, color: t.text.secondary, outline: 'none' }}>
                {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <button
                onClick={() => void createIdea()}
                disabled={creating || !newTitle.trim()}
                style={{ padding: '7px 16px', borderRadius: 7, background: (creating || !newTitle.trim()) ? t.bg.muted : '#C49A2E', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: (creating || !newTitle.trim()) ? 'not-allowed' : 'pointer' }}
              >
                {creating ? 'Zapisuję...' : 'Zapisz'}
              </button>
              <button onClick={() => setShowNew(false)} style={{ padding: '7px 12px', borderRadius: 7, background: 'none', border: `1px solid ${t.border.subtle}`, color: t.text.muted, fontSize: 12, cursor: 'pointer' }}>Anuluj</button>
            </div>
          </div>
        </div>
      )}

      {/* Active ideas */}
      {active.length === 0 && !showNew ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', border: `1px dashed ${t.border.subtle}`, borderRadius: 10, color: t.text.muted, fontSize: 13 }}>
          Brak pomysłów. Dodaj pierwszy lub zapytaj Drugi Mózg: &quot;Zapisz pomysł&quot;.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
          {active.map(idea => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              onStatusChange={updateStatus}
              onDelete={deleteIdea}
              planMode={planMode}
              selected={selectedIds.has(idea.id)}
              onToggleSelect={toggleSelect}
              plannable={PLANNABLE_STATUSES.includes(idea.status)}
            />
          ))}
        </div>
      )}

      {/* Done/rejected section */}
      {done.length > 0 && !planMode && (
        <div style={{ marginTop: 24 }}>
          <button
            onClick={() => setShowDone(p => !p)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: t.text.muted, fontSize: 12, cursor: 'pointer', padding: '4px 0', marginBottom: 10 }}
          >
            <ChevronDown size={13} style={{ transform: showDone ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} />
            Zakończone i odrzucone ({done.length})
          </button>
          {showDone && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12, opacity: 0.6 }}>
              {done.map(idea => (
                <IdeaCard key={idea.id} idea={idea} onStatusChange={updateStatus} onDelete={deleteIdea} planMode={false} selected={false} onToggleSelect={() => void 0} plannable={false} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Plan panel modal */}
      {plan && (
        <PlanPanel
          plan={plan}
          markdown={planMarkdown}
          onClose={() => setPlan(null)}
        />
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}

// ─── IdeaCard ─────────────────────────────────────────────────────────────────

function IdeaCard({ idea, onStatusChange, onDelete, planMode, selected, onToggleSelect, plannable }: {
  idea: Idea
  onStatusChange: (id: string, status: IdeaStatus) => void
  onDelete: (id: string) => void
  planMode: boolean
  selected: boolean
  onToggleSelect: (id: string) => void
  plannable: boolean
}) {
  const pc = PRIORITY_CONFIG[idea.priority]
  const sc = STATUS_CONFIG[idea.status]

  const nextStatuses: Partial<Record<IdeaStatus, IdeaStatus>> = {
    new: 'considering', considering: 'planned', planned: 'in_progress', in_progress: 'done',
  }
  const next = nextStatuses[idea.status]

  // Score from metadata (from analyzer)
  const meta = idea.metadata as Record<string, unknown> | null
  const score = meta?.relevance_score as number | undefined

  return (
    <div
      onClick={planMode && plannable ? () => onToggleSelect(idea.id) : undefined}
      style={{
        background: t.bg.card,
        border: `1px solid ${selected ? 'rgba(129,140,248,0.5)' : t.border.subtle}`,
        borderRadius: 10,
        padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10,
        cursor: planMode && plannable ? 'pointer' : 'default',
        boxShadow: selected ? '0 0 0 2px rgba(129,140,248,0.2)' : 'none',
        transition: 'border-color 0.12s, box-shadow 0.12s',
        opacity: planMode && !plannable ? 0.5 : 1,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        {/* Plan mode checkbox */}
        {planMode && (
          <div style={{ flexShrink: 0, marginTop: 1 }}>
            {plannable
              ? (selected
                  ? <CheckSquare size={16} style={{ color: '#818CF8' }} />
                  : <Square size={16} style={{ color: t.text.muted }} />)
              : <Square size={16} style={{ color: t.border.subtle }} />
            }
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.text.primary, lineHeight: 1.35 }}>
            {idea.title}
          </div>
          <div style={{ fontSize: 11, color: t.text.muted, marginTop: 3 }}>
            {CATEGORY_LABELS[idea.category]}
            {idea.source_agent && idea.source_agent !== 'manual' && (
              <span style={{ marginLeft: 8, opacity: 0.8 }}>{SOURCE_LABELS[idea.source_agent]}</span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {/* AI score badge */}
          {score !== undefined && (
            <span style={{
              fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 20,
              background: score >= 7 ? 'rgba(74,222,128,0.1)' : score >= 4 ? 'rgba(251,191,36,0.1)' : 'rgba(248,113,113,0.1)',
              color: score >= 7 ? '#4ade80' : score >= 4 ? '#fbbf24' : '#f87171',
              border: `1px solid ${score >= 7 ? 'rgba(74,222,128,0.25)' : score >= 4 ? 'rgba(251,191,36,0.25)' : 'rgba(248,113,113,0.25)'}`,
            }}>
              AI {score}/10
            </span>
          )}
          <span style={{ fontSize: 10, fontWeight: 700, color: pc.color, background: pc.bg, borderRadius: 20, padding: '2px 8px' }}>
            {pc.label}
          </span>
        </div>
      </div>

      {idea.description && !planMode && (
        <div style={{ fontSize: 12, color: t.text.secondary, lineHeight: 1.55 }}>
          {idea.description}
        </div>
      )}

      {idea.roi_notes && !planMode && (
        <div style={{ fontSize: 11, color: t.text.muted, fontStyle: 'italic' }}>
          ROI: {idea.roi_notes}
        </div>
      )}

      {/* Footer */}
      {!planMode && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: sc.color, borderRadius: 20, padding: '2px 8px', background: 'rgba(255,255,255,0.05)' }}>
            {sc.label}
          </span>
          <span style={{ fontSize: 10, color: t.text.muted }}>{relativeTime(idea.created_at)}</span>
          {idea.effort_hours && (
            <span style={{ fontSize: 10, color: t.text.muted }}>{idea.effort_hours}h</span>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 5 }}>
            {next && (
              <button
                onClick={() => onStatusChange(idea.id, next)}
                style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(129,140,248,0.1)', border: '1px solid rgba(129,140,248,0.2)', color: '#818CF8', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}
              >
                {STATUS_CONFIG[next].label}
              </button>
            )}
            {idea.status !== 'rejected' && idea.status !== 'done' && (
              <button
                onClick={() => onStatusChange(idea.id, 'rejected')}
                style={{ padding: '4px 8px', borderRadius: 6, background: 'none', border: `1px solid ${t.border.subtle}`, color: t.text.muted, fontSize: 10, cursor: 'pointer' }}
              >
                Odrzuć
              </button>
            )}
            <button
              onClick={() => onDelete(idea.id)}
              style={{ padding: '4px 7px', borderRadius: 6, background: 'none', border: `1px solid ${t.border.subtle}`, color: t.text.muted, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              <Trash2 size={10} />
            </button>
          </div>
        </div>
      )}

      {/* Plan mode footer — show idea info compactly */}
      {planMode && plannable && (
        <div style={{ fontSize: 11, color: selected ? '#818CF8' : t.text.muted }}>
          {selected ? '✓ Zaznaczono do planu' : 'Kliknij aby zaznaczyć'}
          {idea.effort_hours && <span style={{ marginLeft: 8 }}>{idea.effort_hours}h</span>}
        </div>
      )}
    </div>
  )
}
