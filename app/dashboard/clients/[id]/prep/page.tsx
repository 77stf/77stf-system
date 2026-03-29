'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Sparkles, Plus, ChevronUp, Mail, Phone, User,
  Clock, AlertCircle, ChevronRight, BookOpen, History, Tag,
  Zap, TrendingUp, Square,
} from 'lucide-react'
import { t } from '@/lib/tokens'
import { formatPLN, formatDate, relativeTime } from '@/lib/format'
import type { ClientNote, ClientStatus } from '@/lib/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProposedSolution {
  title: string
  description: string
  estimated_roi_pln: number
  implementation_time: string
  why_them: string
}

interface ObjectionItem {
  objection: string
  response: string
}

interface MeetingBrief {
  executive_summary: string
  decision_maker_profile?: string
  conversation_tone?: string
  pain_points: string[]
  opportunities: string[]
  proposed_solutions: ProposedSolution[]
  questions_to_ask: string[]
  objections_to_handle: ObjectionItem[]
  closing_strategy: string
  next_steps: string[]
  _error?: boolean
}

interface BriefResponse {
  brief: MeetingBrief
  client_name: string
  is_mock?: boolean
  error?: string
  model?: string
}

interface ClientSnapshot {
  id: string
  name: string
  industry?: string
  status: ClientStatus
  owner_name?: string
  owner_email?: string
  owner_phone?: string
  source?: string
  priority?: string
  created_at: string
  notes?: string
}

type NoteSource = 'manual' | 'meeting' | 'instagram' | 'research' | 'call' | 'linkedin'
type NoteImportance = 'high' | 'medium' | 'low'

// ─── Pipeline stages ──────────────────────────────────────────────────────────

const PIPELINE_STAGES = [
  { key: 'lead',        label: 'Lead',            sub: 'Pierwszy kontakt' },
  { key: 'offer',       label: 'Oferta',           sub: 'Propozycja wysłana' },
  { key: 'negotiation', label: 'Negocjacje',       sub: 'Ustalanie warunków' },
  { key: 'demo',        label: 'Demo',             sub: 'Prezentacja live' },
  { key: 'closing',     label: 'Zamknięty',        sub: 'Finalizacja umowy' },
]

function statusToStageIndex(status: ClientStatus): number {
  switch (status) {
    case 'lead':    return 0
    case 'active':  return 2
    case 'partner': return 4
    case 'closed':  return -1
    default:        return 0
  }
}

// ─── Source maps ──────────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<NoteSource, string> = {
  manual:    'Ręcznie',
  meeting:   'Spotkanie',
  instagram: 'Instagram',
  research:  'Research',
  call:      'Call',
  linkedin:  'LinkedIn',
}

// Per spec: call=#22c55e, research=#3b82f6, manual=gray, instagram=#a855f7, linkedin=#0ea5e9
const SOURCE_COLORS: Record<NoteSource, { color: string; bg: string; border: string }> = {
  call:      { color: '#22c55e', bg: 'rgba(34,197,94,0.1)',    border: 'rgba(34,197,94,0.25)' },
  research:  { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',   border: 'rgba(59,130,246,0.25)' },
  instagram: { color: '#a855f7', bg: 'rgba(168,85,247,0.1)',   border: 'rgba(168,85,247,0.25)' },
  linkedin:  { color: '#0ea5e9', bg: 'rgba(14,165,233,0.1)',   border: 'rgba(14,165,233,0.25)' },
  meeting:   { color: '#818CF8', bg: 'rgba(129,140,248,0.1)',  border: 'rgba(129,140,248,0.25)' },
  manual:    { color: t.text.secondary, bg: t.bg.muted,        border: t.border.default },
}

const IMPORTANCE_BORDER: Record<NoteImportance, string> = {
  high:   t.semantic.error,
  medium: t.semantic.warning,
  low:    t.border.default,
}

const STATUS_LABELS: Record<ClientStatus, string> = {
  lead:    'Lead',
  active:  'Aktywny',
  partner: 'Partner',
  closed:  'Zamknięty',
}

// ─── Loading message cycling ──────────────────────────────────────────────────

const LOADING_MESSAGES = [
  'Analizuję dane klienta...',
  'Przetwarzam historię interakcji...',
  'Generuję rekomendacje...',
]

// ─── Small helpers ────────────────────────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      backgroundColor: t.bg.card,
      border: `1px solid ${t.border.default}`,
      borderRadius: t.radius.lg,
      padding: '20px 22px',
      boxShadow: t.shadow.card,
      ...style,
    }}>
      {children}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11,
      fontWeight: 600,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.12em',
      color: t.text.muted,
      marginBottom: 12,
    }}>
      {children}
    </div>
  )
}

function Badge({
  children, color, bg, border,
}: { children: React.ReactNode; color: string; bg: string; border: string }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 600,
      color, backgroundColor: bg, border: `1px solid ${border}`,
      padding: '3px 10px', borderRadius: t.radius.full,
      display: 'inline-flex', alignItems: 'center', gap: 4,
    }}>
      {children}
    </span>
  )
}

function SkeletonLine({
  width = '100%', height = 14, style,
}: { width?: string | number; height?: number; style?: React.CSSProperties }) {
  return (
    <div style={{
      width, height, borderRadius: 6,
      background: `linear-gradient(90deg, ${t.bg.muted} 0%, ${t.bg.overlay} 50%, ${t.bg.muted} 100%)`,
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s ease-in-out infinite',
      ...style,
    }} />
  )
}

// ─── SECTION 1: Client Snapshot ───────────────────────────────────────────────

function ClientSnapshot({ client, clientName }: { client: ClientSnapshot | null; clientName: string }) {
  const name = client?.name ?? clientName ?? 'Klient'
  const statusBadge = client ? t.statusBadge[client.status] : t.statusBadge.lead

  return (
    <Card style={{ borderTop: `3px solid ${t.brand.gold}`, padding: '20px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: 16 }}>

        {/* Left: company name + industry + source badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: '0 0 auto' }}>
          <div style={{
            width: 50, height: 50, borderRadius: t.radius.md, flexShrink: 0,
            background: `linear-gradient(135deg, ${t.brand.goldLight}, rgba(196,154,46,0.2))`,
            border: `1px solid ${t.border.gold}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 17, fontWeight: 700, color: t.brand.gold,
          }}>
            {name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 600, color: t.text.primary, marginBottom: 5 }}>{name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const }}>
              {client?.industry && (
                <span style={{ fontSize: 13, color: t.text.muted }}>{client.industry}</span>
              )}
              {client?.source && (
                <Badge color={t.semantic.info} bg={t.semantic.infoBg} border={t.semantic.infoBorder}>
                  {client.source}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Middle: contact */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 auto', minWidth: 180, paddingLeft: 8 }}>
          {client?.owner_name && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: t.text.secondary }}>
              <User style={{ width: 13, height: 13, color: t.text.muted, flexShrink: 0 }} />
              {client.owner_name}
            </span>
          )}
          {client?.owner_email && (
            <a href={`mailto:${client.owner_email}`} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: t.text.secondary, textDecoration: 'none' }}>
              <Mail style={{ width: 13, height: 13, color: t.text.muted, flexShrink: 0 }} />
              {client.owner_email}
            </a>
          )}
          {client?.owner_phone && (
            <a href={`tel:${client.owner_phone}`} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: t.text.secondary, textDecoration: 'none' }}>
              <Phone style={{ width: 13, height: 13, color: t.text.muted, flexShrink: 0 }} />
              {client.owner_phone}
            </a>
          )}
        </div>

        {/* Right: status + priority + last contact */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {client && (
              <span style={{ ...statusBadge, padding: '3px 10px', borderRadius: t.radius.full, fontSize: 11, fontWeight: 600 }}>
                {STATUS_LABELS[client.status]}
              </span>
            )}
            {client?.priority && (
              <Badge color={t.semantic.error} bg={t.semantic.errorBg} border={t.semantic.errorBorder}>
                {client.priority}
              </Badge>
            )}
          </div>
          {client?.created_at && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: t.text.muted, marginBottom: 2 }}>Ostatni kontakt</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.text.secondary }}>{formatDate(client.created_at)}</div>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

// ─── SECTION 2: Deal Pipeline ─────────────────────────────────────────────────

function DealPipeline({ status }: { status: ClientStatus | undefined }) {
  const currentIdx = status ? statusToStageIndex(status) : 0
  const isClosed = status === 'closed'

  return (
    <Card style={{ padding: '20px 28px' }}>
      <SectionLabel>Pipeline Sprzedażowy</SectionLabel>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        {PIPELINE_STAGES.map((stage, idx) => {
          const isCompleted = !isClosed && idx < currentIdx
          const isCurrent   = !isClosed && idx === currentIdx
          const isLast      = idx === PIPELINE_STAGES.length - 1

          const circleColor = isClosed
            ? t.text.muted
            : isCompleted ? t.brand.gold
            : isCurrent   ? t.brand.gold
            : t.border.default

          const labelColor = isClosed
            ? t.text.muted
            : isCurrent   ? t.text.primary
            : isCompleted ? t.brand.gold
            : t.text.muted

          return (
            <div key={stage.key} style={{ display: 'flex', alignItems: 'center', flex: isLast ? '0 0 auto' : 1 }}>
              {/* Stage node */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                {/* Circle */}
                <div style={{ position: 'relative', width: 24, height: 24 }}>
                  {isCurrent && (
                    <div style={{
                      position: 'absolute', inset: -5, borderRadius: '50%',
                      border: `2px solid ${t.brand.gold}`,
                      opacity: 0.45,
                      animation: 'pulse-ring 2s ease-out infinite',
                    }} />
                  )}
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%',
                    backgroundColor: isCompleted
                      ? t.brand.gold
                      : isCurrent
                      ? 'transparent'
                      : t.bg.muted,
                    border: `2px solid ${circleColor}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    position: 'relative', zIndex: 1,
                    animation: isCurrent ? 'pulse 2s ease-in-out infinite' : 'none',
                  }}>
                    {isCompleted && (
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="#000" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                    {isCurrent && (
                      <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: t.brand.gold }} />
                    )}
                  </div>
                </div>
                {/* Label */}
                <div style={{ textAlign: 'center', minWidth: 72 }}>
                  <div style={{ fontSize: 12, fontWeight: isCurrent ? 700 : 500, color: labelColor, whiteSpace: 'nowrap' as const }}>
                    {stage.label}
                  </div>
                  {isCurrent && (
                    <div style={{ fontSize: 10, color: t.text.muted, marginTop: 2, whiteSpace: 'nowrap' as const }}>
                      {stage.sub}
                    </div>
                  )}
                </div>
              </div>

              {/* Connector line */}
              {!isLast && (
                <div style={{
                  flex: 1, height: 2, marginBottom: 24, marginLeft: 3, marginRight: 3,
                  backgroundColor: isCompleted ? t.brand.gold : 'rgba(255,255,255,0.1)',
                }} />
              )}
            </div>
          )
        })}
      </div>
      {isClosed && (
        <div style={{ marginTop: 10, fontSize: 12, color: t.text.muted, textAlign: 'center' }}>
          Deal zamknięty
        </div>
      )}
    </Card>
  )
}

// ─── SECTION 3A: AI Brief Panel ───────────────────────────────────────────────

function BriefPlaceholder() {
  const items = [
    'Executive Summary — kto to jest, jaka sytuacja',
    'Główne bóle klienta w tej branży',
    'Proponowane rozwiązania z szacowanym ROI',
    'Pytania odkrywcze do zadania na calli',
    'Obiekcje i gotowe odpowiedzi',
    'Strategia zamknięcia dealu',
    'Następne kroki po rozmowie',
  ]
  return (
    <div style={{ padding: '28px 20px' }}>
      <div style={{ marginBottom: 20, textAlign: 'center' }}>
        <Sparkles style={{ width: 30, height: 30, color: t.brand.gold, margin: '0 auto 10px' }} />
        <div style={{ fontSize: 14, fontWeight: 600, color: t.text.secondary, marginBottom: 6 }}>Brief zawiera</div>
        <div style={{ fontSize: 13, color: t.text.muted }}>
          Kliknij &apos;Generuj Brief&apos; aby Claude przeanalizował dane klienta
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: t.text.muted }}>
            <ChevronRight style={{ width: 13, height: 13, color: t.brand.gold, flexShrink: 0 }} />
            {item}
          </div>
        ))}
      </div>
    </div>
  )
}

function BriefLoading({ message }: { message: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '56px 24px', gap: 18,
    }}>
      {/* Spinner */}
      <div style={{ position: 'relative', width: 48, height: 48 }}>
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: `2px solid rgba(196,154,46,0.15)`,
        }} />
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: `2px solid transparent`,
          borderTopColor: t.brand.gold,
          animation: 'spin 1s linear infinite',
        }} />
        <Sparkles style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%,-50%)',
          width: 18, height: 18, color: t.brand.gold,
        }} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: t.text.primary, marginBottom: 6 }}>
          {message}
        </div>
        <div style={{ fontSize: 13, color: t.text.muted }}>
          Claude analizuje notatki, historię spotkań i projekty
        </div>
      </div>
    </div>
  )
}

function BriefError({ error, onRetry }: { error: string; onRetry: () => void }) {
  const isCredit = error.toLowerCase().includes('credit') || error.toLowerCase().includes('balance')
  const isTimeout = error.toLowerCase().includes('timeout') || error.toLowerCase().includes('timed out')
  const isAuth = error.toLowerCase().includes('401') || error.toLowerCase().includes('authentication') || error.toLowerCase().includes('api key')

  let hint = 'Sprawdź logi lub spróbuj ponownie.'
  if (isCredit) hint = 'Wyczerpano kredyty Anthropic — doładuj na console.anthropic.com'
  if (isTimeout) hint = 'Przekroczono czas odpowiedzi (60s). Spróbuj ponownie lub sprawdź połączenie z API.'
  if (isAuth) hint = 'Nieprawidłowy klucz API. Sprawdź ANTHROPIC_API_KEY w .env.local'

  return (
    <div style={{
      margin: '16px 0',
      padding: '18px 20px',
      backgroundColor: t.semantic.errorBg,
      border: `1px solid ${t.semantic.errorBorder}`,
      borderRadius: t.radius.md,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <AlertCircle style={{ width: 16, height: 16, color: t.semantic.error, flexShrink: 0 }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: t.semantic.error }}>
          Błąd generowania briefu
        </span>
      </div>
      <p style={{ fontSize: 13, color: t.text.secondary, margin: '0 0 10px', lineHeight: 1.6 }}>
        {hint}
      </p>
      {/* Raw error — always visible so user knows exactly what failed */}
      <div style={{
        background: 'rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 6,
        padding: '8px 12px',
        marginBottom: 14,
        fontFamily: 'monospace',
        fontSize: 11,
        color: t.text.muted,
        wordBreak: 'break-all' as const,
      }}>
        {error}
      </div>
      <button
        onClick={onRetry}
        style={{
          background: t.bg.overlay, color: t.text.secondary,
          border: `1px solid ${t.border.default}`,
          borderRadius: t.radius.sm, padding: '7px 14px',
          fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}
      >
        Spróbuj ponownie
      </button>
    </div>
  )
}

// ─── Glass panel primitives ───────────────────────────────────────────────────

function GlassPanel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.033)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 14,
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 4px 24px rgba(0,0,0,0.35)',
      padding: '18px 20px',
      ...style,
    }}>
      {children}
    </div>
  )
}

function PanelLabel({ icon, label, color }: { icon: React.ReactNode; label: string; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14 }}>
      <span style={{ color: color ?? t.text.muted, display: 'flex' }}>{icon}</span>
      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.14em', color: t.text.muted }}>
        {label}
      </span>
    </div>
  )
}

function BriefContent({ brief }: { brief: MeetingBrief }) {
  const maxRoi = Math.max(...brief.proposed_solutions.map(s => s.estimated_roi_pln || 0), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* 1. Executive Summary — hero card with gold accent line */}
      <GlassPanel style={{
        borderLeft: `3px solid ${t.brand.gold}`,
        background: 'linear-gradient(135deg, rgba(196,154,46,0.06) 0%, rgba(255,255,255,0.025) 100%)',
        boxShadow: 'inset 0 1px 0 rgba(196,154,46,0.12), 0 4px 24px rgba(0,0,0,0.35)',
      }}>
        <PanelLabel icon={<TrendingUp style={{ width: 13, height: 13 }} />} label="Executive Summary" color={t.brand.gold} />
        <p style={{ fontSize: 14, color: t.text.primary, lineHeight: 1.8, margin: 0, fontWeight: 400 }}>
          {brief.executive_summary}
        </p>
      </GlassPanel>

      {/* 1b. Decision maker + tone — compact row */}
      {(brief.decision_maker_profile || brief.conversation_tone) && (
        <div style={{ display: 'grid', gridTemplateColumns: brief.decision_maker_profile && brief.conversation_tone ? '1fr 1fr' : '1fr', gap: 12 }}>
          {brief.decision_maker_profile && (
            <GlassPanel style={{ padding: '14px 18px' }}>
              <PanelLabel icon={<User style={{ width: 12, height: 12 }} />} label="Profil decydenta" />
              <p style={{ fontSize: 13, color: t.text.secondary, lineHeight: 1.65, margin: 0 }}>
                {brief.decision_maker_profile}
              </p>
            </GlassPanel>
          )}
          {brief.conversation_tone && (
            <GlassPanel style={{
              padding: '14px 18px',
              background: 'linear-gradient(135deg, rgba(59,130,246,0.06) 0%, rgba(255,255,255,0.025) 100%)',
              borderTop: '2px solid rgba(59,130,246,0.35)',
            }}>
              <PanelLabel icon={<Sparkles style={{ width: 12, height: 12 }} />} label="Jak zacząć rozmowę" color="#3b82f6" />
              <p style={{ fontSize: 13, color: t.text.primary, lineHeight: 1.65, margin: 0, fontStyle: 'italic' }}>
                &ldquo;{brief.conversation_tone}&rdquo;
              </p>
            </GlassPanel>
          )}
        </div>
      )}

      {/* 2. Pain Points + Opportunities — side by side grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {brief.pain_points.length > 0 && (
          <GlassPanel style={{
            borderTop: '2px solid rgba(248,113,113,0.35)',
            background: 'linear-gradient(160deg, rgba(248,113,113,0.05) 0%, rgba(255,255,255,0.02) 100%)',
          }}>
            <PanelLabel icon={<AlertCircle style={{ width: 13, height: 13 }} />} label="Bóle klienta" color={t.semantic.error} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {brief.pain_points.map((point, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                  <span style={{
                    width: 5, height: 5, borderRadius: '50%', flexShrink: 0, marginTop: 7,
                    background: t.semantic.error, boxShadow: `0 0 6px rgba(248,113,113,0.5)`,
                  }} />
                  <span style={{ fontSize: 13, color: t.text.secondary, lineHeight: 1.6 }}>{point}</span>
                </div>
              ))}
            </div>
          </GlassPanel>
        )}

        {brief.opportunities && brief.opportunities.length > 0 && (
          <GlassPanel style={{
            borderTop: '2px solid rgba(74,222,128,0.35)',
            background: 'linear-gradient(160deg, rgba(74,222,128,0.05) 0%, rgba(255,255,255,0.02) 100%)',
          }}>
            <PanelLabel icon={<Zap style={{ width: 13, height: 13 }} />} label="Możliwości" color={t.semantic.success} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {brief.opportunities.map((opp, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                  <span style={{
                    width: 5, height: 5, borderRadius: '50%', flexShrink: 0, marginTop: 7,
                    background: t.semantic.success, boxShadow: `0 0 6px rgba(74,222,128,0.5)`,
                  }} />
                  <span style={{ fontSize: 13, color: t.text.secondary, lineHeight: 1.6 }}>{opp}</span>
                </div>
              ))}
            </div>
          </GlassPanel>
        )}
      </div>

      {/* 3. Proposed Solutions — premium cards with ROI bar */}
      {brief.proposed_solutions.length > 0 && (
        <div>
          <PanelLabel icon={<Zap style={{ width: 13, height: 13 }} />} label="Proponowane rozwiązania" color={t.brand.gold} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {brief.proposed_solutions.map((sol, i) => (
              <GlassPanel key={i} style={{
                borderLeft: `3px solid ${t.brand.gold}`,
                background: 'linear-gradient(135deg, rgba(196,154,46,0.04) 0%, rgba(255,255,255,0.025) 100%)',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: t.text.primary }}>{sol.title}</div>
                  {sol.implementation_time && (
                    <span style={{
                      fontSize: 11, color: t.text.muted, flexShrink: 0,
                      background: 'rgba(255,255,255,0.05)', border: `1px solid ${t.border.subtle}`,
                      padding: '3px 9px', borderRadius: t.radius.full,
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      <Clock style={{ width: 10, height: 10 }} />
                      {sol.implementation_time}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 13, color: t.text.secondary, lineHeight: 1.65, margin: '0 0 12px' }}>
                  {sol.description}
                </p>
                {/* ROI bar */}
                {sol.estimated_roi_pln > 0 && (
                  <div style={{ marginBottom: sol.why_them ? 10 : 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontSize: 11, color: t.text.muted, fontWeight: 600 }}>Szacowany ROI</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: t.brand.gold }}>{formatPLN(sol.estimated_roi_pln)}</span>
                    </div>
                    <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 4 }}>
                      <div style={{
                        height: '100%', borderRadius: 4,
                        width: `${Math.round((sol.estimated_roi_pln / maxRoi) * 100)}%`,
                        background: `linear-gradient(90deg, ${t.brand.goldDark}, ${t.brand.gold})`,
                        boxShadow: '0 0 8px rgba(196,154,46,0.5)',
                        transition: 'width 600ms ease',
                      }} />
                    </div>
                  </div>
                )}
                {sol.why_them && (
                  <p style={{ fontSize: 12, color: t.text.muted, fontStyle: 'italic', margin: 0, lineHeight: 1.5, borderLeft: '2px solid rgba(255,255,255,0.08)', paddingLeft: 10 }}>
                    {sol.why_them}
                  </p>
                )}
              </GlassPanel>
            ))}
          </div>
        </div>
      )}

      {/* 4. Questions + Objections — side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {brief.questions_to_ask.length > 0 && (
          <GlassPanel>
            <PanelLabel icon={<BookOpen style={{ width: 13, height: 13 }} />} label="Pytania do zadania" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {brief.questions_to_ask.map((q, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{
                    width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700, color: t.text.muted, marginTop: 1,
                  }}>
                    {i + 1}
                  </span>
                  <span style={{ fontSize: 13, color: t.text.secondary, lineHeight: 1.55 }}>{q}</span>
                </div>
              ))}
            </div>
          </GlassPanel>
        )}

        {brief.objections_to_handle.length > 0 && (
          <GlassPanel>
            <PanelLabel icon={<AlertCircle style={{ width: 13, height: 13 }} />} label="Obiekcje i odpowiedzi" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {brief.objections_to_handle.map((item, i) => (
                <div key={i} style={{
                  paddingBottom: i < brief.objections_to_handle.length - 1 ? 12 : 0,
                  borderBottom: i < brief.objections_to_handle.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: t.semantic.error, marginBottom: 5 }}>
                    &ldquo;{item.objection}&rdquo;
                  </div>
                  <div style={{
                    fontSize: 12, color: t.text.secondary, lineHeight: 1.6,
                    borderLeft: '2px solid rgba(74,222,128,0.35)', paddingLeft: 9,
                  }}>
                    {item.response}
                  </div>
                </div>
              ))}
            </div>
          </GlassPanel>
        )}
      </div>

      {/* 5. Closing Strategy — gold ambient glow */}
      {brief.closing_strategy && (
        <GlassPanel style={{
          background: 'linear-gradient(135deg, rgba(196,154,46,0.07) 0%, rgba(255,255,255,0.025) 60%)',
          borderTop: `2px solid rgba(196,154,46,0.4)`,
          boxShadow: 'inset 0 1px 0 rgba(196,154,46,0.15), 0 0 40px rgba(196,154,46,0.04), 0 4px 24px rgba(0,0,0,0.35)',
        }}>
          <PanelLabel icon={<Tag style={{ width: 13, height: 13 }} />} label="Strategia zamknięcia" color={t.brand.gold} />
          <p style={{ fontSize: 14, color: t.text.primary, lineHeight: 1.8, margin: 0 }}>
            {brief.closing_strategy}
          </p>
        </GlassPanel>
      )}

      {/* 6. Next Steps — timeline */}
      {brief.next_steps.length > 0 && (
        <GlassPanel>
          <PanelLabel icon={<ChevronRight style={{ width: 13, height: 13 }} />} label="Następne kroki" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {brief.next_steps.map((step, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, position: 'relative' }}>
                {/* vertical connector line */}
                {i < brief.next_steps.length - 1 && (
                  <div style={{
                    position: 'absolute', left: 11, top: 26,
                    width: 1, height: 'calc(100% - 10px)',
                    background: 'rgba(255,255,255,0.07)',
                  }} />
                )}
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  background: i === 0 ? t.brand.goldLight : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${i === 0 ? t.border.gold : 'rgba(255,255,255,0.10)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700,
                  color: i === 0 ? t.brand.gold : t.text.muted,
                  zIndex: 1,
                }}>
                  {i + 1}
                </div>
                <div style={{ paddingTop: 3, paddingBottom: i < brief.next_steps.length - 1 ? 16 : 0 }}>
                  <span style={{ fontSize: 13, color: i === 0 ? t.text.primary : t.text.secondary, lineHeight: 1.55 }}>{step}</span>
                </div>
              </div>
            ))}
          </div>
        </GlassPanel>
      )}
    </div>
  )
}

// ─── SECTION 3B: Notes + Timeline Tabs ───────────────────────────────────────

type RightTabExtended = 'knowledge' | 'history' | 'ingest'

interface IntelligencePanelProps {
  notes: ClientNote[]
  notesLoading: boolean
  showAddForm: boolean
  setShowAddForm: (v: boolean) => void
  noteContent: string
  setNoteContent: (v: string) => void
  noteSource: NoteSource
  setNoteSource: (v: NoteSource) => void
  noteImportance: NoteImportance
  setNoteImportance: (v: NoteImportance) => void
  savingNote: boolean
  saveNote: () => Promise<void>
  clientId: string
  onIngestComplete: () => void
}

function IntelligencePanel({
  notes, notesLoading,
  showAddForm, setShowAddForm,
  noteContent, setNoteContent,
  noteSource, setNoteSource,
  noteImportance, setNoteImportance,
  savingNote, saveNote,
  clientId, onIngestComplete,
}: IntelligencePanelProps) {
  const [activeTab, setActiveTab] = useState<RightTabExtended>('knowledge')
  const [ingestText, setIngestText] = useState('')
  const [ingestLoading, setIngestLoading] = useState(false)
  const [ingestResult, setIngestResult] = useState<{
    summary: string; operations: string[]; notes_added: number; tasks_created: number; meeting_created: boolean
  } | null>(null)
  const [ingestError, setIngestError] = useState<string | null>(null)

  const runIngest = async () => {
    if (!ingestText.trim()) return
    setIngestLoading(true)
    setIngestError(null)
    setIngestResult(null)
    try {
      const res = await fetch(`/api/clients/${clientId}/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_text: ingestText }),
      })
      const data = await res.json() as { summary?: string; operations?: string[]; notes_added?: number; tasks_created?: number; meeting_created?: boolean; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Błąd ingestion')
      setIngestResult({
        summary: data.summary ?? '',
        operations: data.operations ?? [],
        notes_added: data.notes_added ?? 0,
        tasks_created: data.tasks_created ?? 0,
        meeting_created: data.meeting_created ?? false,
      })
      setIngestText('')
      onIngestComplete()
    } catch (e) {
      setIngestError(e instanceof Error ? e.message : 'Błąd serwera')
    } finally {
      setIngestLoading(false)
    }
  }

  const TAB_CONFIG: { id: RightTabExtended; label: string; icon: React.ElementType }[] = [
    { id: 'knowledge', label: 'Baza Wiedzy', icon: BookOpen },
    { id: 'history', label: 'Historia', icon: History },
    { id: 'ingest', label: 'Smart Ingest', icon: Sparkles },
  ]

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${t.border.default}` }}>
        {TAB_CONFIG.map(({ id, label, icon: TabIcon }) => {
          const isActive = activeTab === id
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              style={{
                flex: 1, padding: '12px 0', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', border: 'none',
                background: isActive ? t.bg.muted : 'transparent',
                color: isActive ? (id === 'ingest' ? t.brand.gold : t.text.primary) : t.text.muted,
                borderBottom: isActive ? `2px solid ${id === 'ingest' ? t.brand.gold : t.brand.gold}` : '2px solid transparent',
                transition: 'all 150ms',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              }}
            >
              <TabIcon style={{ width: 12, height: 12 }} />
              {label}
            </button>
          )
        })}
      </div>

      {/* TAB: Smart Ingest */}
      {activeTab === 'ingest' && (
        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.text.primary, marginBottom: 4 }}>
              Wklej dowolny tekst
            </div>
            <div style={{ fontSize: 12, color: t.text.muted, lineHeight: 1.5 }}>
              Transkrypt rozmowy, wiadomości WhatsApp, email, notatki — AI wpisze wszystko we właściwe miejsca.
            </div>
          </div>
          <textarea
            value={ingestText}
            onChange={e => setIngestText(e.target.value)}
            placeholder={`Wklej tutaj:\n• transkrypt spotkania lub rozmowy telefonicznej\n• eksport WhatsApp / Slack\n• emaile od/do klienta\n• Twoje notatki głosowe lub własne przemyślenia\n• informacje z LinkedIn, Instagrama\n• cokolwiek co dotyczy tego klienta\n\nAI automatycznie:\n✓ doda notatki do bazy wiedzy\n✓ zaktualizuje profil klienta\n✓ stworzy zadania z obietnic\n✓ zarchiwizuje jako spotkanie (jeśli to transkrypt)`}
            rows={10}
            style={{
              width: '100%', background: t.bg.muted,
              border: `1px solid ${t.border.default}`,
              borderRadius: t.radius.sm, padding: '12px 14px',
              color: t.text.primary, fontSize: 13, lineHeight: 1.6,
              resize: 'vertical' as const, outline: 'none',
              fontFamily: 'inherit', boxSizing: 'border-box' as const,
            }}
            onFocus={e => { e.currentTarget.style.borderColor = t.brand.gold }}
            onBlur={e => { e.currentTarget.style.borderColor = t.border.default }}
          />
          {ingestError && (
            <div style={{ padding: '10px 14px', backgroundColor: t.semantic.errorBg, border: `1px solid ${t.semantic.errorBorder}`, borderRadius: t.radius.sm }}>
              <span style={{ fontSize: 12, color: t.semantic.error }}>{ingestError}</span>
            </div>
          )}
          {ingestResult && (
            <div style={{ padding: '12px 14px', backgroundColor: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: t.radius.sm }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: t.semantic.success, marginBottom: 6 }}>
                ✓ {ingestResult.summary}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {ingestResult.operations.map((op, i) => (
                  <div key={i} style={{ fontSize: 11, color: t.text.secondary }}>· {op}</div>
                ))}
              </div>
            </div>
          )}
          <button
            onClick={runIngest}
            disabled={ingestLoading || !ingestText.trim()}
            style={{
              background: ingestText.trim() ? t.brand.gold : t.bg.muted,
              color: ingestText.trim() ? '#000' : t.text.muted,
              border: 'none', borderRadius: t.radius.md, padding: '10px 18px',
              fontSize: 13, fontWeight: 700,
              cursor: ingestLoading || !ingestText.trim() ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              transition: 'all 150ms',
            }}
          >
            {ingestLoading
              ? <><Zap style={{ width: 13, height: 13, animation: 'spin 1s linear infinite' }} /> Analizuję...</>
              : <><Sparkles style={{ width: 13, height: 13 }} /> Analizuj i zapisz</>
            }
          </button>
        </div>
      )}

      {/* TAB: Baza Wiedzy */}
      {activeTab === 'knowledge' && (
        <div style={{ padding: '16px 18px' }}>
          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontSize: 12, color: t.text.muted }}>
              {notes.length} {notes.length === 1 ? 'notatka' : notes.length < 5 ? 'notatki' : 'notatek'}
            </span>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: showAddForm ? t.bg.overlay : t.bg.muted,
                border: `1px solid ${t.border.default}`,
                borderRadius: t.radius.md,
                padding: '5px 12px', fontSize: 12, color: t.text.secondary,
                cursor: 'pointer', transition: 'all 150ms',
              }}
            >
              {showAddForm
                ? <ChevronUp style={{ width: 12, height: 12 }} />
                : <Plus style={{ width: 12, height: 12 }} />
              }
              {showAddForm ? 'Anuluj' : 'Dodaj notatkę'}
            </button>
          </div>

          {/* Add form */}
          {showAddForm && (
            <div style={{
              marginBottom: 14, padding: 14,
              backgroundColor: t.bg.muted, borderRadius: t.radius.md,
              border: `1px solid ${t.border.subtle}`,
              display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              <textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Treść notatki..."
                rows={4}
                style={{
                  width: '100%', backgroundColor: t.bg.input,
                  border: `1px solid ${t.border.default}`, borderRadius: t.radius.sm,
                  padding: '10px 12px', fontSize: 13, color: t.text.primary,
                  resize: 'vertical' as const, outline: 'none',
                  fontFamily: 'inherit', lineHeight: 1.6, boxSizing: 'border-box' as const,
                }}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <select
                  value={noteSource}
                  onChange={(e) => setNoteSource(e.target.value as NoteSource)}
                  style={{
                    backgroundColor: t.bg.input, border: `1px solid ${t.border.default}`,
                    borderRadius: t.radius.sm, padding: '8px 10px',
                    fontSize: 12, color: t.text.primary, outline: 'none', cursor: 'pointer',
                  }}
                >
                  <option value="manual">Ręcznie</option>
                  <option value="research">Research</option>
                  <option value="call">Call</option>
                  <option value="meeting">Spotkanie</option>
                  <option value="instagram">Instagram</option>
                  <option value="linkedin">LinkedIn</option>
                </select>
                <select
                  value={noteImportance}
                  onChange={(e) => setNoteImportance(e.target.value as NoteImportance)}
                  style={{
                    backgroundColor: t.bg.input, border: `1px solid ${t.border.default}`,
                    borderRadius: t.radius.sm, padding: '8px 10px',
                    fontSize: 12, color: t.text.primary, outline: 'none', cursor: 'pointer',
                  }}
                >
                  <option value="high">Wysoki priorytet</option>
                  <option value="medium">Średni priorytet</option>
                  <option value="low">Niski priorytet</option>
                </select>
              </div>
              <button
                onClick={saveNote}
                disabled={savingNote || !noteContent.trim()}
                style={{
                  backgroundColor: t.brand.gold, color: '#000',
                  border: 'none', borderRadius: t.radius.sm, padding: '9px 16px',
                  fontSize: 13, fontWeight: 700,
                  cursor: savingNote || !noteContent.trim() ? 'not-allowed' : 'pointer',
                  opacity: savingNote || !noteContent.trim() ? 0.5 : 1,
                  transition: 'opacity 150ms',
                }}
              >
                {savingNote ? 'Zapisuję...' : 'Zapisz notatkę'}
              </button>
            </div>
          )}

          {/* Notes list */}
          {notesLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{ padding: '14px 16px', borderRadius: t.radius.md, border: `1px solid ${t.border.subtle}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <SkeletonLine width="90%" />
                  <SkeletonLine width="70%" />
                  <SkeletonLine width="40%" height={11} />
                </div>
              ))}
            </div>
          ) : notes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: t.text.muted, fontSize: 13, lineHeight: 1.6 }}>
              <BookOpen style={{ width: 24, height: 24, margin: '0 auto 10px', opacity: 0.4 }} />
              Brak notatek.<br />Dodaj pierwszą wiedzę o kliencie.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {notes.map((note) => {
                const src = (note.source ?? 'manual') as NoteSource
                const imp = (note.importance ?? 'medium') as NoteImportance
                const srcStyle = SOURCE_COLORS[src] ?? SOURCE_COLORS.manual
                return (
                  <div
                    key={note.id}
                    style={{
                      borderLeft: `3px solid ${IMPORTANCE_BORDER[imp]}`,
                      borderLeftColor: IMPORTANCE_BORDER[imp],
                      padding: '12px 14px',
                      backgroundColor: t.bg.muted,
                      borderRadius: `0 ${t.radius.md}px ${t.radius.md}px 0`,
                      border: `1px solid ${t.border.subtle}`,
                      borderLeftWidth: 3,
                    }}
                  >
                    <p style={{ fontSize: 14, color: t.text.primary, lineHeight: 1.6, margin: '0 0 9px' }}>
                      {note.content}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const }}>
                      <span style={{
                        fontSize: 10, fontWeight: 600,
                        color: srcStyle.color, backgroundColor: srcStyle.bg,
                        border: `1px solid ${srcStyle.border}`,
                        padding: '2px 8px', borderRadius: t.radius.full,
                      }}>
                        {SOURCE_LABELS[src]}
                      </span>
                      {note.tags && note.tags.length > 0 && note.tags.slice(0, 2).map((tag) => (
                        <span key={tag} style={{ fontSize: 10, color: t.text.muted, display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Tag style={{ width: 9, height: 9 }} />
                          {tag}
                        </span>
                      ))}
                      <span style={{ fontSize: 11, color: t.text.muted, marginLeft: 'auto' }}>
                        {relativeTime(note.created_at)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB: Historia */}
      {activeTab === 'history' && (
        <div style={{ padding: '16px 18px' }}>
          {notesLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{ display: 'flex', gap: 12 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: t.border.default, flexShrink: 0, marginTop: 4 }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <SkeletonLine width="40%" height={11} />
                    <SkeletonLine width="75%" />
                  </div>
                </div>
              ))}
            </div>
          ) : notes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: t.text.muted, fontSize: 13, lineHeight: 1.6 }}>
              <History style={{ width: 24, height: 24, margin: '0 auto 10px', opacity: 0.4 }} />
              Brak historii interakcji.
            </div>
          ) : (
            <div style={{ position: 'relative', paddingLeft: 20 }}>
              {/* Vertical line */}
              <div style={{ position: 'absolute', left: 4, top: 6, bottom: 6, width: 1, backgroundColor: 'rgba(255,255,255,0.1)' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {[...notes]
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .map((note) => {
                    const src = (note.source ?? 'manual') as NoteSource
                    const srcStyle = SOURCE_COLORS[src] ?? SOURCE_COLORS.manual
                    return (
                      <div key={note.id} style={{ display: 'flex', gap: 14, position: 'relative' }}>
                        {/* Dot */}
                        <div style={{
                          position: 'absolute', left: -20, top: 5,
                          width: 8, height: 8, borderRadius: '50%',
                          backgroundColor: srcStyle.color,
                          border: `2px solid ${t.bg.card}`,
                          flexShrink: 0,
                        }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, color: t.text.muted, marginBottom: 4 }}>
                            {relativeTime(note.created_at)}
                          </div>
                          <span style={{
                            fontSize: 11, fontWeight: 600, color: srcStyle.color,
                            backgroundColor: srcStyle.bg, border: `1px solid ${srcStyle.border}`,
                            padding: '1px 7px', borderRadius: t.radius.full,
                            display: 'inline-block', marginBottom: 5,
                          }}>
                            {SOURCE_LABELS[src]}
                          </span>
                          <p style={{
                            fontSize: 13, color: t.text.secondary, lineHeight: 1.5, margin: 0,
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical' as const,
                            overflow: 'hidden',
                          }}>
                            {note.content}
                          </p>
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

// ─── SECTION 4: Implementation Roadmap ───────────────────────────────────────

interface RoadmapModule {
  title: string
  description: string
  status: 'Planowany'
}

function parseRoadmapFromNotes(notes: ClientNote[]): RoadmapModule[] {
  const relevant = notes.filter((n) =>
    n.tags?.some((tag) =>
      ['wdrożenia', 'priorytety', 'zakres', 'scope'].includes(tag.toLowerCase())
    )
  )
  if (relevant.length === 0) return []

  return relevant.slice(0, 4).map((note, i) => ({
    title: note.tags?.find((tg) => !['wdrożenia', 'priorytety', 'zakres', 'scope'].includes(tg.toLowerCase())) ?? `Moduł ${i + 1}`,
    description: note.content.slice(0, 120) + (note.content.length > 120 ? '…' : ''),
    status: 'Planowany' as const,
  }))
}

function ImplementationRoadmap({ notes }: { notes: ClientNote[] }) {
  const modules = parseRoadmapFromNotes(notes)
  if (modules.length === 0) return null

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Zap style={{ width: 14, height: 14, color: t.brand.gold }} />
        <SectionLabel>Roadmap Wdrożenia</SectionLabel>
      </div>
      <div style={{
        display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4,
      }}>
        {modules.map((mod, i) => (
          <div
            key={i}
            style={{
              minWidth: 180, padding: 16,
              backgroundColor: t.bg.muted,
              border: `1px solid ${t.border.subtle}`,
              borderRadius: t.radius.md,
              display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0,
            }}
          >
            <Zap style={{ width: 18, height: 18, color: t.brand.gold }} />
            <div style={{ fontSize: 13, fontWeight: 700, color: t.text.primary }}>{mod.title}</div>
            <p style={{ fontSize: 12, color: t.text.muted, lineHeight: 1.5, margin: 0, flex: 1 }}>
              {mod.description}
            </p>
            <span style={{
              fontSize: 10, fontWeight: 600, color: t.text.muted,
              backgroundColor: t.bg.muted, border: `1px solid ${t.border.default}`,
              padding: '2px 8px', borderRadius: t.radius.full, alignSelf: 'flex-start',
            }}>
              {mod.status}
            </span>
          </div>
        ))}
      </div>
    </Card>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PrepPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  // AI Brief state
  const [brief, setBrief] = useState<MeetingBrief | null>(null)
  const [clientSnap, setClientSnap] = useState<ClientSnapshot | null>(null)
  const [clientName, setClientName] = useState<string>('')
  const [isMock, setIsMock] = useState(false)
  const [briefModel, setBriefModel] = useState<string | null>(null)
  const [briefLoading, setBriefLoading] = useState(false)
  const [briefError, setBriefError] = useState<string | null>(null)

  // Loading message cycling
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0)
  const loadingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Notes state
  const [notes, setNotes] = useState<ClientNote[]>([])
  const [notesLoading, setNotesLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)

  // New note form
  const [noteContent, setNoteContent] = useState('')
  const [noteSource, setNoteSource] = useState<NoteSource>('manual')
  const [noteImportance, setNoteImportance] = useState<NoteImportance>('medium')
  const [savingNote, setSavingNote] = useState(false)

  // Cycle loading messages while loading
  useEffect(() => {
    if (briefLoading) {
      setLoadingMsgIdx(0)
      loadingTimer.current = setTimeout(function cycle() {
        setLoadingMsgIdx((prev) => {
          const next = prev + 1 < LOADING_MESSAGES.length ? prev + 1 : prev
          if (next < LOADING_MESSAGES.length - 1) {
            loadingTimer.current = setTimeout(cycle, 3000)
          }
          return next
        })
      }, 3000)
    } else {
      if (loadingTimer.current) clearTimeout(loadingTimer.current)
    }
    return () => {
      if (loadingTimer.current) clearTimeout(loadingTimer.current)
    }
  }, [briefLoading])

  const fetchNotes = useCallback(async () => {
    setNotesLoading(true)
    try {
      const res = await fetch(`/api/clients/${id}/notes`)
      const data = await res.json() as { notes?: ClientNote[] }
      setNotes(data.notes ?? [])
    } catch {
      setNotes([])
    } finally {
      setNotesLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchNotes()
  }, [fetchNotes])

  const generateBrief = async () => {
    setBriefLoading(true)
    setBriefError(null)
    setBrief(null)
    try {
      const res = await fetch(`/api/clients/${id}/meeting-prep`)
      if (!res.ok) {
        const errData = await res.json().catch(() => ({})) as { error?: string }
        setBriefError(errData.error ?? 'Nie udało się wygenerować briefu.')
        return
      }
      const data = await res.json() as BriefResponse
      setBrief(data.brief)
      setClientName(data.client_name ?? '')
      setIsMock(data.is_mock ?? false)
      setBriefModel(data.model ?? null)
      // Populate client snapshot from brief response if not yet set
      if (!clientSnap && data.client_name) {
        setClientSnap({
          id,
          name: data.client_name,
          status: 'lead',
          created_at: new Date().toISOString(),
        })
      }
      // Surface API error as error state if brief has _error flag
      if (data.brief?._error) {
        setBriefError(data.error ?? 'Nie udało się wygenerować briefu AI.')
      }
    } catch {
      setBriefError('Nie udało się połączyć z serwerem. Sprawdź połączenie.')
    } finally {
      setBriefLoading(false)
    }
  }

  const saveNote = async () => {
    if (!noteContent.trim()) return
    setSavingNote(true)
    try {
      const res = await fetch(`/api/clients/${id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: noteContent, source: noteSource, importance: noteImportance }),
      })
      if (res.ok) {
        setNoteContent('')
        setNoteSource('manual')
        setNoteImportance('medium')
        setShowAddForm(false)
        await fetchNotes()
      }
    } finally {
      setSavingNote(false)
    }
  }

  const displayName = clientSnap?.name ?? clientName ?? 'Klient'

  return (
    <>
      {/* Inline keyframe styles */}
      <style>{`
        @keyframes shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes pulse-ring {
          0%   { transform: scale(0.95); opacity: 0.6; }
          70%  { transform: scale(1.25); opacity: 0; }
          100% { transform: scale(0.95); opacity: 0; }
        }
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(196,154,46,0.4); }
          50%       { box-shadow: 0 0 0 8px rgba(196,154,46,0); }
        }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

        {/* Page header nav */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => router.push(`/dashboard/clients/${id}`)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'none', border: 'none', cursor: 'pointer',
                color: t.text.muted, fontSize: 14, padding: 0, transition: 'color 150ms',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = t.text.primary }}
              onMouseLeave={(e) => { e.currentTarget.style.color = t.text.muted }}
            >
              <ArrowLeft style={{ width: 16, height: 16 }} />
              {displayName}
            </button>
            <span style={{ color: t.border.default }}>/</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: t.text.primary }}>Przygotowanie do calla</span>
          </div>
          {isMock && (
            <span style={{
              fontSize: 12, color: t.semantic.warning,
              backgroundColor: t.semantic.warningBg,
              border: `1px solid ${t.semantic.warningBorder}`,
              padding: '3px 10px', borderRadius: t.radius.full,
            }}>
              Tryb demo — brak klucza AI lub błąd
            </span>
          )}
        </div>

        {/* SECTION 1: Client Snapshot */}
        <ClientSnapshot client={clientSnap} clientName={displayName} />

        {/* SECTION 2: Deal Pipeline */}
        <DealPipeline status={clientSnap?.status} />

        {/* SECTION 3: Two-column layout — 58% / 42% */}
        <div style={{ display: 'grid', gridTemplateColumns: '58fr 42fr', gap: 24, alignItems: 'start' }}>

          {/* LEFT — AI Meeting Brief Panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <Card style={{ marginBottom: briefLoading || brief ? 14 : 0 }}>
              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Sparkles style={{ width: 17, height: 17, color: t.brand.gold }} />
                  <span style={{ fontSize: 15, fontWeight: 700, color: t.text.primary }}>AI Meeting Brief</span>
                  {briefModel && (
                    <span style={{
                      fontSize: 10, fontWeight: 600, color: t.text.muted,
                      backgroundColor: t.bg.muted, border: `1px solid ${t.border.default}`,
                      padding: '2px 8px', borderRadius: t.radius.full,
                      letterSpacing: '0.04em',
                    }}>
                      {briefModel.replace('claude-', '').replace('-20251001', '')}
                    </span>
                  )}
                </div>
                <button
                  onClick={generateBrief}
                  disabled={briefLoading}
                  style={{
                    background: t.brand.gold, color: '#000', border: 'none',
                    borderRadius: t.radius.md, padding: '9px 18px',
                    fontSize: 13, fontWeight: 700,
                    cursor: briefLoading ? 'not-allowed' : 'pointer',
                    opacity: briefLoading ? 0.7 : 1, transition: 'all 150ms',
                    display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
                    boxShadow: briefLoading ? 'none' : t.shadow.btn,
                  }}
                  onMouseEnter={(e) => { if (!briefLoading) e.currentTarget.style.transform = 'translateY(-1px)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)' }}
                >
                  <Sparkles style={{ width: 13, height: 13 }} />
                  {briefLoading ? 'Generuję...' : brief ? 'Wygeneruj ponownie' : 'Generuj Brief'}
                </button>
              </div>

              {/* Loading state */}
              {briefLoading && <BriefLoading message={LOADING_MESSAGES[loadingMsgIdx]} />}

              {/* Error state */}
              {!briefLoading && briefError && (
                <BriefError error={briefError} onRetry={generateBrief} />
              )}

              {/* Idle state — placeholder */}
              {!briefLoading && !brief && !briefError && <BriefPlaceholder />}
            </Card>

            {/* Brief sections rendered below header card */}
            {!briefLoading && brief && !brief._error && <BriefContent brief={brief} />}
          </div>

          {/* RIGHT — Notes + Timeline + Smart Ingest */}
          <IntelligencePanel
            notes={notes}
            notesLoading={notesLoading}
            showAddForm={showAddForm}
            setShowAddForm={setShowAddForm}
            noteContent={noteContent}
            setNoteContent={setNoteContent}
            noteSource={noteSource}
            setNoteSource={setNoteSource}
            noteImportance={noteImportance}
            setNoteImportance={setNoteImportance}
            savingNote={savingNote}
            saveNote={saveNote}
            clientId={id}
            onIngestComplete={fetchNotes}
          />
        </div>

        {/* SECTION 4: Implementation Roadmap (conditional) */}
        {!notesLoading && notes.length > 0 && <ImplementationRoadmap notes={notes} />}

      </div>
    </>
  )
}
