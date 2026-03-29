'use client'

import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Mail, Phone, FileText, ExternalLink, Plus, Sparkles,
  Activity, CheckCircle, XCircle, PauseCircle, ClipboardCheck,
} from 'lucide-react'
import { Client, Project, Automation, Meeting, Document, ClientStatus, ProjectStatus, AutomationStatus, DocumentType } from '@/lib/types'
import { t } from '@/lib/tokens'
import { formatDate, formatDateFull, formatPLN, relativeTime, getInitials } from '@/lib/format'
import { SpotlightCard } from '@/components/ui/spotlight-card'

interface ClientDetailProps {
  client: Client
  projects: Project[]
  automations: Automation[]
  meetings: Pick<Meeting, 'id' | 'date' | 'summary_ai' | 'decisions'>[]
  documents: Pick<Document, 'id' | 'type' | 'status' | 'created_at' | 'sent_at'>[]
}

// ─── Labels & styles from tokens ────────────────────────────────────────────

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

// ─── Sub-components ──────────────────────────────────────────────────────────

function ProjectStatusBar({ status }: { status: ProjectStatus }) {
  const currentIdx = PROJECT_STATUS_ORDER.indexOf(status)
  return (
    <div style={{ display: 'flex', gap: 3, marginTop: 10 }}>
      {PROJECT_STATUS_ORDER.map((step, idx) => (
        <div
          key={step}
          style={{
            flex: 1, height: 4, borderRadius: 20,
            backgroundColor: idx <= currentIdx ? t.brand.gold : t.border.default,
            transition: 'background-color 0.3s',
          }}
        />
      ))}
    </div>
  )
}

// ─── Section wrapper ─────────────────────────────────────────────────────────

function Section({ title, count, children, delay = 0 }: { title: string; count?: number; children: React.ReactNode; delay?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32, delay }}>
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
      {children}
    </motion.div>
  )
}

function EmptyCard({ message }: { message: string }) {
  return (
    <div style={{ backgroundColor: t.bg.muted, border: `1px dashed ${t.border.default}`, borderRadius: t.radius.lg, padding: '36px 24px', textAlign: 'center', color: t.text.muted, fontSize: 14 }}>
      {message}
    </div>
  )
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ backgroundColor: t.bg.card, border: `1px solid ${t.border.default}`, borderRadius: t.radius.lg, padding: '20px 22px', boxShadow: t.shadow.card, ...style }}>
      {children}
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function ClientDetail({ client, projects, automations, meetings, documents }: ClientDetailProps) {
  const router = useRouter()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {/* Back */}
      <button
        onClick={() => router.push('/dashboard/clients')}
        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: t.text.muted, fontSize: 14, padding: 0, alignSelf: 'flex-start', transition: 'color 150ms' }}
        onMouseEnter={(e) => { e.currentTarget.style.color = t.text.primary }}
        onMouseLeave={(e) => { e.currentTarget.style.color = t.text.muted }}
      >
        <ArrowLeft style={{ width: 16, height: 16 }} />
        Klienci
      </button>

      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.38 }}>
        <SpotlightCard
          style={{
            backgroundColor: t.bg.card,
            border: `1px solid ${t.border.default}`,
            borderRadius: t.radius.lg,
            padding: '26px 30px',
            boxShadow: t.shadow.card,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24,
            borderTop: `3px solid ${t.brand.gold}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div style={{ width: 56, height: 56, borderRadius: t.radius.lg, background: `linear-gradient(135deg, ${t.brand.goldLight}, rgba(196,154,46,0.2))`, border: `1px solid ${t.border.gold}`, color: t.brand.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, flexShrink: 0 }}>
              {getInitials(client.name)}
            </div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: t.text.primary, marginBottom: 3 }}>{client.name}</h1>
              {client.industry && <div style={{ fontSize: 13, color: t.text.secondary, marginBottom: 2 }}>{client.industry}</div>}
              <div style={{ fontSize: 12, color: t.text.muted }}>Klient od {formatDateFull(client.created_at)}</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <span style={{ ...t.statusBadge[client.status], display: 'inline-block', padding: '5px 14px', borderRadius: t.radius.full, fontSize: 13, fontWeight: 600 }}>
              {STATUS_LABELS[client.status]}
            </span>
            <a
              href={`/dashboard/clients/${client.id}/prep`}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: t.radius.md, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: `1px solid ${t.border.gold}`, backgroundColor: t.brand.goldLight, color: t.brand.gold, textDecoration: 'none', transition: 'all 150ms' }}
            >
              <Sparkles style={{ width: 14, height: 14 }} />
              Przygotuj call ↗
            </a>
            <a
              href={`/dashboard/clients/${client.id}/audit`}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: t.radius.md, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: `1px solid ${t.border.default}`, backgroundColor: t.bg.muted, color: t.text.secondary, textDecoration: 'none', transition: 'all 150ms' }}
            >
              <ClipboardCheck style={{ width: 14, height: 14 }} />
              Audyt Operacyjny
            </a>
            <a
              href={`/client/${client.client_token}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: t.radius.md, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: `1px solid ${t.border.default}`, backgroundColor: t.bg.muted, color: t.text.secondary, textDecoration: 'none', transition: 'all 150ms' }}
            >
              <ExternalLink style={{ width: 14, height: 14 }} />
              Portal klienta
            </a>
            <button
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: t.radius.md, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', background: t.brand.gradient, color: '#fff', boxShadow: '0 2px 8px rgba(196,154,46,0.3)', transition: 'all 150ms' }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(196,154,46,0.4)' }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(196,154,46,0.3)' }}
            >
              <Plus style={{ width: 14, height: 14 }} />
              Nowy projekt
            </button>
          </div>
        </SpotlightCard>
      </motion.div>

      {/* 2-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>
        {/* Left */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Projekty */}
          <Section title="Projekty" count={projects.length} delay={0.1}>
            {projects.length === 0 ? <EmptyCard message="Brak projektów" /> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {projects.map((project) => (
                  <Card key={project.id}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: t.text.primary, marginBottom: 8 }}>
                          {project.type ?? 'Projekt'}
                        </div>
                        <span style={{ display: 'inline-block', fontSize: 12, fontWeight: 600, color: PROJECT_STATUS_COLORS[project.status], backgroundColor: `${PROJECT_STATUS_COLORS[project.status]}15`, border: `1px solid ${PROJECT_STATUS_COLORS[project.status]}35`, padding: '2px 10px', borderRadius: t.radius.full }}>
                          {PROJECT_STATUS_LABELS[project.status]}
                        </span>
                        <ProjectStatusBar status={project.status} />
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: t.text.primary }}>{formatPLN(project.value_netto ?? 0)}</div>
                        <span style={{ display: 'inline-block', marginTop: 6, fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: t.radius.full, color: project.payment_status === 'paid' ? t.semantic.success : project.payment_status === 'partial' ? t.semantic.warning : t.text.muted, backgroundColor: project.payment_status === 'paid' ? t.semantic.successBg : project.payment_status === 'partial' ? t.semantic.warningBg : t.bg.muted, border: `1px solid ${project.payment_status === 'paid' ? t.semantic.successBorder : project.payment_status === 'partial' ? t.semantic.warningBorder : t.border.default}` }}>
                          {project.payment_status === 'paid' ? 'Zapłacone' : project.payment_status === 'partial' ? 'Częściowe' : 'Oczekuje'}
                        </span>
                      </div>
                    </div>
                    {(project.start_date || project.delivery_date) && (
                      <div style={{ display: 'flex', gap: 16, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${t.border.default}` }}>
                        {project.start_date && <span style={{ fontSize: 12, color: t.text.muted }}>Start: {formatDate(project.start_date)}</span>}
                        {project.delivery_date && <span style={{ fontSize: 12, color: t.text.muted }}>Termin: {formatDate(project.delivery_date)}</span>}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </Section>

          {/* Automatyzacje */}
          <Section title="Automatyzacje" count={automations.length} delay={0.16}>
            {automations.length === 0 ? <EmptyCard message="Brak automatyzacji" /> : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                {automations.map((automation) => {
                  const StatusIcon = AUTOMATION_ICONS[automation.status]
                  const isError = automation.status === 'error'
                  return (
                    <Card key={automation.id} style={{ borderLeft: `3px solid ${AUTOMATION_COLORS[automation.status]}`, backgroundColor: isError ? t.semantic.errorBg : t.bg.card, borderColor: isError ? t.semantic.errorBorder : t.border.default }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
                        <StatusIcon style={{ width: 14, height: 14, color: AUTOMATION_COLORS[automation.status], flexShrink: 0 }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: t.text.primary }}>{automation.name}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                        <Activity style={{ width: 12, height: 12, color: t.text.muted }} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: t.text.primary }}>{automation.transactions_this_month}</span>
                        <span style={{ fontSize: 12, color: t.text.muted }}>transakcji</span>
                      </div>
                      <div style={{ fontSize: 12, color: t.text.muted }}>{relativeTime(automation.last_ping)}</div>
                      {isError && automation.error_message && (
                        <div style={{ marginTop: 10, fontSize: 12, color: t.semantic.error, fontFamily: 'monospace', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                          {automation.error_message}
                        </div>
                      )}
                    </Card>
                  )
                })}
              </div>
            )}
          </Section>
        </div>

        {/* Right */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Kontakt */}
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32, delay: 0.13 }}>
            <Card>
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: t.text.muted, display: 'block', marginBottom: 14 }}>Kontakt</span>
              {client.owner_name && <div style={{ fontSize: 15, fontWeight: 700, color: t.text.primary, marginBottom: 12 }}>{client.owner_name}</div>}
              {client.owner_email && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer' }} onClick={() => navigator.clipboard.writeText(client.owner_email!)} title="Kopiuj">
                  <Mail style={{ width: 14, height: 14, color: t.text.muted, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: t.text.secondary }}>{client.owner_email}</span>
                </div>
              )}
              {client.owner_phone && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer' }} onClick={() => navigator.clipboard.writeText(client.owner_phone!)} title="Kopiuj">
                  <Phone style={{ width: 14, height: 14, color: t.text.muted, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: t.text.secondary }}>{client.owner_phone}</span>
                </div>
              )}
              {client.source && <div style={{ marginTop: 10, fontSize: 12, color: t.text.muted }}>Źródło: {client.source}</div>}
              {client.notes && <div style={{ marginTop: 12, fontSize: 13, color: t.text.secondary, fontStyle: 'italic', lineHeight: 1.5, borderTop: `1px solid ${t.border.default}`, paddingTop: 12 }}>{client.notes}</div>}
            </Card>
          </motion.div>

          {/* Spotkania */}
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32, delay: 0.19 }}>
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: t.text.muted }}>Spotkania</span>
                <span style={{ fontSize: 12, color: t.text.muted, backgroundColor: t.bg.muted, border: `1px solid ${t.border.default}`, padding: '2px 8px', borderRadius: t.radius.full, fontWeight: 600 }}>{meetings.length}</span>
              </div>
              {meetings.length === 0 ? (
                <div style={{ fontSize: 13, color: t.text.muted, textAlign: 'center', padding: '16px 0' }}>Brak spotkań</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {meetings.map((meeting, idx) => (
                    <div key={meeting.id} style={{ borderBottom: idx < meetings.length - 1 ? `1px solid ${t.border.default}` : 'none', paddingBottom: idx < meetings.length - 1 ? 12 : 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: t.text.primary, marginBottom: 4 }}>{formatDateFull(meeting.date)}</div>
                      {meeting.summary_ai && <div style={{ fontSize: 12, color: t.text.secondary, lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', marginBottom: 4 }}>{meeting.summary_ai}</div>}
                      {meeting.decisions && meeting.decisions.length > 0 && <span style={{ fontSize: 11, color: t.text.muted }}>{meeting.decisions.length} decyzji</span>}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </motion.div>

          {/* Dokumenty */}
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32, delay: 0.24 }}>
            <Card>
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: t.text.muted, display: 'block', marginBottom: 14 }}>Dokumenty</span>
              {documents.length === 0 ? (
                <div style={{ fontSize: 13, color: t.text.muted, textAlign: 'center', padding: '16px 0' }}>Brak dokumentów</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {documents.map((doc) => (
                    <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <FileText style={{ width: 13, height: 13, color: t.text.muted, flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: t.text.secondary }}>{DOC_TYPE_LABELS[doc.type as DocumentType] ?? doc.type}</span>
                      <span style={{ fontSize: 12, color: t.text.muted }}>{formatDate(doc.created_at)}</span>
                      {doc.sent_at && <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: t.semantic.success, flexShrink: 0 }} title="Wysłany" />}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
