'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Brain, Zap, Globe, Search, Shield, Target, MessageSquare, Network, Play, RefreshCw, FlaskConical, Image as ImageIcon, FileText, Layout, Mic, Link2, X } from 'lucide-react'
import { t } from '@/lib/tokens'
import { formatPLN } from '@/lib/format'
import { GlobalStackMap } from './global-stack-map'
import { AnalyzerTab } from './analyzer-tab'
import type { StackItem, Client, StackItemStatus } from '@/lib/types'

type Tab = 'command' | 'stack' | 'scout' | 'radar' | 'analyzer'

interface IntelligenceHubProps {
  initialItems: StackItem[]
  clients: Pick<Client, 'id' | 'name' | 'status' | 'industry'>[]
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

function StatsBar({ items }: { items: StackItem[] }) {
  const live = items.filter(i => i.status === 'live').length
  const inProgress = items.filter(i => i.status === 'in_progress').length
  const errors = items.filter(i => i.status === 'error').length
  const monthlyValue = items
    .filter(i => i.status === 'live' && i.monthly_value_pln)
    .reduce((s, i) => s + (i.monthly_value_pln ?? 0), 0)

  const stats = [
    { label: 'Wdrożenia Live',    value: String(live),                                    color: t.semantic.success },
    { label: 'W toku',            value: String(inProgress),                               color: '#818CF8' },
    { label: 'Błędy',             value: String(errors),                                   color: t.semantic.error },
    { label: 'Wartość miesięczna', value: monthlyValue > 0 ? formatPLN(monthlyValue) : '—', color: '#C9A84C' },
    { label: 'Klientów aktywnych', value: String(new Set(items.map(i => i.client_id)).size), color: t.text.secondary },
  ]

  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
      {stats.map(s => (
        <div key={s.label} style={{
          background: t.bg.card, border: `1px solid ${t.border.subtle}`,
          borderRadius: t.radius.md, padding: '12px 18px',
          flex: '1 1 130px', minWidth: 100,
        }}>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: t.text.muted, marginBottom: 4 }}>
            {s.label}
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Command Center — agent cards ─────────────────────────────────────────────

const AGENT_CARDS = [
  {
    id: 'scout',
    icon: Search,
    name: 'Scout',
    role: 'Content Analyst',
    description: 'Wklej URL lub tekst → dostaniesz: summary, insights, decyzję BUILD/SKIP/MONITOR.',
    model: 'Sonnet',
    status: 'live' as const,
    action: 'Analizuj treść',
    tab: 'scout' as Tab,
    color: '#818CF8',
  },
  {
    id: 'radar',
    icon: Globe,
    name: 'Radar',
    role: 'Chief Intelligence Officer',
    description: 'Live panel AI/crypto/tech. Haiku filtruje szum — Radar dostarcza sygnały co 20 minut.',
    model: 'Sonnet + Haiku',
    status: 'live' as const,
    action: 'Zobacz Radar',
    tab: 'radar' as Tab,
    color: '#34D399',
  },
  {
    id: 'analyzer',
    icon: FlaskConical,
    name: 'Analizator',
    role: 'Implementation Intelligence',
    description: 'Wklej link, screenshot lub pomysł — Analizator porówna z systemem 77STF, oceni czy to najlepsze wdrożenie, wyliczy ROI per klient i zaproponuje alternatywy.',
    model: 'Sonnet + Vision',
    status: 'live' as const,
    action: 'Analizuj wdrożenie',
    tab: 'analyzer' as Tab,
    color: '#818CF8',
  },
  {
    id: 'architect',
    icon: Network,
    name: 'Architect',
    role: 'Solutions Architect',
    description: 'Stack wdrożeń dla klientów, ROI kalkulacje. Dostęp do stack_items + audit results.',
    model: 'Sonnet',
    status: 'live' as const,
    action: 'Otwórz Stack Map',
    tab: 'stack' as Tab,
    color: '#F59E0B',
  },
  {
    id: 'hunter',
    icon: Target,
    name: 'Hunter',
    role: 'Business Development',
    description: 'Lead research, scoring, cold outreach drafty. Zna bóle polskich MŚP.',
    model: 'Haiku + Sonnet',
    status: 'planned' as const,
    action: 'Kwalifikuj lead',
    tab: null,
    color: '#F87171',
  },
  {
    id: 'guardian',
    icon: Shield,
    name: 'Guardian',
    role: 'System Reliability',
    description: 'Monitoring systemu, pattern detection w błędach. Nigdy nie zmienia kodu — tylko raportuje.',
    model: 'Haiku + Sonnet',
    status: 'planned' as const,
    action: 'Health check',
    tab: null,
    color: '#60A5FA',
  },
  {
    id: 'pa',
    icon: MessageSquare,
    name: 'Personal Assistant',
    role: 'Life & Business Organizer',
    description: 'Szybka notatka z rozmowy → CRM task + calendar event. Wpisz w Slack #quick-notes.',
    model: 'Haiku + Sonnet',
    status: 'planned' as const,
    action: 'Quick note',
    tab: null,
    color: '#A78BFA',
  },
]

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string; border: string }> = {
  live:    { label: 'Live',     color: t.semantic.success, bg: t.semantic.successBg, border: t.semantic.successBorder },
  planned: { label: 'Planowane', color: t.text.muted,      bg: t.bg.muted,           border: t.border.subtle },
}

interface CommandCenterProps {
  onTabChange: (tab: Tab) => void
}

function CommandCenter({ onTabChange }: CommandCenterProps) {
  return (
    <div>
      <p style={{ color: t.text.muted, fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
        Wszystkie agenty w jednym miejscu. Każdy ma swoją rolę, model i zakres — żaden nie wychodzi poza swoje kompetencje.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
        {AGENT_CARDS.map(agent => {
          const Icon = agent.icon
          const badge = STATUS_BADGE[agent.status]
          return (
            <div key={agent.id} style={{
              background: t.bg.card,
              border: `1px solid ${t.border.default}`,
              borderTop: `3px solid ${agent.color}`,
              borderRadius: t.radius.md,
              padding: '18px 20px',
              display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: t.radius.sm, background: `${agent.color}18`, border: `1px solid ${agent.color}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={16} style={{ color: agent.color }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: t.text.primary }}>{agent.name}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: t.radius.full, color: badge.color, background: badge.bg, border: `1px solid ${badge.border}`, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {badge.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: t.text.muted, marginTop: 1 }}>{agent.role}</div>
                </div>
              </div>

              <p style={{ fontSize: 12, color: t.text.secondary, lineHeight: 1.6, margin: 0 }}>{agent.description}</p>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 4 }}>
                <span style={{ fontSize: 11, color: t.text.muted, fontFamily: 'monospace' }}>{agent.model}</span>
                <button
                  onClick={() => agent.tab && onTabChange(agent.tab)}
                  disabled={!agent.tab}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    background: agent.tab ? `${agent.color}18` : 'transparent',
                    border: `1px solid ${agent.tab ? `${agent.color}35` : t.border.subtle}`,
                    borderRadius: t.radius.sm,
                    padding: '5px 12px',
                    color: agent.tab ? agent.color : t.text.muted,
                    fontSize: 12, fontWeight: 600,
                    cursor: agent.tab ? 'pointer' : 'not-allowed',
                    opacity: agent.tab ? 1 : 0.5,
                  }}
                >
                  <Play size={10} /> {agent.action}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Content Scout ────────────────────────────────────────────────────────────

interface ScoutAnalysis {
  summary?: string
  key_insights?: string[]
  relevance_score?: number
  relevance_reason?: string
  applicable_to_77stf?: string[]
  decision?: string
  decision_reason?: string
  action_items?: string[]
  raw?: boolean
}

const DECISION_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  BUILD:          { color: t.semantic.success, bg: t.semantic.successBg,       border: t.semantic.successBorder },
  UPGRADE_AGENT:  { color: '#818CF8',          bg: 'rgba(129,140,248,0.1)',    border: 'rgba(129,140,248,0.25)' },
  ADD_TO_ROADMAP: { color: '#F59E0B',          bg: 'rgba(245,158,11,0.1)',     border: 'rgba(245,158,11,0.25)' },
  MONITOR:        { color: t.text.muted,       bg: t.bg.muted,                 border: t.border.subtle },
  SKIP:           { color: t.semantic.error,   bg: t.semantic.errorBg,         border: t.semantic.errorBorder },
}

const CONTENT_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  youtube_video:   { label: 'YouTube', color: '#F87171' },
  instagram_post:  { label: 'Instagram', color: '#F472B6' },
  web:             { label: 'Artykuł', color: '#818CF8' },
  text:            { label: 'Tekst', color: t.text.muted },
}

const TRANSCRIPT_METHOD_LABELS: Record<string, string> = {
  assemblyai_audio: 'transkrypt audio (AssemblyAI)',
  captions:         'transkrypt z napisów',
  metadata_only:    'brak transkryptu — tytuł i opis',
}

function ListCard({ title, items, bullet, bulletColor }: {
  title: string
  items: string[]
  bullet: string
  bulletColor: string
}) {
  return (
    <div style={{ background: t.bg.card, border: `1px solid ${t.border.subtle}`, borderRadius: t.radius.md, padding: '14px 16px' }}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: t.text.muted, marginBottom: 10 }}>{title}</div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((item, i) => (
          <li key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: t.text.secondary, lineHeight: 1.6 }}>
            <span style={{ color: bulletColor, flexShrink: 0, marginTop: 1, fontSize: 11 }}>{bullet}</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── Material type config ────────────────────────────────────────────────────

const MATERIAL_TYPES = [
  {
    id: 'auto',
    label: 'Auto-detect',
    icon: Link2,
    placeholder: 'https://youtube.com/... lub https://instagram.com/reel/... lub dowolny URL — Scout wykryje typ automatycznie',
    hint: 'Wklej link — Scout automatycznie pobierze transkrypt wideo lub treść artykułu.',
  },
  {
    id: 'carousel',
    label: 'Carousel / Infografika',
    icon: Layout,
    placeholder: 'Wklej tekst ze slajdów lub prześlij screenshot pierwszego slajdu.\nNp: "Slajd 1: Claude Obsidian = 71.5X less tokens\nSlajd 2: Jak to działa..."',
    hint: 'Scout traktuje to jako serię slajdów — wyciąga dane liczbowe, claims i techniki z każdego slajdu.',
    imageUpload: true,
  },
  {
    id: 'screenshot',
    label: 'Screenshot',
    icon: ImageIcon,
    placeholder: 'Opisz co widać na screenshocie lub prześlij obraz. Scout przeprowadzi analizę wizualną i tekstową.',
    hint: 'Scout wyciąga tekst z obrazu (OCR-style) i analizuje layout, UI patterns i kluczowe informacje.',
    imageUpload: true,
  },
  {
    id: 'transcript',
    label: 'Transkrypt / Tekst mówiony',
    icon: Mic,
    placeholder: 'Wklej transkrypt nagrania, podcastu lub wideo.\nNp: "Dzisiaj pokażę wam jak Claude może zastąpić 3 osoby w firmie..."',
    hint: 'Scout analizuje transkrypt jak materiał wideo — hook, struktura, techniki i zastosowanie dla 77STF.',
  },
  {
    id: 'article',
    label: 'Artykuł / Blog',
    icon: FileText,
    placeholder: 'Wklej tekst artykułu lub link do bloga.\nNp: https://techcrunch.com/... lub pełny tekst posta.',
    hint: 'Analiza treści artykułu — kluczowe insights, zastosowanie w 77STF, decyzja.',
  },
] as const

type MaterialTypeId = typeof MATERIAL_TYPES[number]['id']

function ContentScout() {
  const [materialType, setMaterialType] = useState<MaterialTypeId>('auto')
  const [content, setContent] = useState('')
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [imageName, setImageName] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<ScoutAnalysis | null>(null)
  const [contentType, setContentType] = useState<string>('text')
  const [transcriptMethod, setTranscriptMethod] = useState<string | undefined>()
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const currentMaterial = MATERIAL_TYPES.find(m => m.id === materialType) ?? MATERIAL_TYPES[0]
  const hasImageUpload = 'imageUpload' in currentMaterial && currentMaterial.imageUpload

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageName(file.name)
    const reader = new FileReader()
    reader.onload = ev => setImageBase64(ev.target?.result as string)
    reader.readAsDataURL(file)
  }, [])

  const analyze = useCallback(async () => {
    const inp = imageBase64 ?? content.trim()
    if (!inp || inp.length < 3) return
    setAnalyzing(true); setError(''); setResult(null); setContentType('text'); setTranscriptMethod(undefined)

    const body = imageBase64
      ? { content: imageBase64, type: 'image', material_hint: materialType }
      : { content: content.trim(), type: 'text', material_hint: materialType }

    const res = await fetch('/api/intelligence/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    setAnalyzing(false)
    if (res.ok) {
      const data = await res.json() as { analysis: ScoutAnalysis; content_type?: string; transcript_method?: string }
      setResult(data.analysis)
      setContentType(data.content_type ?? 'text')
      setTranscriptMethod(data.transcript_method)
    } else {
      const { error: msg } = await res.json() as { error: string }
      setError(msg ?? 'Błąd analizy')
    }
  }, [content, imageBase64, materialType])

  const clear = () => { setResult(null); setContent(''); setImageBase64(null); setImageName(''); setError('') }

  const isVideo = contentType === 'youtube_video' || contentType === 'instagram_post' || materialType === 'transcript'
  const decision = result?.decision ?? ''
  const dc = DECISION_COLORS[decision] ?? DECISION_COLORS.SKIP
  const ctLabel = CONTENT_TYPE_LABELS[contentType]
  const canSubmit = (imageBase64 ?? content.trim()).length >= 3

  return (
    <div style={{ maxWidth: 800 }}>
      <p style={{ color: t.text.muted, fontSize: 13, marginBottom: 18, lineHeight: 1.6 }}>
        Zwiadowca analizuje każdy format treści — wideo, carousel, screenshot, artykuł, transkrypt. Wybierz typ materiału dla precyzyjniejszej analizy.
      </p>

      {/* Material type selector */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {MATERIAL_TYPES.map(mt => {
          const Icon = mt.icon
          const isActive = materialType === mt.id
          return (
            <button
              key={mt.id}
              onClick={() => { setMaterialType(mt.id); setResult(null); setError(''); setImageBase64(null); setImageName('') }}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 12px', borderRadius: t.radius.sm,
                background: isActive ? 'rgba(196,154,46,0.15)' : 'transparent',
                border: `1px solid ${isActive ? 'rgba(196,154,46,0.4)' : t.border.subtle}`,
                color: isActive ? '#C49A2E' : t.text.muted,
                fontSize: 11, fontWeight: isActive ? 600 : 400, cursor: 'pointer',
              }}
            >
              <Icon size={11} /> {mt.label}
            </button>
          )
        })}
      </div>

      {/* Hint */}
      <div style={{ fontSize: 11, color: t.text.muted, marginBottom: 10, padding: '6px 10px', background: t.bg.muted, borderRadius: t.radius.sm, lineHeight: 1.55 }}>
        {currentMaterial.hint}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {/* Image upload (carousel/screenshot) */}
        {hasImageUpload && (
          <div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
            {imageBase64 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: t.bg.input, border: `1px solid ${t.border.default}`, borderRadius: t.radius.md }}>
                <ImageIcon size={14} style={{ color: '#C49A2E' }} />
                <span style={{ flex: 1, fontSize: 12, color: t.text.secondary }}>{imageName}</span>
                <button onClick={() => { setImageBase64(null); setImageName('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.text.muted, display: 'flex' }}>
                  <X size={13} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                style={{
                  width: '100%', padding: '18px', borderRadius: t.radius.md,
                  background: t.bg.input, border: `2px dashed ${t.border.default}`,
                  color: t.text.muted, fontSize: 12, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                <ImageIcon size={16} /> Kliknij aby wgrać obraz (opcjonalne — możesz też wkleić tekst)
              </button>
            )}
          </div>
        )}

        {/* Text input */}
        {!imageBase64 && (
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void analyze() }}
            rows={materialType === 'transcript' ? 6 : 4}
            placeholder={currentMaterial.placeholder}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: t.bg.input, border: `1px solid ${t.border.default}`,
              borderRadius: t.radius.md, padding: '12px 14px',
              color: t.text.primary, fontSize: 13, lineHeight: 1.6,
              outline: 'none', resize: 'vertical', fontFamily: 'inherit',
            }}
          />
        )}

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => void analyze()}
            disabled={analyzing || !canSubmit}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              background: t.brand.gold, border: 'none',
              borderRadius: t.radius.sm, padding: '9px 20px',
              color: '#111114', fontSize: 13, fontWeight: 700,
              cursor: (analyzing || !canSubmit) ? 'not-allowed' : 'pointer',
              opacity: (analyzing || !canSubmit) ? 0.6 : 1,
            }}
          >
            <Zap size={14} />
            {analyzing
              ? (materialType === 'auto' && isVideo ? 'Pobieram transkrypt...' : 'Analizuję...')
              : 'Analizuj (Scout)'}
          </button>
          {result && (
            <button
              onClick={clear}
              style={{ background: 'none', border: `1px solid ${t.border.subtle}`, borderRadius: t.radius.sm, padding: '8px 14px', color: t.text.muted, fontSize: 12, cursor: 'pointer' }}
            >
              Wyczyść
            </button>
          )}
          <span style={{ fontSize: 11, color: t.text.muted, marginLeft: 'auto' }}>
            Sonnet · Ctrl+Enter · limit 3/min
          </span>
        </div>
      </div>

      {error && (
        <div style={{ color: t.semantic.error, background: t.semantic.errorBg, border: `1px solid ${t.semantic.errorBorder}`, borderRadius: t.radius.sm, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Source + transcript method badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {ctLabel && (
              <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: t.radius.full, color: ctLabel.color, background: `${ctLabel.color}18`, border: `1px solid ${ctLabel.color}30` }}>
                {ctLabel.label}
              </span>
            )}
            {transcriptMethod && (
              <span style={{ fontSize: 11, color: t.text.muted, padding: '3px 10px', borderRadius: t.radius.full, border: `1px solid ${t.border.subtle}`, background: t.bg.muted }}>
                {TRANSCRIPT_METHOD_LABELS[transcriptMethod] ?? transcriptMethod}
              </span>
            )}
          </div>

          {/* Decision banner */}
          <div style={{ background: dc.bg, border: `1px solid ${dc.border}`, borderRadius: t.radius.md, padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: dc.color, letterSpacing: '-0.02em', flexShrink: 0, marginTop: 1 }}>{decision}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: dc.color, marginBottom: 4 }}>Decyzja</div>
              <div style={{ fontSize: 13, color: t.text.secondary, lineHeight: 1.6 }}>{result.decision_reason}</div>
            </div>
            {result.relevance_score !== undefined && (
              <div style={{ textAlign: 'center', flexShrink: 0 }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: dc.color, lineHeight: 1 }}>{result.relevance_score}</div>
                <div style={{ fontSize: 9, color: t.text.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>/10</div>
              </div>
            )}
          </div>

          {/* Summary */}
          {result.summary && (
            <div style={{ background: t.bg.card, border: `1px solid ${t.border.subtle}`, borderRadius: t.radius.md, padding: '14px 18px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: t.text.muted, marginBottom: 8 }}>O czym jest</div>
              <p style={{ fontSize: 13, color: t.text.secondary, lineHeight: 1.7, margin: 0 }}>{result.summary}</p>
              {result.relevance_reason && (
                <p style={{ fontSize: 12, color: t.text.muted, lineHeight: 1.6, margin: '8px 0 0', borderTop: `1px solid ${t.border.subtle}`, paddingTop: 8 }}>
                  {result.relevance_reason}
                </p>
              )}
            </div>
          )}

          {/* Key insights + applicable + actions */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
            {result.key_insights && result.key_insights.length > 0 && (
              <ListCard
                title={isVideo ? 'Techniki do skopiowania' : 'Key Insights'}
                items={result.key_insights}
                bullet="→"
                bulletColor="#818CF8"
              />
            )}
            {result.applicable_to_77stf && result.applicable_to_77stf.length > 0 && (
              <ListCard
                title="Zastosowanie dla 77STF"
                items={result.applicable_to_77stf}
                bullet="✓"
                bulletColor={t.semantic.success}
              />
            )}
            {result.action_items && result.action_items.length > 0 && decision !== 'SKIP' && (
              <ListCard
                title={isVideo ? 'Propozycje rolek dla 77STF' : 'Akcje'}
                items={result.action_items}
                bullet="□"
                bulletColor={dc.color}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── World Radar ──────────────────────────────────────────────────────────────

interface DigestHighlight {
  title: string
  url: string
  score: number
  category: string
  source: string
  reason: string
}

interface Digest {
  id: string
  generated_at: string
  source_count: number
  categories: string[]
  highlights: DigestHighlight[]
  trigger: string
  metadata: { scored_count?: number; total_fetched?: number }
  model: string
}

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  ai_tech:  { label: 'AI & Tech',  color: '#818CF8' },
  crypto:   { label: 'Crypto',     color: '#F59E0B' },
  business: { label: 'Biznes',     color: '#34D399' },
  saas:     { label: 'SaaS',       color: '#60A5FA' },
}

const STALE_MS = 30 * 60 * 1000    // 30 min → auto-refresh
const LIVE_REFRESH_MS = 20 * 60 * 1000  // 20 min interval

interface MarketData {
  usd_pln: number | null
  btc_usd: number | null
  eth_usd: number | null
  gold_usd: number | null
  gold_pln: number | null
  btc_change_24h: number | null
  eth_change_24h: number | null
}

function MarketTicker() {
  const [market, setMarket] = useState<MarketData | null>(null)

  useEffect(() => {
    fetch('/api/rates/market')
      .then(r => r.ok ? r.json() as Promise<MarketData> : null)
      .then(d => { if (d) setMarket(d) })
      .catch(() => null)
  }, [])

  if (!market) return null

  const fmtChange = (c: number | null) => {
    if (c === null) return null
    const sign = c >= 0 ? '+' : ''
    const color = c >= 0 ? '#4ade80' : '#f87171'
    return <span style={{ color, fontSize: 10 }}>{sign}{c.toFixed(1)}%</span>
  }

  const fmtK = (v: number | null) => {
    if (v === null) return '—'
    if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`
    return `$${v.toFixed(0)}`
  }

  const TICKERS = [
    { label: 'BTC', value: fmtK(market.btc_usd), change: fmtChange(market.btc_change_24h), color: '#F59E0B' },
    { label: 'ETH', value: fmtK(market.eth_usd), change: fmtChange(market.eth_change_24h), color: '#818CF8' },
    { label: 'XAU', value: market.gold_usd ? `$${Math.round(market.gold_usd)}` : '—', change: null, color: '#C49A2E' },
    { label: 'USD/PLN', value: market.usd_pln ? market.usd_pln.toFixed(4) : '—', change: null, color: '#34D399' },
  ]

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
      {TICKERS.map(tk => (
        <div key={tk.label} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 14px', borderRadius: t.radius.md,
          background: t.bg.card, border: `1px solid ${t.border.subtle}`,
          flex: '1 1 120px',
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: tk.color, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: t.text.muted }}>{tk.label}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.text.primary, lineHeight: 1.2 }}>{tk.value}</div>
          </div>
          {tk.change && <div style={{ marginLeft: 'auto' }}>{tk.change}</div>}
        </div>
      ))}
    </div>
  )
}

function WorldRadar() {
  const [highlights, setHighlights] = useState<DigestHighlight[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [sourceCount, setSourceCount] = useState(0)
  const [error, setError] = useState('')
  const [activeFilter, setActiveFilter] = useState<string | null>(null)

  const runRadar = useCallback(async (trigger: 'auto' | 'manual' = 'manual') => {
    setRefreshing(true); setError('')
    const res = await fetch('/api/intelligence/radar/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trigger }),
    })
    setRefreshing(false)
    if (res.ok) {
      const data = await res.json() as { highlights: DigestHighlight[]; source_count: number }
      setHighlights(data.highlights ?? [])
      setSourceCount(data.source_count ?? 0)
      setLastUpdated(new Date())
    } else if (res.status !== 429) {
      const { error: msg } = await res.json() as { error: string }
      setError(msg ?? 'Błąd pobierania newsów')
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      const res = await fetch('/api/intelligence/radar')
      if (res.ok) {
        const { digests } = await res.json() as { digests: Digest[] }
        if (digests.length > 0) {
          const latest = digests[0]
          const age = Date.now() - new Date(latest.generated_at).getTime()
          if (age < STALE_MS) {
            setHighlights(latest.highlights ?? [])
            setSourceCount(latest.source_count ?? 0)
            setLastUpdated(new Date(latest.generated_at))
            setLoading(false)
            return
          }
        }
      }
      setLoading(false)
      void runRadar('auto')
    }
    void init()
    const interval = setInterval(() => { void runRadar('auto') }, LIVE_REFRESH_MS)
    return () => clearInterval(interval)
  }, [runRadar])

  const categories = [...new Set(highlights.map(h => h.category))]
  const filtered = activeFilter ? highlights.filter(h => h.category === activeFilter) : highlights

  return (
    <div style={{ maxWidth: 960 }}>
      {/* Market ticker */}
      <MarketTicker />

      {/* Status bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {/* Live indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: refreshing ? '#F59E0B' : '#34D399', display: 'inline-block', animation: refreshing ? 'pulse 1s infinite' : 'none' }} />
              <span style={{ fontSize: 11, color: t.text.muted }}>{refreshing ? 'Aktualizuję...' : 'Live'}</span>
            </div>
            {lastUpdated && !refreshing && (
              <span style={{ fontSize: 11, color: t.text.muted }}>
                · aktualizacja: {lastUpdated.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            {sourceCount > 0 && (
              <span style={{ fontSize: 11, color: t.text.muted }}>
                · {highlights.length} sygnałów z {sourceCount} źródeł
              </span>
            )}
          </div>
          {/* Category filters */}
          {categories.length > 1 && (
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              <button
                onClick={() => setActiveFilter(null)}
                style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: t.radius.full, border: `1px solid ${activeFilter === null ? 'rgba(255,255,255,0.2)' : t.border.subtle}`, background: activeFilter === null ? 'rgba(255,255,255,0.08)' : 'transparent', color: activeFilter === null ? t.text.primary : t.text.muted, cursor: 'pointer' }}
              >
                Wszystkie
              </button>
              {categories.map(cat => {
                const c = CATEGORY_LABELS[cat]
                if (!c) return null
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveFilter(activeFilter === cat ? null : cat)}
                    style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: t.radius.full, border: `1px solid ${activeFilter === cat ? `${c.color}50` : t.border.subtle}`, background: activeFilter === cat ? `${c.color}18` : 'transparent', color: activeFilter === cat ? c.color : t.text.muted, cursor: 'pointer' }}
                  >
                    {c.label}
                  </button>
                )
              })}
            </div>
          )}
        </div>
        <button
          onClick={() => void runRadar('manual')}
          disabled={refreshing}
          style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, background: 'none', border: `1px solid ${t.border.default}`, borderRadius: t.radius.sm, padding: '6px 14px', color: refreshing ? t.text.muted : t.text.secondary, fontSize: 12, fontWeight: 500, cursor: refreshing ? 'not-allowed' : 'pointer' }}
        >
          <RefreshCw size={12} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          Odśwież
        </button>
      </div>

      {error && (
        <div style={{ color: t.semantic.error, background: t.semantic.errorBg, border: `1px solid ${t.semantic.errorBorder}`, borderRadius: t.radius.sm, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* News grid */}
      {loading || (refreshing && highlights.length === 0) ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ background: t.bg.card, border: `1px solid ${t.border.subtle}`, borderRadius: t.radius.md, padding: '14px 16px', height: 120, animation: `pulse 1.5s ease-in-out ${i * 0.1}s infinite alternate` }}>
              <div style={{ height: 8, background: t.bg.muted, borderRadius: t.radius.full, marginBottom: 10, width: '60%' }} />
              <div style={{ height: 12, background: t.bg.muted, borderRadius: t.radius.full, marginBottom: 8 }} />
              <div style={{ height: 12, background: t.bg.muted, borderRadius: t.radius.full, width: '80%' }} />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ background: t.bg.card, border: `1px solid ${t.border.subtle}`, borderRadius: t.radius.md, padding: '40px 24px', textAlign: 'center', color: t.text.muted }}>
          <Globe size={28} style={{ color: t.border.default, marginBottom: 12 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: t.text.secondary, marginBottom: 6 }}>Brak sygnałów</div>
          <div style={{ fontSize: 13 }}>Radar skanuje Hacker News i CoinGecko co 20 minut.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
          {filtered.map((h, i) => {
            const cat = CATEGORY_LABELS[h.category]
            const scoreColor = h.score >= 8 ? '#34D399' : h.score >= 6 ? '#818CF8' : t.text.muted
            return (
              <a key={i} href={h.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', display: 'block' }}>
                <div
                  style={{ background: t.bg.card, border: `1px solid ${t.border.default}`, borderRadius: t.radius.md, padding: '14px 16px', height: '100%', display: 'flex', flexDirection: 'column', gap: 8, cursor: 'pointer', transition: 'border-color 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = t.border.default)}
                >
                  {/* Score + category + source */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{ width: 26, height: 26, borderRadius: '50%', background: `${scoreColor}20`, border: `1px solid ${scoreColor}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: scoreColor, flexShrink: 0 }}>
                      {h.score}
                    </div>
                    {cat && (
                      <span style={{ fontSize: 10, fontWeight: 600, color: cat.color, background: `${cat.color}15`, border: `1px solid ${cat.color}30`, borderRadius: t.radius.full, padding: '2px 7px' }}>
                        {cat.label}
                      </span>
                    )}
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: t.text.muted, flexShrink: 0 }}>{h.source}</span>
                  </div>
                  {/* Title */}
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.text.primary, lineHeight: 1.4 }}>{h.title}</div>
                  {/* Reason */}
                  <div style={{ fontSize: 11, color: t.text.muted, lineHeight: 1.5, marginTop: 'auto' }}>{h.reason}</div>
                </div>
              </a>
            )
          })}
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @keyframes pulse { from { opacity: 0.6 } to { opacity: 1 } }
      `}</style>
    </div>
  )
}

// ─── Main Hub ─────────────────────────────────────────────────────────────────

export function IntelligenceHub({ initialItems, clients }: IntelligenceHubProps) {
  const [activeTab, setActiveTab] = useState<Tab>('command')

  const tabs: { id: Tab; label: string; icon: React.ElementType; badge?: string }[] = [
    { id: 'command',  label: 'Command Center', icon: Brain },
    { id: 'stack',    label: 'Stack Map',      icon: Network,       badge: String(initialItems.length) },
    { id: 'scout',    label: 'Zwiadowca',      icon: Search,        badge: 'AI' },
    { id: 'radar',    label: 'Radar',          icon: Globe,         badge: 'Live' },
    { id: 'analyzer', label: 'Analizator',     icon: FlaskConical,  badge: 'AI' },
  ]

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <div style={{ width: 36, height: 36, borderRadius: t.radius.sm, background: 'rgba(129,140,248,0.15)', border: '1px solid rgba(129,140,248,0.30)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Brain size={18} style={{ color: '#818CF8' }} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: t.text.primary, margin: 0 }}>Wywiad</h1>
        </div>
        <p style={{ color: t.text.muted, fontSize: 13, margin: 0 }}>
          Jeden panel — wszystkie agenty, globalny stack klientów, analiza treści.
        </p>
      </div>

      {/* Stats */}
      <StatsBar items={initialItems} />

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, background: t.bg.muted, borderRadius: t.radius.sm, padding: 3, marginBottom: 24, width: 'fit-content' }}>
        {tabs.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: t.radius.xs,
                background: isActive ? t.bg.cardSolid : 'transparent',
                border: 'none', color: isActive ? t.text.primary : t.text.muted,
                fontSize: 13, fontWeight: isActive ? 600 : 400,
                cursor: 'pointer', transition: 'all 0.12s',
                boxShadow: isActive ? t.shadow.sm : 'none',
              }}
            >
              <Icon size={14} />
              {tab.label}
              {tab.badge && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: t.radius.full, background: isActive ? 'rgba(129,140,248,0.2)' : t.bg.overlay, color: isActive ? '#818CF8' : t.text.muted, border: `1px solid ${isActive ? 'rgba(129,140,248,0.3)' : t.border.subtle}` }}>
                  {tab.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'command'  && <CommandCenter onTabChange={setActiveTab} />}
      {activeTab === 'stack'    && <GlobalStackMap items={initialItems} clients={clients} />}
      {activeTab === 'scout'    && <ContentScout />}
      {activeTab === 'radar'    && <WorldRadar />}
      {activeTab === 'analyzer' && <AnalyzerTab />}
    </div>
  )
}
