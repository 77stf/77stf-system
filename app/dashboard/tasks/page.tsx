'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { t } from '@/lib/tokens'
import { formatDate, relativeTime } from '@/lib/format'
import type { Task, TaskPriority, TaskStatus } from '@/lib/types'
import {
  Plus, CheckSquare, Clock, AlertCircle, Trash2, Check, Circle,
  List, LayoutGrid, Calendar, Table2, ArrowUpCircle
} from 'lucide-react'

// ─── Constants ───────────────────────────────────────────────────────────────

type ViewMode = 'list' | 'board' | 'calendar' | 'table'

interface NewTaskForm {
  title: string
  description: string
  priority: TaskPriority
  due_date: string
  client_id: string
}

const EMPTY_FORM: NewTaskForm = {
  title: '', description: '', priority: 'medium', due_date: '', client_id: '',
}

const PRIORITY_ORDER: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 }

function priorityColor(p: TaskPriority) {
  if (p === 'high') return t.semantic.error
  if (p === 'medium') return t.semantic.warning
  return t.text.muted
}
function priorityLabel(p: TaskPriority) {
  if (p === 'high') return 'Wysoki'
  if (p === 'medium') return 'Średni'
  return 'Niski'
}
function statusLabel(s: TaskStatus) {
  if (s === 'in_progress') return 'W toku'
  if (s === 'done') return 'Gotowe'
  return 'Do zrobienia'
}

// ─── Shared input style ───────────────────────────────────────────────────────

const inputSt: React.CSSProperties = {
  background: t.bg.input, border: `1px solid ${t.border.default}`,
  borderRadius: t.radius.sm, padding: '8px 12px',
  color: t.text.primary, fontSize: 13, outline: 'none',
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)
  const [error, setError] = useState('')
  const [view, setView] = useState<ViewMode>('list')
  const [filterStatus, setFilterStatus] = useState<'' | TaskStatus>('')
  const [filterPriority, setFilterPriority] = useState<'' | TaskPriority>('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [form, setForm] = useState<NewTaskForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchTasks = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const p = new URLSearchParams()
      if (filterStatus) p.set('status', filterStatus)
      if (filterPriority) p.set('priority', filterPriority)
      const res = await fetch(`/api/tasks?${p}`)
      const json = await res.json()
      if (json.table_missing) { setTableMissing(true); setTasks([]); return }
      if (!res.ok) { setError(json.error ?? 'Błąd'); return }
      setTasks(json.tasks ?? [])
    } catch { setError('Błąd sieci') } finally { setLoading(false) }
  }, [filterStatus, filterPriority])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  // ── Sort tasks ────────────────────────────────────────────────────────────
  const sorted = useMemo(() =>
    [...tasks].sort((a, b) => {
      const pa = PRIORITY_ORDER[a.priority as TaskPriority] ?? 1
      const pb = PRIORITY_ORDER[b.priority as TaskPriority] ?? 1
      if (pa !== pb) return pa - pb
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date)
      if (a.due_date) return -1
      if (b.due_date) return 1
      return 0
    }), [tasks])

  // ── Toggle done ───────────────────────────────────────────────────────────
  async function toggleDone(task: Task) {
    const newStatus: TaskStatus = task.status === 'done' ? 'todo' : 'done'
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t))
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (!res.ok) {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: task.status } : t))
    } else {
      const json = await res.json()
      if (json.task) setTasks(prev => prev.map(t => t.id === task.id ? json.task : t))
    }
  }

  // ── Move to status (board) ────────────────────────────────────────────────
  async function moveToStatus(task: Task, newStatus: TaskStatus) {
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t))
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (!res.ok) {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: task.status } : t))
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function deleteTask(id: string) {
    if (!confirm('Usunąć zadanie?')) return
    setDeletingId(id)
    const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    if (res.ok) setTasks(prev => prev.filter(t => t.id !== id))
    setDeletingId(null)
  }

  // ── Add task ──────────────────────────────────────────────────────────────
  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title, description: form.description || undefined,
          priority: form.priority, due_date: form.due_date || undefined,
          client_id: form.client_id || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) { alert(json.error ?? 'Błąd zapisu'); return }
      setTasks(prev => [json.task, ...prev])
      setForm(EMPTY_FORM); setShowAddForm(false)
    } finally { setSaving(false) }
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  const todo = tasks.filter(t => t.status === 'todo').length
  const inProgress = tasks.filter(t => t.status === 'in_progress').length
  const done = tasks.filter(t => t.status === 'done').length
  const overdue = tasks.filter(t =>
    t.status !== 'done' && t.due_date && new Date(t.due_date) < new Date()
  ).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: t.text.primary, letterSpacing: '-0.03em', margin: 0 }}>
            Zadania
          </h1>
          <p style={{ fontSize: 13, color: t.text.muted, margin: '4px 0 0', letterSpacing: '-0.01em' }}>
            Follow-upy, akcje i zadania do wykonania
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(s => !s)}
          style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px',
            background: t.brand.gradient, border: 'none', borderRadius: t.radius.sm,
            color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            boxShadow: t.shadow.btn,
          }}
        >
          <Plus style={{ width: 14, height: 14 }} />
          Nowe zadanie
        </button>
      </div>

      {/* ── Stats row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {[
          { label: 'Do zrobienia', value: todo, icon: Circle, color: t.text.secondary },
          { label: 'W toku', value: inProgress, icon: ArrowUpCircle, color: t.semantic.info },
          { label: 'Ukończone', value: done, icon: CheckSquare, color: t.semantic.success },
          { label: 'Przeterminowane', value: overdue, icon: AlertCircle, color: overdue > 0 ? t.semantic.error : t.text.muted },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} style={{
            background: t.bg.card, border: `1px solid ${t.border.default}`,
            borderRadius: t.radius.md, padding: '16px 18px',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: t.radius.sm, background: t.bg.muted,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon style={{ width: 16, height: 16, color }} />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 600, color: t.text.primary, letterSpacing: '-0.03em', lineHeight: 1 }}>
                {value}
              </div>
              <div style={{ fontSize: 11, color: t.text.muted, marginTop: 3 }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Add task form ── */}
      {showAddForm && (
        <form onSubmit={handleAdd} style={{
          background: t.bg.card, border: `1px solid ${t.border.default}`,
          borderRadius: t.radius.md, padding: '20px',
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.text.primary, marginBottom: 14 }}>Nowe zadanie</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 140px', gap: 10, marginBottom: 10 }}>
            <input
              type="text" placeholder="Tytuł zadania..." value={form.title} required
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              style={{ ...inputSt, boxSizing: 'border-box' as const }}
            />
            <select
              value={form.priority}
              onChange={e => setForm(f => ({ ...f, priority: e.target.value as TaskPriority }))}
              style={inputSt}
            >
              <option value="low">Niski</option>
              <option value="medium">Średni</option>
              <option value="high">Wysoki</option>
            </select>
            <input
              type="date" value={form.due_date}
              onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
              style={{ ...inputSt, colorScheme: 'dark' as const }}
            />
          </div>
          <input
            type="text" placeholder="Opis (opcjonalnie)..." value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            style={{ ...inputSt, width: '100%', boxSizing: 'border-box' as const, marginBottom: 12 }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" disabled={saving || !form.title.trim()} style={{
              padding: '8px 18px', background: t.brand.gradient, border: 'none',
              borderRadius: t.radius.sm, color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1,
            }}>
              {saving ? 'Zapisywanie…' : 'Zapisz'}
            </button>
            <button type="button" onClick={() => { setShowAddForm(false); setForm(EMPTY_FORM) }} style={{
              padding: '8px 14px', background: 'none', border: `1px solid ${t.border.default}`,
              borderRadius: t.radius.sm, color: t.text.secondary, fontSize: 13, cursor: 'pointer',
            }}>
              Anuluj
            </button>
          </div>
        </form>
      )}

      {/* ── View toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        {/* View switcher */}
        <div style={{
          display: 'flex', background: t.bg.card,
          border: `1px solid ${t.border.default}`, borderRadius: t.radius.sm, overflow: 'hidden',
        }}>
          {([
            { id: 'list' as ViewMode, icon: List, label: 'Lista' },
            { id: 'board' as ViewMode, icon: LayoutGrid, label: 'Board' },
            { id: 'calendar' as ViewMode, icon: Calendar, label: 'Kalendarz' },
            { id: 'table' as ViewMode, icon: Table2, label: 'Tabela' },
          ] as const).map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setView(id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', border: 'none',
                background: view === id ? t.bg.cardHover : 'transparent',
                color: view === id ? t.text.primary : t.text.muted,
                fontSize: 12, fontWeight: view === id ? 600 : 400,
                cursor: 'pointer', borderRight: `1px solid ${t.border.subtle}`,
                transition: 'background 100ms, color 100ms',
              }}
            >
              <Icon style={{ width: 13, height: 13 }} />
              {label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* Status filter (for list/table view) */}
        {(view === 'list' || view === 'table') && (
          <div style={{ display: 'flex', gap: 6 }}>
            {(['', 'todo', 'in_progress', 'done'] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                style={{
                  padding: '5px 12px', fontSize: 11, fontWeight: 500,
                  borderRadius: t.radius.sm,
                  border: `1px solid ${filterStatus === s ? t.border.strong : t.border.default}`,
                  background: filterStatus === s ? t.bg.cardHover : 'none',
                  color: filterStatus === s ? t.text.primary : t.text.secondary,
                  cursor: 'pointer',
                }}
              >
                {s === '' ? 'Wszystkie' : statusLabel(s as TaskStatus)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Content ── */}
      {tableMissing ? (
        <MigrationBanner />
      ) : loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <div style={{
          background: t.semantic.errorBg, border: `1px solid ${t.semantic.errorBorder}`,
          borderRadius: t.radius.md, padding: '16px 20px', color: t.semantic.error, fontSize: 13,
        }}>
          {error}
        </div>
      ) : (
        <>
          {view === 'list' && <ListView tasks={sorted} onToggle={toggleDone} onDelete={deleteTask} deletingId={deletingId} />}
          {view === 'board' && <BoardView tasks={sorted} onMove={moveToStatus} onDelete={deleteTask} deletingId={deletingId} />}
          {view === 'calendar' && <CalendarView tasks={sorted} />}
          {view === 'table' && <TableView tasks={sorted} onToggle={toggleDone} onDelete={deleteTask} deletingId={deletingId} />}
        </>
      )}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:.45} 50%{opacity:.75} }
      `}</style>
    </div>
  )
}

// ─── Migration Banner ─────────────────────────────────────────────────────────

function MigrationBanner() {
  return (
    <div style={{
      background: t.semantic.warningBg, border: `1px solid ${t.semantic.warningBorder}`,
      borderRadius: t.radius.md, padding: '20px 24px',
    }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: t.semantic.warning, marginBottom: 6 }}>
        Tabela zadań nie istnieje
      </div>
      <div style={{ fontSize: 13, color: t.text.secondary }}>
        Uruchom <code style={{ color: t.text.primary }}>scripts/migrations/001_quotes_tasks.sql</code> w Supabase SQL Editor.
      </div>
    </div>
  )
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {[1, 2, 3, 4].map(i => (
        <div key={i} style={{
          height: 56, background: t.bg.card, border: `1px solid ${t.border.subtle}`,
          borderRadius: t.radius.sm, animation: 'pulse 1.5s ease-in-out infinite',
          opacity: 1 - i * 0.18,
        }} />
      ))}
    </div>
  )
}

// ─── Shared props for view components ────────────────────────────────────────

interface RowProps {
  onToggle: (task: Task) => void
  onDelete: (id: string) => void
  deletingId: string | null
}

// ─── LIST VIEW ────────────────────────────────────────────────────────────────

function ListView({ tasks, onToggle, onDelete, deletingId }: RowProps & { tasks: Task[] }) {
  if (tasks.length === 0) return <EmptyState />
  return (
    <div style={{
      background: t.bg.card, border: `1px solid ${t.border.default}`,
      borderRadius: t.radius.md, overflow: 'hidden',
    }}>
      {tasks.map((task, i) => {
        const isDone = task.status === 'done'
        const isOverdue = !isDone && task.due_date && new Date(task.due_date) < new Date()
        const isDeleting = deletingId === task.id
        return (
          <div
            key={task.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px',
              borderBottom: i < tasks.length - 1 ? `1px solid ${t.border.subtle}` : 'none',
              opacity: isDone ? 0.5 : isDeleting ? 0.3 : 1,
              transition: 'opacity 200ms, background 150ms',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = t.bg.cardHover)}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            {/* Check */}
            <button onClick={() => onToggle(task)} style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0,
              display: 'flex', alignItems: 'center',
            }}>
              {isDone
                ? <Check style={{ width: 17, height: 17, color: t.semantic.success }} />
                : <Circle style={{ width: 17, height: 17, color: t.text.muted, opacity: 0.4 }} />
              }
            </button>

            {/* Priority bar */}
            <div style={{ width: 3, height: 30, borderRadius: 2, flexShrink: 0, backgroundColor: priorityColor(task.priority), opacity: isDone ? 0.3 : 1 }} />

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 13.5, fontWeight: isDone ? 400 : 500, color: t.text.primary,
                textDecoration: isDone ? 'line-through' : 'none',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                letterSpacing: '-0.01em',
              }}>
                {task.title}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                {task.client && (
                  <span style={{ fontSize: 11, color: t.text.muted, padding: '1px 5px', background: t.bg.muted, borderRadius: t.radius.xs }}>
                    {(task.client as { name?: string }).name}
                  </span>
                )}
                {task.description && (
                  <span style={{ fontSize: 11, color: t.text.muted }}>
                    {task.description.slice(0, 55)}{task.description.length > 55 ? '…' : ''}
                  </span>
                )}
              </div>
            </div>

            {/* Due date */}
            {task.due_date && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                <Clock style={{ width: 11, height: 11, color: isOverdue ? t.semantic.error : t.text.muted }} />
                <span style={{ fontSize: 11, color: isOverdue ? t.semantic.error : t.text.muted, fontWeight: isOverdue ? 600 : 400 }}>
                  {formatDate(task.due_date)}
                </span>
              </div>
            )}

            {/* Priority badge */}
            <div style={{
              fontSize: 10, fontWeight: 600, color: priorityColor(task.priority),
              padding: '2px 6px', background: `${priorityColor(task.priority)}18`,
              borderRadius: t.radius.xs, border: `1px solid ${priorityColor(task.priority)}33`,
              flexShrink: 0, textTransform: 'uppercase' as const, letterSpacing: '0.04em',
            }}>
              {priorityLabel(task.priority)}
            </div>

            <span style={{ fontSize: 11, color: t.text.muted, flexShrink: 0 }}>
              {relativeTime(task.created_at)}
            </span>

            {/* Delete */}
            <button
              onClick={() => onDelete(task.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, flexShrink: 0, opacity: 0.25, transition: 'opacity 150ms' }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '0.25')}
            >
              <Trash2 style={{ width: 12, height: 12, color: t.semantic.error }} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

// ─── BOARD VIEW ───────────────────────────────────────────────────────────────

interface BoardProps {
  tasks: Task[]
  onMove: (task: Task, status: TaskStatus) => void
  onDelete: (id: string) => void
  deletingId: string | null
}

const BOARD_COLUMNS: { status: TaskStatus; label: string; color: string }[] = [
  { status: 'todo',        label: 'Do zrobienia', color: t.text.secondary },
  { status: 'in_progress', label: 'W toku',       color: t.semantic.info },
  { status: 'done',        label: 'Gotowe',       color: t.semantic.success },
]

function BoardView({ tasks, onMove, onDelete, deletingId }: BoardProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, alignItems: 'start' }}>
      {BOARD_COLUMNS.map(col => {
        const colTasks = tasks.filter(t => t.status === col.status)
        return (
          <div key={col.status}>
            {/* Column header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 10, padding: '0 4px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: col.color }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: t.text.secondary, textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>
                  {col.label}
                </span>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 600, color: col.color,
                background: `${col.color}18`, padding: '1px 7px',
                borderRadius: t.radius.full,
              }}>
                {colTasks.length}
              </span>
            </div>

            {/* Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {colTasks.length === 0 ? (
                <div style={{
                  border: `1.5px dashed ${t.border.subtle}`, borderRadius: t.radius.md,
                  padding: '20px', textAlign: 'center', color: t.text.muted, fontSize: 12,
                }}>
                  Brak zadań
                </div>
              ) : colTasks.map(task => {
                const isOverdue = task.status !== 'done' && task.due_date && new Date(task.due_date) < new Date()
                return (
                  <div
                    key={task.id}
                    style={{
                      background: t.bg.card, border: `1px solid ${t.border.default}`,
                      borderRadius: t.radius.md, padding: '13px 14px',
                      borderLeft: `3px solid ${priorityColor(task.priority)}`,
                      transition: 'background 150ms, box-shadow 150ms',
                      opacity: deletingId === task.id ? 0.3 : 1,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = t.bg.cardHover; e.currentTarget.style.boxShadow = t.shadow.card }}
                    onMouseLeave={e => { e.currentTarget.style.background = t.bg.card; e.currentTarget.style.boxShadow = 'none' }}
                  >
                    {/* Title */}
                    <div style={{ fontSize: 13, fontWeight: 500, color: t.text.primary, marginBottom: 6, lineHeight: 1.3 }}>
                      {task.title}
                    </div>

                    {/* Meta */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const }}>
                      {task.client && (
                        <span style={{ fontSize: 10, color: t.text.muted, background: t.bg.muted, padding: '1px 5px', borderRadius: t.radius.xs }}>
                          {(task.client as { name?: string }).name}
                        </span>
                      )}
                      {task.due_date && (
                        <span style={{ fontSize: 10, color: isOverdue ? t.semantic.error : t.text.muted, display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Clock style={{ width: 9, height: 9 }} />
                          {formatDate(task.due_date)}
                        </span>
                      )}
                    </div>

                    {/* Status move buttons */}
                    <div style={{ display: 'flex', gap: 5, marginTop: 10 }}>
                      {BOARD_COLUMNS.filter(c => c.status !== col.status).map(c => (
                        <button
                          key={c.status}
                          onClick={() => onMove(task, c.status)}
                          style={{
                            fontSize: 10, padding: '3px 8px',
                            background: 'none', border: `1px solid ${t.border.default}`,
                            borderRadius: t.radius.xs, color: t.text.muted,
                            cursor: 'pointer', transition: 'border-color 150ms, color 150ms',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = c.color; e.currentTarget.style.color = c.color }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = t.border.default; e.currentTarget.style.color = t.text.muted }}
                        >
                          → {c.label}
                        </button>
                      ))}
                      <div style={{ flex: 1 }} />
                      <button
                        onClick={() => onDelete(task.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, opacity: 0.2, transition: 'opacity 150ms' }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
                        onMouseLeave={e => (e.currentTarget.style.opacity = '0.2')}
                      >
                        <Trash2 style={{ width: 11, height: 11, color: t.semantic.error }} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── CALENDAR VIEW ────────────────────────────────────────────────────────────

function CalendarView({ tasks }: { tasks: Task[] }) {
  const today = new Date()
  const [calYear, setCalYear] = useState(today.getFullYear())
  const [calMonth, setCalMonth] = useState(today.getMonth())

  const monthName = new Date(calYear, calMonth, 1).toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })

  // Build grid: days in month
  const firstDay = new Date(calYear, calMonth, 1).getDay()
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
  // Shift so week starts Monday
  const startOffset = (firstDay + 6) % 7

  // Map tasks by date
  const tasksByDate: Record<string, Task[]> = {}
  tasks.forEach(task => {
    if (task.due_date) {
      const d = task.due_date.slice(0, 10)
      if (!tasksByDate[d]) tasksByDate[d] = []
      tasksByDate[d].push(task)
    }
  })

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  // Pad to complete rows
  while (cells.length % 7 !== 0) cells.push(null)

  const todayStr = today.toISOString().slice(0, 10)

  return (
    <div style={{ background: t.bg.card, border: `1px solid ${t.border.default}`, borderRadius: t.radius.md, overflow: 'hidden' }}>
      {/* Calendar header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 18px', borderBottom: `1px solid ${t.border.subtle}`,
      }}>
        <button
          onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) } else setCalMonth(m => m - 1) }}
          style={{ background: 'none', border: `1px solid ${t.border.default}`, borderRadius: t.radius.xs, padding: '4px 10px', color: t.text.secondary, cursor: 'pointer', fontSize: 13 }}
        >
          ‹
        </button>
        <span style={{ fontSize: 14, fontWeight: 600, color: t.text.primary, textTransform: 'capitalize' as const }}>
          {monthName}
        </span>
        <button
          onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) } else setCalMonth(m => m + 1) }}
          style={{ background: 'none', border: `1px solid ${t.border.default}`, borderRadius: t.radius.xs, padding: '4px 10px', color: t.text.secondary, cursor: 'pointer', fontSize: 13 }}
        >
          ›
        </button>
      </div>

      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: `1px solid ${t.border.subtle}` }}>
        {['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'].map(d => (
          <div key={d} style={{
            padding: '8px 0', textAlign: 'center', fontSize: 10, fontWeight: 600,
            color: t.text.muted, textTransform: 'uppercase' as const, letterSpacing: '0.08em',
          }}>
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {cells.map((day, i) => {
          if (day === null) return (
            <div key={`e${i}`} style={{
              minHeight: 80, border: `0.5px solid ${t.border.subtle}`,
              background: t.bg.muted, opacity: 0.4,
            }} />
          )

          const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const dayTasks = tasksByDate[dateStr] ?? []
          const isToday = dateStr === todayStr
          const isPast = dateStr < todayStr

          return (
            <div
              key={dateStr}
              style={{
                minHeight: 80, padding: '6px 8px',
                border: `0.5px solid ${t.border.subtle}`,
                background: isToday ? `${t.brand.gold}08` : 'transparent',
                transition: 'background 150ms',
              }}
              onMouseEnter={e => { if (!isToday) e.currentTarget.style.background = t.bg.muted }}
              onMouseLeave={e => { if (!isToday) e.currentTarget.style.background = 'transparent' }}
            >
              <div style={{
                fontSize: 11, fontWeight: isToday ? 700 : 400,
                color: isToday ? t.brand.gold : isPast ? t.text.muted : t.text.secondary,
                marginBottom: 4,
              }}>
                {day}
                {isToday && <span style={{ marginLeft: 3, fontSize: 8, verticalAlign: 'super', color: t.brand.gold }}>●</span>}
              </div>
              {dayTasks.slice(0, 3).map(task => (
                <div
                  key={task.id}
                  title={task.title}
                  style={{
                    fontSize: 10, padding: '2px 5px', borderRadius: 3, marginBottom: 2,
                    background: `${priorityColor(task.priority)}25`,
                    color: task.status === 'done' ? t.text.muted : priorityColor(task.priority),
                    textDecoration: task.status === 'done' ? 'line-through' : 'none',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
                    border: `1px solid ${priorityColor(task.priority)}35`,
                  }}
                >
                  {task.title}
                </div>
              ))}
              {dayTasks.length > 3 && (
                <div style={{ fontSize: 9, color: t.text.muted, marginTop: 1 }}>+{dayTasks.length - 3} więcej</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── TABLE VIEW ───────────────────────────────────────────────────────────────

function TableView({ tasks, onToggle, onDelete, deletingId }: RowProps & { tasks: Task[] }) {
  if (tasks.length === 0) return <EmptyState />

  const COLS = ['', 'Tytuł', 'Klient', 'Status', 'Priorytet', 'Termin', 'Dodano', '']

  return (
    <div style={{ background: t.bg.card, border: `1px solid ${t.border.default}`, borderRadius: t.radius.md, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        display: 'grid', gridTemplateColumns: '28px 1fr 140px 100px 90px 110px 100px 40px',
        gap: 0, padding: '10px 16px', borderBottom: `1px solid ${t.border.subtle}`,
      }}>
        {COLS.map(h => (
          <div key={h} style={{ fontSize: 10, fontWeight: 600, color: t.text.muted, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>
            {h}
          </div>
        ))}
      </div>

      {/* Rows */}
      {tasks.map((task, i) => {
        const isDone = task.status === 'done'
        const isOverdue = !isDone && task.due_date && new Date(task.due_date) < new Date()
        return (
          <div
            key={task.id}
            style={{
              display: 'grid', gridTemplateColumns: '28px 1fr 140px 100px 90px 110px 100px 40px',
              gap: 0, padding: '11px 16px', alignItems: 'center',
              borderBottom: i < tasks.length - 1 ? `1px solid ${t.border.subtle}` : 'none',
              opacity: deletingId === task.id ? 0.3 : isDone ? 0.55 : 1,
              transition: 'background 150ms',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = t.bg.cardHover)}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <button onClick={() => onToggle(task)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
              {isDone
                ? <Check style={{ width: 14, height: 14, color: t.semantic.success }} />
                : <Circle style={{ width: 14, height: 14, color: t.text.muted, opacity: 0.4 }} />
              }
            </button>
            <div style={{ fontSize: 13, color: t.text.primary, fontWeight: 500, textDecoration: isDone ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, paddingRight: 8 }}>
              {task.title}
            </div>
            <div style={{ fontSize: 11, color: t.text.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
              {(task.client as { name?: string } | null)?.name ?? '—'}
            </div>
            <div style={{ fontSize: 11, color: t.text.secondary }}>{statusLabel(task.status)}</div>
            <div style={{ fontSize: 10, fontWeight: 600, color: priorityColor(task.priority), textTransform: 'uppercase' as const }}>
              {priorityLabel(task.priority)}
            </div>
            <div style={{ fontSize: 11, color: isOverdue ? t.semantic.error : t.text.muted, fontWeight: isOverdue ? 600 : 400 }}>
              {task.due_date ? formatDate(task.due_date) : '—'}
            </div>
            <div style={{ fontSize: 11, color: t.text.muted }}>{relativeTime(task.created_at)}</div>
            <button
              onClick={() => onDelete(task.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, opacity: 0.2, transition: 'opacity 150ms' }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '0.2')}
            >
              <Trash2 style={{ width: 12, height: 12, color: t.semantic.error }} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: t.text.muted, fontSize: 14 }}>
      <CheckSquare style={{ width: 32, height: 32, margin: '0 auto 12px', opacity: 0.25 }} />
      <div>Brak zadań</div>
      <div style={{ fontSize: 12, marginTop: 4 }}>Dodaj pierwsze zadanie przyciskiem powyżej</div>
    </div>
  )
}
