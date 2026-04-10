'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Mail, Phone, FileText, ExternalLink, Plus, Sparkles,
  Activity, CheckCircle, XCircle, PauseCircle, ClipboardCheck,
  Pencil, Trash2, X, Network, Check,
} from 'lucide-react'
import {
  Client, Project, Automation, Meeting, Document, ClientNote,
  ClientStatus, ProjectStatus, AutomationStatus, DocumentType,
} from '@/lib/types'
import { t } from '@/lib/tokens'
import { formatDate, formatDateFull, formatPLN, relativeTime, getInitials } from '@/lib/format'
import { SpotlightCard } from '@/components/ui/spotlight-card'

interface ClientDetailProps {
  client: Client
  projects: Project[]
  automations: Automation[]
  meetings: Pick<Meeting, 'id' | 'date' | 'summary_ai' | 'decisions'>[]
  documents: Pick<Document, 'id' | 'type' | 'status' | 'created_at' | 'sent_at'>[]
  initialNotes: ClientNote[]
}

// ─── Static maps ─────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<ClientStatus, string> = {
  lead: 'Lead', active: 'Aktywny', partner: 'Partner', closed: 'Zamknięty',
}

const PROJECT_STATUS_ORDER: ProjectStatus[] = ['kickoff', 'demo1', 'demo2', 'production', 'delivered']

const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  kickoff: 'Kickoff', demo1: 'Demo 1', demo2: 'Demo 2',
  production: 'Produkcja', delivered: 'Dostarczony', partner: 'Partner',
}

const PROJECT_STATUS_COLORS: Record<ProjectStatus, string> = {
  kickoff: '#F59E0B', demo1: '#6366F1', demo2: '#8B5CF6',
  production: '#10B981', delivered: t.brand.gold, partner: t.brand.gold,
}

const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  offer: 'Oferta', contract: 'Umowa', report: 'Raport',
}

const AUTOMATION_ICONS: Record<AutomationStatus, React.ElementType> = {
  active: CheckCircle, error: XCircle, paused: PauseCircle,
}

const AUTOMATION_COLORS: Record<AutomationStatus, string> = {
  active: t.semantic.success, error: t.semantic.error, paused: t.text.muted,
}

const IMPORTANCE_COLORS: Record<string, string> = {
  high:   t.semantic.error,
  medium: t.semantic.warning,
  low:    t.text.muted,
}

const IMPORTANCE_LABELS: Record<string, string> = {
  high: 'Ważne', medium: 'Średnie', low: 'Niskie',
}

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Ręczna', meeting: 'Spotkanie', instagram: 'Instagram',
  research: 'Research', call: 'Rozmowa', linkedin: 'LinkedIn',
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function ProjectStatusBar({ status }: { status: ProjectStatus }) {
  const currentIdx = PROJECT_STATUS_ORDER.indexOf(status)
  return (
    <div style={{ display: 'flex', gap: 3, marginTop: 10 }}>
      {PROJECT_STATUS_ORDER.map((step, idx) => (
        <div key={step} style={{
          flex: 1, height: 4, borderRadius: 20,
          backgroundColor: idx <= currentIdx ? t.brand.gold : t.border.default,
          transition: 'background-color 0.3s',
        }} />
      ))}
    </div>
  )
}

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: t.text.muted }}>
        {title}
      </span>
      {count !== undefined && (
        <span style={{ fontSize: 12, fontWeight: 600, color: t.text.muted, backgroundColor: t.bg.muted, border: `1px solid ${t.border.default}`, padding: '2px 8px', borderRadius: t.radius.full }}>
          {count}
        </span>
      )}
    </div>
  )
}

function EmptyCard({ message }: { message: string }) {
  return (
    <div style={{ backgroundColor: t.bg.muted, border: `1px dashed ${t.border.default}`, borderRadius: t.radius.md, padding: '28px 24px', textAlign: 'center', color: t.text.muted, fontSize: 13 }}>
      {message}
    </div>
  )
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ backgroundColor: t.bg.card, border: `1px solid ${t.border.default}`, borderRadius: t.radius.md, padding: '18px 20px', boxShadow: t.shadow.card, ...style }}>
      {children}
    </div>
  )
}

// ─── Edit Client Modal ────────────────────────────────────────────────────────

interface EditClientModalProps {
  client: Client
  onSave: (updated: Client) => void
  onClose: () => void
}

function EditClientModal({ client, onSave, onClose }: EditClientModalProps) {
  const [form, setForm] = useState({
    name:        client.name,
    industry:    client.industry ?? '',
    size:        client.size ?? '',
    owner_name:  client.owner_name ?? '',
    owner_email: client.owner_email ?? '',
    owner_phone: client.owner_phone ?? '',
    source:      client.source ?? '',
    notes:       client.notes ?? '',
    status:      client.status,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Nazwa jest wymagana'); return }
    setSaving(true); setError('')
    const res = await fetch(`/api/clients/${client.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (res.ok) {
      const { client: updated } = await res.json() as { client: Client }
      onSave(updated)
    } else {
      setError('Błąd zapisu — spróbuj ponownie')
    }
  }

  const inputSt: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: t.bg.input, border: `1px solid ${t.border.default}`,
    borderRadius: t.radius.sm, padding: '8px 12px',
    color: t.text.primary, fontSize: 13, outline: 'none',
  }

  const labelSt: React.CSSProperties = {
    color: t.text.muted, fontSize: 11, fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: '0.04em',
    display: 'block', marginBottom: 5,
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: t.bg.cardSolid, border: `1px solid ${t.border.default}`, borderRadius: t.radius.lg, padding: 28, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <h2 style={{ color: t.text.primary, fontWeight: 700, fontSize: 16, margin: 0 }}>Edytuj klienta</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: t.text.muted, cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelSt}>Nazwa firmy *</label>
              <input value={form.name} onChange={set('name')} style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>Branża</label>
              <input value={form.industry} onChange={set('industry')} placeholder="np. Farmacja" style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>Wielkość</label>
              <input value={form.size} onChange={set('size')} placeholder="np. 10-25 osób" style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>Osoba kontaktowa</label>
              <input value={form.owner_name} onChange={set('owner_name')} style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>Status</label>
              <select value={form.status} onChange={set('status')} style={{ ...inputSt, cursor: 'pointer' }}>
                <option value="lead">Lead</option>
                <option value="active">Aktywny</option>
                <option value="partner">Partner</option>
                <option value="closed">Zamknięty</option>
              </select>
            </div>
            <div>
              <label style={labelSt}>Email</label>
              <input type="email" value={form.owner_email} onChange={set('owner_email')} style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>Telefon</label>
              <input value={form.owner_phone} onChange={set('owner_phone')} style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>Źródło</label>
              <input value={form.source} onChange={set('source')} placeholder="np. Referral" style={inputSt} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelSt}>Notatka ogólna</label>
              <textarea value={form.notes} onChange={set('notes')} rows={3} style={{ ...inputSt, resize: 'none' }} />
            </div>
          </div>
          {error && <div style={{ color: t.semantic.error, fontSize: 12 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
            <button type="button" onClick={onClose} style={{ padding: '8px 18px', background: 'transparent', border: `1px solid ${t.border.default}`, borderRadius: t.radius.sm, color: t.text.muted, fontSize: 13, cursor: 'pointer' }}>
              Anuluj
            </button>
            <button type="submit" disabled={saving} style={{ padding: '8px 18px', background: t.brand.gold, border: 'none', borderRadius: t.radius.sm, color: '#111114', fontWeight: 700, fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Zapisuję...' : 'Zapisz zmiany'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Notes Section ────────────────────────────────────────────────────────────

interface NotesSectionProps {
  clientId: string
  initialNotes: ClientNote[]
}

function NotesSection({ clientId, initialNotes }: NotesSectionProps) {
  const [notes, setNotes] = useState<ClientNote[]>(initialNotes)
  const [newContent, setNewContent] = useState('')
  const [newImportance, setNewImportance] = useState<'high' | 'medium' | 'low'>('medium')
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)

  const addNote = useCallback(async () => {
    if (!newContent.trim()) return
    setSaving(true)
    const res = await fetch(`/api/clients/${clientId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newContent.trim(), importance: newImportance }),
    })
    setSaving(false)
    if (res.ok) {
      const { note } = await res.json() as { note: ClientNote }
      setNotes(prev => [note, ...prev])
      setNewContent('')
      setAdding(false)
    }
  }, [clientId, newContent, newImportance])

  const startEdit = (note: ClientNote) => {
    setEditingId(note.id)
    setEditContent(note.content)
  }

  const saveEdit = useCallback(async (noteId: string) => {
    if (!editContent.trim()) return
    setSaving(true)
    const res = await fetch(`/api/clients/${clientId}/notes`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: noteId, content: editContent.trim() }),
    })
    setSaving(false)
    if (res.ok) {
      const { note } = await res.json() as { note: ClientNote }
      setNotes(prev => prev.map(n => n.id === noteId ? note : n))
      setEditingId(null)
    }
  }, [clientId, editContent])

  const deleteNote = useCallback(async (noteId: string) => {
    if (!confirm('Usunąć tę notatkę?')) return
    const res = await fetch(`/api/clients/${clientId}/notes?noteId=${noteId}`, { method: 'DELETE' })
    if (res.ok) setNotes(prev => prev.filter(n => n.id !== noteId))
  }, [clientId])

  const textareaSt: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: t.bg.input, border: `1px solid ${t.border.default}`,
    borderRadius: t.radius.sm, padding: '8px 12px',
    color: t.text.primary, fontSize: 13, outline: 'none', resize: 'none',
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <SectionHeader title="Notatki i Historia" count={notes.length} />
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'transparent', border: `1px solid ${t.border.default}`, borderRadius: t.radius.sm, padding: '5px 10px', color: t.text.muted, fontSize: 12, cursor: 'pointer' }}
          >
            <Plus size={12} /> Dodaj
          </button>
        )}
      </div>

      {/* Add note form */}
      {adding && (
        <div style={{ background: t.bg.muted, border: `1px solid ${t.border.default}`, borderRadius: t.radius.md, padding: 14, marginBottom: 12 }}>
          <textarea
            value={newContent}
            onChange={e => setNewContent(e.target.value)}
            rows={3}
            autoFocus
            placeholder="Treść notatki..."
            style={textareaSt}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <select
              value={newImportance}
              onChange={e => setNewImportance(e.target.value as 'high' | 'medium' | 'low')}
              style={{ background: t.bg.input, border: `1px solid ${t.border.default}`, borderRadius: t.radius.sm, padding: '5px 8px', color: t.text.secondary, fontSize: 12, outline: 'none', cursor: 'pointer' }}
            >
              <option value="low">Niskie</option>
              <option value="medium">Średnie</option>
              <option value="high">Ważne</option>
            </select>
            <div style={{ flex: 1 }} />
            <button onClick={() => setAdding(false)} style={{ background: 'none', border: 'none', color: t.text.muted, cursor: 'pointer', fontSize: 12 }}>Anuluj</button>
            <button
              onClick={addNote}
              disabled={saving || !newContent.trim()}
              style={{ background: t.brand.gold, border: 'none', borderRadius: t.radius.sm, padding: '5px 14px', color: '#111114', fontWeight: 700, fontSize: 12, cursor: 'pointer', opacity: (saving || !newContent.trim()) ? 0.6 : 1 }}
            >
              {saving ? '...' : 'Dodaj'}
            </button>
          </div>
        </div>
      )}

      {notes.length === 0 && !adding ? (
        <EmptyCard message="Brak notatek — kliknij Dodaj aby dodać pierwszą" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {notes.map(note => (
            <div key={note.id} style={{
              background: t.bg.card,
              border: `1px solid ${note.importance === 'high' ? t.border.error : t.border.subtle}`,
              borderLeft: `3px solid ${IMPORTANCE_COLORS[note.importance] ?? t.text.muted}`,
              borderRadius: t.radius.md,
              padding: '12px 14px',
            }}>
              {editingId === note.id ? (
                <div>
                  <textarea
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                    rows={3}
                    autoFocus
                    style={textareaSt}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
                    <button onClick={() => setEditingId(null)} style={{ background: 'none', border: 'none', color: t.text.muted, cursor: 'pointer', fontSize: 12 }}>Anuluj</button>
                    <button
                      onClick={() => saveEdit(note.id)}
                      disabled={saving}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, background: t.semantic.successBg, border: `1px solid ${t.semantic.successBorder}`, borderRadius: t.radius.sm, padding: '4px 12px', color: t.semantic.success, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                    >
                      <Check size={12} /> Zapisz
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <p style={{ flex: 1, color: t.text.secondary, fontSize: 13, lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>{note.content}</p>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button onClick={() => startEdit(note)} style={{ background: 'none', border: 'none', color: t.text.muted, cursor: 'pointer', padding: 4 }} title="Edytuj">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => deleteNote(note.id)} style={{ background: 'none', border: 'none', color: t.semantic.error, cursor: 'pointer', padding: 4, opacity: 0.7 }} title="Usuń">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: IMPORTANCE_COLORS[note.importance] ?? t.text.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {IMPORTANCE_LABELS[note.importance] ?? note.importance}
                    </span>
                    <span style={{ width: 3, height: 3, borderRadius: '50%', background: t.border.default, display: 'inline-block' }} />
                    <span style={{ fontSize: 11, color: t.text.muted }}>{SOURCE_LABELS[note.source] ?? note.source}</span>
                    <span style={{ fontSize: 11, color: t.text.muted, marginLeft: 'auto' }}>{relativeTime(note.created_at)}</span>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ClientDetail({ client, projects, automations, meetings, documents, initialNotes }: ClientDetailProps) {
  const router = useRouter()
  const [clientData, setClientData] = useState<Client>(client)
  const [showEdit, setShowEdit] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleClientSaved = useCallback((updated: Client) => {
    setClientData(updated)
    setShowEdit(false)
  }, [])

  const handleDelete = async () => {
    if (!confirm(`Czy na pewno chcesz usunąć klienta "${clientData.name}"?\nTej akcji nie można cofnąć.`)) return
    setIsDeleting(true)
    const res = await fetch(`/api/clients/${clientData.id}`, { method: 'DELETE' })
    if (res.ok) {
      router.push('/dashboard/clients')
    } else {
      setIsDeleting(false)
      alert('Błąd usuwania klienta — spróbuj ponownie.')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* Back */}
      <button
        onClick={() => router.push('/dashboard/clients')}
        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: t.text.muted, fontSize: 14, padding: 0, alignSelf: 'flex-start' }}
      >
        <ArrowLeft style={{ width: 16, height: 16 }} /> Klienci
      </button>

      {/* Hero */}
      <SpotlightCard style={{
        backgroundColor: t.bg.card,
        border: `1px solid ${t.border.default}`,
        borderRadius: t.radius.lg,
        padding: '22px 26px',
        boxShadow: t.shadow.card,
        borderTop: `3px solid ${t.brand.gold}`,
        animation: 'cardEnter 0.38s ease both',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          {/* Left — identity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: '1 1 280px' }}>
            <div style={{
              width: 52, height: 52, borderRadius: t.radius.md, flexShrink: 0,
              background: `linear-gradient(135deg, ${t.brand.goldLight}, rgba(196,154,46,0.20))`,
              border: `1px solid ${t.border.gold}`, color: t.brand.gold,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 700,
            }}>
              {getInitials(clientData.name)}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h1 style={{ fontSize: 20, fontWeight: 700, color: t.text.primary, margin: 0 }}>{clientData.name}</h1>
                <button onClick={() => setShowEdit(true)} style={{ background: 'none', border: 'none', color: t.text.muted, cursor: 'pointer', padding: 2, display: 'flex' }} title="Edytuj klienta">
                  <Pencil size={14} />
                </button>
              </div>
              {clientData.industry && <div style={{ fontSize: 13, color: t.text.secondary, marginTop: 2 }}>{clientData.industry}</div>}
              <div style={{ fontSize: 12, color: t.text.muted, marginTop: 1 }}>Klient od {formatDateFull(clientData.created_at)}</div>
            </div>
          </div>
          {/* Right — actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: '0 0 auto' }}>
            <span style={{ ...t.statusBadge[clientData.status], display: 'inline-block', padding: '5px 12px', borderRadius: t.radius.full, fontSize: 12, fontWeight: 600 }}>
              {STATUS_LABELS[clientData.status]}
            </span>
            <a href={`/dashboard/clients/${clientData.id}/prep`} style={actionLinkStyle(t.border.gold, t.brand.goldLight, t.brand.gold)}>
              <Sparkles size={13} /> Przygotuj call
            </a>
            <a href={`/dashboard/clients/${clientData.id}/audit`} style={actionLinkStyle(t.border.default, t.bg.muted, t.text.secondary)}>
              <ClipboardCheck size={13} /> Audyt
            </a>
            <a href={`/dashboard/clients/${clientData.id}/stack`} style={actionLinkStyle(t.border.default, t.bg.muted, t.text.secondary)}>
              <Network size={13} /> Stack
            </a>
            <a href={`/client/${clientData.client_token}`} target="_blank" rel="noopener noreferrer" style={actionLinkStyle(t.border.default, t.bg.muted, t.text.secondary)}>
              <ExternalLink size={13} /> Portal
            </a>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              title="Usuń klienta"
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 10px', borderRadius: t.radius.sm,
                border: `1px solid ${t.semantic.errorBorder}`,
                background: t.semantic.errorBg, color: t.semantic.error,
                fontSize: 12, fontWeight: 600, cursor: isDeleting ? 'not-allowed' : 'pointer',
                opacity: isDeleting ? 0.6 : 1, flexShrink: 0,
              }}
            >
              <Trash2 size={12} /> {isDeleting ? 'Usuwam...' : 'Usuń'}
            </button>
          </div>
        </div>
      </SpotlightCard>

      {/* 2-column layout — fluid right panel */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(260px,300px)', gap: 20, alignItems: 'start' }}>

        {/* LEFT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

          {/* Projekty */}
          <div style={{ animation: 'cardEnter 0.32s ease both', animationDelay: '0.08s' }}>
            <SectionHeader title="Projekty" count={projects.length} />
            {projects.length === 0 ? <EmptyCard message="Brak projektów" /> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {projects.map(project => (
                  <Card key={project.id}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: t.text.primary, marginBottom: 6 }}>{project.type ?? 'Projekt'}</div>
                        <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 600, color: PROJECT_STATUS_COLORS[project.status], backgroundColor: `${PROJECT_STATUS_COLORS[project.status]}18`, border: `1px solid ${PROJECT_STATUS_COLORS[project.status]}35`, padding: '2px 9px', borderRadius: t.radius.full }}>
                          {PROJECT_STATUS_LABELS[project.status]}
                        </span>
                        <ProjectStatusBar status={project.status} />
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: t.text.primary }}>{formatPLN(project.value_netto ?? 0)}</div>
                        <span style={{ display: 'inline-block', marginTop: 5, fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: t.radius.full, color: project.payment_status === 'paid' ? t.semantic.success : project.payment_status === 'partial' ? t.semantic.warning : t.text.muted, backgroundColor: project.payment_status === 'paid' ? t.semantic.successBg : project.payment_status === 'partial' ? t.semantic.warningBg : t.bg.muted, border: `1px solid ${project.payment_status === 'paid' ? t.semantic.successBorder : project.payment_status === 'partial' ? t.semantic.warningBorder : t.border.default}` }}>
                          {project.payment_status === 'paid' ? 'Zapłacone' : project.payment_status === 'partial' ? 'Częściowe' : 'Oczekuje'}
                        </span>
                      </div>
                    </div>
                    {(project.start_date || project.delivery_date) && (
                      <div style={{ display: 'flex', gap: 16, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${t.border.subtle}` }}>
                        {project.start_date && <span style={{ fontSize: 12, color: t.text.muted }}>Start: {formatDate(project.start_date)}</span>}
                        {project.delivery_date && <span style={{ fontSize: 12, color: t.text.muted }}>Termin: {formatDate(project.delivery_date)}</span>}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Automatyzacje */}
          <div style={{ animation: 'cardEnter 0.32s ease both', animationDelay: '0.14s' }}>
            <SectionHeader title="Automatyzacje" count={automations.length} />
            {automations.length === 0 ? <EmptyCard message="Brak automatyzacji" /> : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px,1fr))', gap: 8 }}>
                {automations.map(automation => {
                  const StatusIcon = AUTOMATION_ICONS[automation.status]
                  const isError = automation.status === 'error'
                  return (
                    <Card key={automation.id} style={{ borderLeft: `3px solid ${AUTOMATION_COLORS[automation.status]}`, backgroundColor: isError ? t.semantic.errorBg : t.bg.card, borderColor: isError ? t.semantic.errorBorder : t.border.default }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                        <StatusIcon style={{ width: 13, height: 13, color: AUTOMATION_COLORS[automation.status], flexShrink: 0 }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: t.text.primary }}>{automation.name}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                        <Activity style={{ width: 11, height: 11, color: t.text.muted }} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: t.text.primary }}>{automation.transactions_this_month}</span>
                        <span style={{ fontSize: 12, color: t.text.muted }}>transakcji</span>
                      </div>
                      <div style={{ fontSize: 12, color: t.text.muted }}>{relativeTime(automation.last_ping)}</div>
                      {isError && automation.error_message && (
                        <div style={{ marginTop: 8, fontSize: 11, color: t.semantic.error, fontFamily: 'monospace', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                          {automation.error_message}
                        </div>
                      )}
                    </Card>
                  )
                })}
              </div>
            )}
          </div>

          {/* Notes */}
          <div style={{ animation: 'cardEnter 0.32s ease both', animationDelay: '0.20s' }}>
            <NotesSection clientId={clientData.id} initialNotes={initialNotes} />
          </div>
        </div>

        {/* RIGHT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Kontakt */}
          <div style={{ animation: 'cardEnter 0.32s ease both', animationDelay: '0.11s' }}>
            <Card>
              <SectionHeader title="Kontakt" />
              {clientData.owner_name && <div style={{ fontSize: 15, fontWeight: 700, color: t.text.primary, marginBottom: 10 }}>{clientData.owner_name}</div>}
              {clientData.owner_email && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7, cursor: 'pointer' }} onClick={() => navigator.clipboard.writeText(clientData.owner_email!)} title="Kopiuj email">
                  <Mail style={{ width: 13, height: 13, color: t.text.muted, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: t.text.secondary }}>{clientData.owner_email}</span>
                </div>
              )}
              {clientData.owner_phone && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7, cursor: 'pointer' }} onClick={() => navigator.clipboard.writeText(clientData.owner_phone!)} title="Kopiuj telefon">
                  <Phone style={{ width: 13, height: 13, color: t.text.muted, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: t.text.secondary }}>{clientData.owner_phone}</span>
                </div>
              )}
              {clientData.source && <div style={{ marginTop: 8, fontSize: 12, color: t.text.muted }}>Źródło: {clientData.source}</div>}
              {clientData.notes && (
                <div style={{ marginTop: 10, fontSize: 13, color: t.text.secondary, fontStyle: 'italic', lineHeight: 1.5, borderTop: `1px solid ${t.border.subtle}`, paddingTop: 10 }}>
                  {clientData.notes}
                </div>
              )}
            </Card>
          </div>

          {/* Spotkania */}
          <div style={{ animation: 'cardEnter 0.32s ease both', animationDelay: '0.17s' }}>
            <Card>
              <SectionHeader title="Spotkania" count={meetings.length} />
              {meetings.length === 0 ? (
                <div style={{ fontSize: 13, color: t.text.muted, textAlign: 'center', padding: '12px 0' }}>Brak spotkań</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {meetings.map((meeting, idx) => (
                    <div key={meeting.id} style={{ borderBottom: idx < meetings.length - 1 ? `1px solid ${t.border.subtle}` : 'none', paddingBottom: idx < meetings.length - 1 ? 10 : 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: t.text.primary, marginBottom: 3 }}>{formatDateFull(meeting.date)}</div>
                      {meeting.summary_ai && <div style={{ fontSize: 12, color: t.text.secondary, lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', marginBottom: 3 }}>{meeting.summary_ai}</div>}
                      {meeting.decisions && meeting.decisions.length > 0 && <span style={{ fontSize: 11, color: t.text.muted }}>{meeting.decisions.length} decyzji</span>}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Dokumenty */}
          <div style={{ animation: 'cardEnter 0.32s ease both', animationDelay: '0.22s' }}>
            <Card>
              <SectionHeader title="Dokumenty" />
              {documents.length === 0 ? (
                <div style={{ fontSize: 13, color: t.text.muted, textAlign: 'center', padding: '12px 0' }}>Brak dokumentów</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {documents.map(doc => (
                    <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <FileText style={{ width: 12, height: 12, color: t.text.muted, flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 13, color: t.text.secondary }}>{DOC_TYPE_LABELS[doc.type as DocumentType] ?? doc.type}</span>
                      <span style={{ fontSize: 11, color: t.text.muted }}>{formatDate(doc.created_at)}</span>
                      {doc.sent_at && <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: t.semantic.success, flexShrink: 0 }} title="Wysłany" />}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>

      {showEdit && (
        <EditClientModal client={clientData} onSave={handleClientSaved} onClose={() => setShowEdit(false)} />
      )}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function actionLinkStyle(border: string, bg: string, color: string): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 5,
    padding: '6px 12px', borderRadius: t.radius.sm,
    fontSize: 12, fontWeight: 600, cursor: 'pointer',
    border: `1px solid ${border}`, backgroundColor: bg,
    color, textDecoration: 'none', transition: 'all 150ms',
    whiteSpace: 'nowrap',
  }
}
