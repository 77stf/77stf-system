'use client'

import { useState } from 'react'
import { X, Calendar, Download, Copy, Check, ChevronDown, ChevronUp, Clock, Target, Zap, AlertCircle } from 'lucide-react'
import { t } from '@/lib/tokens'

// ─── Types ────────────────────────────────────────────────────────────────────

interface IdeaScore {
  id: string
  score: number
  score_reason: string
}

interface PlanSession {
  session_number: number
  title: string
  goal: string
  idea_ids: string[]
  idea_titles: string[]
  idea_scores: IdeaScore[]
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

interface PlanPanelProps {
  plan: DevelopmentPlan
  markdown: string
  onClose: () => void
}

// ─── Config ───────────────────────────────────────────────────────────────────

const COMPLEXITY_CONFIG = {
  low:    { label: 'Łatwa',    color: '#4ade80', dot: '🟢' },
  medium: { label: 'Średnia',  color: '#fbbf24', dot: '🟡' },
  high:   { label: 'Trudna',   color: '#f87171', dot: '🔴' },
}

const SCORE_COLOR = (score: number) =>
  score >= 8 ? '#4ade80' : score >= 5 ? '#fbbf24' : t.semantic.error

// ─── Calendar link generator ──────────────────────────────────────────────────

function buildCalendarLink(session: PlanSession): string {
  const [year, month, day] = session.suggested_date.split('-').map(Number)
  const [startH, startM] = session.suggested_time.split(':').map(Number)

  const startDate = new Date(year, month - 1, day, startH, startM, 0)
  const endDate = new Date(startDate.getTime() + session.duration_hours * 60 * 60 * 1000)

  const pad = (n: number) => String(n).padStart(2, '0')
  const fmt = (d: Date) =>
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`

  const title = encodeURIComponent(`77STF Dev: ${session.title}`)
  const details = encodeURIComponent(
    `🎯 Cel: ${session.goal}\n\n` +
    `Kroki:\n${session.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n` +
    `Pomysły: ${session.idea_titles.join(', ')}`
  )

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${fmt(startDate)}%2F${fmt(endDate)}&details=${details}&ctz=Europe%2FWarsaw`
}

// ─── Session card ─────────────────────────────────────────────────────────────

function SessionCard({ session, index }: { session: PlanSession; index: number }) {
  const [expanded, setExpanded] = useState(index === 0) // first session expanded by default
  const cx = COMPLEXITY_CONFIG[session.complexity] ?? COMPLEXITY_CONFIG.medium
  const calendarLink = buildCalendarLink(session)

  const dateFormatted = new Date(session.suggested_date + 'T12:00:00').toLocaleDateString('pl-PL', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  return (
    <div style={{
      background: t.bg.card,
      border: `1px solid ${t.border.subtle}`,
      borderLeft: `3px solid ${cx.color}`,
      borderRadius: t.radius.md,
      overflow: 'hidden',
    }}>
      {/* Header — always visible */}
      <div
        onClick={() => setExpanded(p => !p)}
        style={{ padding: '16px 18px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 14 }}
      >
        {/* Session number */}
        <div style={{
          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
          background: `${cx.color}15`, border: `2px solid ${cx.color}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 800, color: cx.color,
        }}>
          {session.session_number}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: t.text.primary }}>{session.title}</span>
            <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: t.radius.full, background: `${cx.color}15`, border: `1px solid ${cx.color}30`, color: cx.color }}>
              {cx.label}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: t.text.muted, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Calendar size={11} /> {dateFormatted}, {session.suggested_time}
            </span>
            <span style={{ fontSize: 11, color: t.text.muted, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={11} /> {session.duration_hours}h
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <a
            href={calendarLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 12px', borderRadius: t.radius.sm,
              background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.25)',
              color: '#4ade80', fontSize: 11, fontWeight: 600, textDecoration: 'none',
            }}
          >
            <Calendar size={11} /> Google Cal
          </a>
          {expanded ? <ChevronUp size={14} style={{ color: t.text.muted }} /> : <ChevronDown size={14} style={{ color: t.text.muted }} />}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ padding: '0 18px 16px 64px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Goal */}
          <div style={{ padding: '10px 14px', background: 'rgba(129,140,248,0.06)', border: '1px solid rgba(129,140,248,0.15)', borderRadius: t.radius.sm }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#818CF8', marginBottom: 4 }}>Cel sesji</div>
            <div style={{ fontSize: 13, color: t.text.secondary, lineHeight: 1.65 }}>{session.goal}</div>
          </div>

          {/* Idea scores */}
          {session.idea_scores.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: t.text.muted, marginBottom: 8 }}>Wdrażane pomysły z oceną AI:</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {session.idea_scores.map((sc) => {
                  const title = session.idea_titles[session.idea_ids.indexOf(sc.id)] ?? 'Pomysł'
                  return (
                    <div key={sc.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                        background: `${SCORE_COLOR(sc.score)}15`,
                        border: `2px solid ${SCORE_COLOR(sc.score)}40`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 800, color: SCORE_COLOR(sc.score),
                      }}>
                        {sc.score}
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: t.text.primary }}>{title}</div>
                        <div style={{ fontSize: 11, color: t.text.muted, lineHeight: 1.5 }}>{sc.score_reason}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Prerequisites */}
          {session.prerequisites.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: t.text.muted, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                <AlertCircle size={11} style={{ color: '#fbbf24' }} /> Przed sesją przygotuj:
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
                {session.prerequisites.map((p, i) => (
                  <li key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: t.text.secondary }}>
                    <span style={{ color: '#fbbf24', flexShrink: 0 }}>□</span>{p}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Steps */}
          <div>
            <div style={{ fontSize: 11, color: t.text.muted, marginBottom: 8 }}>Kroki:</div>
            <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
              {session.steps.map((step, i) => (
                <li key={i} style={{ display: 'flex', gap: 10, fontSize: 12, color: t.text.secondary, lineHeight: 1.6 }}>
                  <span style={{
                    width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                    background: t.bg.muted, border: `1px solid ${t.border.subtle}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700, color: t.text.muted,
                    marginTop: 1,
                  }}>
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main PlanPanel component ─────────────────────────────────────────────────

export function PlanPanel({ plan, markdown, onClose }: PlanPanelProps) {
  const [copied, setCopied] = useState(false)

  const handleCopyMarkdown = async () => {
    await navigator.clipboard.writeText(markdown)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const blob = new Blob([markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `77STF-plan-${new Date().toISOString().slice(0, 10)}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const generatedDate = new Date(plan.generated_at).toLocaleDateString('pl-PL', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '32px 16px', overflowY: 'auto',
    }}>
      <div style={{
        background: t.bg.page, border: `1px solid ${t.border.default}`,
        borderRadius: 16, width: '100%', maxWidth: 780,
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: `1px solid ${t.border.subtle}`,
          display: 'flex', alignItems: 'flex-start', gap: 16,
        }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: t.text.primary, margin: '0 0 4px' }}>
              {plan.plan_title}
            </h2>
            <p style={{ fontSize: 12, color: t.text.muted, margin: 0 }}>
              Wygenerowano: {generatedDate} · {plan.total_sessions} sesje · {plan.total_hours}h łącznie
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              onClick={handleCopyMarkdown}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 12px', borderRadius: t.radius.sm,
                background: 'transparent', border: `1px solid ${t.border.subtle}`,
                color: t.text.muted, fontSize: 11, cursor: 'pointer',
              }}
            >
              {copied ? <Check size={11} style={{ color: '#4ade80' }} /> : <Copy size={11} />}
              {copied ? 'Skopiowano' : 'Kopiuj .md'}
            </button>
            <button
              onClick={handleDownload}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 12px', borderRadius: t.radius.sm,
                background: 'transparent', border: `1px solid ${t.border.subtle}`,
                color: t.text.muted, fontSize: 11, cursor: 'pointer',
              }}
            >
              <Download size={11} /> Pobierz .md
            </button>
            <button
              onClick={onClose}
              style={{
                width: 28, height: 28, borderRadius: t.radius.sm,
                background: 'transparent', border: `1px solid ${t.border.subtle}`,
                color: t.text.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Stats strip */}
        <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${t.border.subtle}` }}>
          {[
            { icon: Zap, label: 'Sesje',  value: String(plan.total_sessions), color: '#818CF8' },
            { icon: Clock, label: 'Godzin', value: `${plan.total_hours}h`,      color: '#fbbf24' },
            { icon: Target, label: 'Pomysły', value: String(plan.sessions.reduce((a, s) => a + s.idea_ids.length, 0)), color: '#4ade80' },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} style={{ flex: 1, padding: '14px 20px', textAlign: 'center', borderRight: `1px solid ${t.border.subtle}` }}>
              <Icon size={14} style={{ color, margin: '0 auto 4px' }} />
              <div style={{ fontSize: 18, fontWeight: 800, color }}>{value}</div>
              <div style={{ fontSize: 10, color: t.text.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
            </div>
          ))}
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Priority reasoning */}
          <div style={{ padding: '12px 16px', background: t.bg.muted, borderRadius: t.radius.sm, border: `1px solid ${t.border.subtle}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: t.text.muted, marginBottom: 6 }}>Dlaczego ta kolejność</div>
            <p style={{ fontSize: 13, color: t.text.secondary, lineHeight: 1.65, margin: 0 }}>{plan.priority_reasoning}</p>
          </div>

          {/* OpenRouter tip */}
          {plan.openrouter_tip && (
            <div style={{ padding: '10px 14px', background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: t.radius.sm }}>
              <div style={{ fontSize: 11, color: '#fbbf24', lineHeight: 1.6 }}>
                💡 <strong>OpenRouter:</strong> {plan.openrouter_tip}
              </div>
            </div>
          )}

          {/* Sessions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {plan.sessions.map((session, i) => (
              <SessionCard key={session.session_number} session={session} index={i} />
            ))}
          </div>

          {/* Footer note */}
          <div style={{ fontSize: 11, color: t.text.muted, textAlign: 'center', paddingTop: 4 }}>
            Plan zapisany · Pomysły oznaczone jako &quot;Zaplanowane&quot; · Edytuj w /dashboard/ideas
          </div>
        </div>
      </div>
    </div>
  )
}
