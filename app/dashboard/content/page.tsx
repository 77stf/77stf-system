'use client'

import { useState, useCallback, useEffect } from 'react'
import { Zap, Plus, Trash2, Sparkles, ChevronDown, ChevronUp, LayoutGrid, Copy, Download } from 'lucide-react'
import { t } from '@/lib/tokens'
import { formatDate } from '@/lib/format'
import type { CarouselResult, CarouselSlide } from '@/app/api/content/carousel/route'

// ─── Types ────────────────────────────────────────────────────────────────────

type Platform = 'instagram' | 'linkedin' | 'youtube' | 'tiktok' | 'twitter'
type PostStatus = 'idea' | 'draft' | 'ready' | 'scheduled' | 'published'
type PostType = 'post' | 'reel' | 'story' | 'carousel' | 'video' | 'thread'

interface ContentPost {
  id: string
  title: string
  caption?: string
  platform: Platform
  status: PostStatus
  post_type: PostType
  scheduled_at?: string
  published_at?: string
  hashtags: string[]
  topics: string[]
  notes?: string
  ai_generated: boolean
  created_at: string
}

interface IdeaPost {
  title: string
  caption: string
  hashtags: string[]
  post_type: string
  topics: string[]
  hook: string
}

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<PostStatus, { label: string; color: string; bg: string; border: string }> = {
  idea:      { label: 'Pomysł',     color: 'rgba(255,255,255,0.4)',  bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.08)' },
  draft:     { label: 'Draft',      color: '#fbbf24',                 bg: 'rgba(251,191,36,0.1)',   border: 'rgba(251,191,36,0.25)' },
  ready:     { label: 'Gotowy',     color: '#818CF8',                 bg: 'rgba(129,140,248,0.1)',  border: 'rgba(129,140,248,0.25)' },
  scheduled: { label: 'Zaplanowany',color: '#34D399',                 bg: 'rgba(52,211,153,0.1)',   border: 'rgba(52,211,153,0.25)' },
  published: { label: 'Opublikowany',color: '#4ade80',                bg: 'rgba(74,222,128,0.08)', border: 'rgba(74,222,128,0.2)' },
}

// Inline SVG platform icons (lucide-react lacks social icons)
const PlatformIcon = ({ platform, size = 14 }: { platform: Platform; size?: number }) => {
  const color = PLATFORM_COLORS[platform]
  if (platform === 'instagram') return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill={color} stroke="none"/>
    </svg>
  )
  if (platform === 'linkedin') return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z"/><circle cx="4" cy="4" r="2"/>
    </svg>
  )
  if (platform === 'youtube') return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M22.54 6.42a2.78 2.78 0 00-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 00-1.95 1.96A29 29 0 001 12a29 29 0 00.46 5.58A2.78 2.78 0 003.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 001.95-1.95A29 29 0 0023 12a29 29 0 00-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="white"/>
    </svg>
  )
  return <Zap size={size} style={{ color }} />
}

const PLATFORM_COLORS: Record<Platform, string> = {
  instagram: '#E1306C',
  linkedin:  '#0A66C2',
  youtube:   '#FF0000',
  tiktok:    '#69C9D0',
  twitter:   '#1DA1F2',
}

const STATUS_ORDER: PostStatus[] = ['idea', 'draft', 'ready', 'scheduled', 'published']

// ─── Post card ────────────────────────────────────────────────────────────────

function PostCard({ post, onDelete, onStatusChange }: {
  post: ContentPost
  onDelete: (id: string) => void
  onStatusChange: (id: string, status: PostStatus) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const sc = STATUS_CONFIG[post.status]
  const platform = post.platform

  return (
    <div style={{ background: t.bg.card, border: `1px solid ${t.border.default}`, borderRadius: 10, overflow: 'hidden' }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
      >
        <PlatformIcon platform={platform} size={14} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.text.primary, marginBottom: 2 }}>{post.title}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 12, color: sc.color, background: sc.bg, border: `1px solid ${sc.border}` }}>{sc.label}</span>
            <span style={{ fontSize: 10, color: t.text.muted }}>{post.post_type}</span>
            {post.ai_generated && <span style={{ fontSize: 10, color: '#818CF8' }}>✦ AI</span>}
            {post.scheduled_at && <span style={{ fontSize: 10, color: t.text.muted }}>{formatDate(post.scheduled_at)}</span>}
          </div>
        </div>
        {expanded ? <ChevronUp size={13} style={{ color: t.text.muted }} /> : <ChevronDown size={13} style={{ color: t.text.muted }} />}
      </div>

      {expanded && (
        <div style={{ borderTop: `1px solid ${t.border.subtle}`, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {post.caption && (
            <div>
              <div style={{ fontSize: 10, color: t.text.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Caption</div>
              <p style={{ fontSize: 13, color: t.text.secondary, lineHeight: 1.65, margin: 0, whiteSpace: 'pre-wrap' }}>{post.caption}</p>
            </div>
          )}
          {post.hashtags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {post.hashtags.map(h => (
                <span key={h} style={{ fontSize: 11, color: '#818CF8', background: 'rgba(129,140,248,0.08)', padding: '1px 7px', borderRadius: 12 }}>{h}</span>
              ))}
            </div>
          )}
          {/* Status change */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 4, borderTop: `1px solid ${t.border.subtle}` }}>
            {STATUS_ORDER.filter(s => s !== post.status).map(s => (
              <button
                key={s}
                onClick={() => onStatusChange(post.id, s)}
                style={{ fontSize: 11, padding: '3px 10px', borderRadius: 12, background: STATUS_CONFIG[s].bg, border: `1px solid ${STATUS_CONFIG[s].border}`, color: STATUS_CONFIG[s].color, cursor: 'pointer' }}
              >
                → {STATUS_CONFIG[s].label}
              </button>
            ))}
            <button
              onClick={() => onDelete(post.id)}
              style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '3px 10px', borderRadius: 12, background: t.semantic.errorBg, border: `1px solid ${t.semantic.errorBorder}`, color: t.semantic.error, cursor: 'pointer' }}
            >
              <Trash2 size={10} /> Usuń
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Kanban column ────────────────────────────────────────────────────────────

function KanbanColumn({ status, posts, onDelete, onStatusChange }: {
  status: PostStatus
  posts: ContentPost[]
  onDelete: (id: string) => void
  onStatusChange: (id: string, status: PostStatus) => void
}) {
  const sc = STATUS_CONFIG[status]
  return (
    <div style={{ minWidth: 280, flex: '0 0 280px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ width: 8, height: 8, borderRadius: 2, background: sc.color }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: t.text.secondary }}>{sc.label}</span>
        <span style={{ fontSize: 11, color: t.text.muted, background: t.bg.muted, padding: '1px 7px', borderRadius: 12 }}>{posts.length}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 80 }}>
        {posts.map(p => (
          <PostCard key={p.id} post={p} onDelete={onDelete} onStatusChange={onStatusChange} />
        ))}
      </div>
    </div>
  )
}

// ─── Add post form ────────────────────────────────────────────────────────────

function AddPostModal({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({
    title: '', caption: '', platform: 'instagram' as Platform, post_type: 'post' as PostType,
    status: 'idea' as PostStatus, hashtags: '', scheduled_at: '', topics: '',
  })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    await fetch('/api/content/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        hashtags: form.hashtags.split(/[\s,]+/).filter(h => h.startsWith('#')),
        topics:   form.topics.split(',').map(s => s.trim()).filter(Boolean),
        scheduled_at: form.scheduled_at || null,
      }),
    })
    setSaving(false)
    onSave()
    onClose()
  }

  const fieldStyle = {
    width: '100%', boxSizing: 'border-box' as const,
    background: t.bg.input, border: `1px solid ${t.border.default}`,
    borderRadius: 8, padding: '8px 12px',
    color: t.text.primary, fontSize: 13, outline: 'none', fontFamily: 'inherit',
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#1A1A1E', border: `1px solid ${t.border.default}`, borderRadius: 14, width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: t.text.primary }}>Nowy post</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: t.text.muted, cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input placeholder="Tytuł *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={fieldStyle} />
          <textarea placeholder="Caption (tekst posta)" value={form.caption} onChange={e => setForm(f => ({ ...f, caption: e.target.value }))} rows={5} style={{ ...fieldStyle, resize: 'vertical' }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <select value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value as Platform }))} style={fieldStyle}>
              {(['instagram','linkedin','youtube','tiktok','twitter'] as Platform[]).map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={form.post_type} onChange={e => setForm(f => ({ ...f, post_type: e.target.value as PostType }))} style={fieldStyle}>
              {(['post','reel','story','carousel','video','thread'] as PostType[]).map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as PostStatus }))} style={fieldStyle}>
              {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
            </select>
            <input type="datetime-local" value={form.scheduled_at} onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))} style={fieldStyle} />
          </div>
          <input placeholder="#hashtagi oddzielone spacją" value={form.hashtags} onChange={e => setForm(f => ({ ...f, hashtags: e.target.value }))} style={fieldStyle} />
          <input placeholder="Topics (ai, business, promo...)" value={form.topics} onChange={e => setForm(f => ({ ...f, topics: e.target.value }))} style={fieldStyle} />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
            <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 8, background: 'none', border: `1px solid ${t.border.default}`, color: t.text.muted, fontSize: 13, cursor: 'pointer' }}>Anuluj</button>
            <button onClick={save} disabled={saving || !form.title.trim()} style={{ padding: '8px 20px', borderRadius: 8, background: t.brand.gold, border: 'none', color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              {saving ? 'Zapisuję...' : 'Zapisz'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Carousel Generator ───────────────────────────────────────────────────────

const CAROUSEL_FORMAT_OPTIONS = [
  { value: 'hook_list',        label: 'Hook + Lista' },
  { value: 'problem_solution', label: 'Problem → Rozwiązanie' },
  { value: 'how_to',           label: 'How To (krok po kroku)' },
  { value: 'social_proof',     label: 'Social Proof (efekty)' },
  { value: 'myth_fact',        label: 'Mit vs Fakt' },
  { value: 'value_list',       label: 'Lista Wartości' },
]

function SlidePreview({ slide, index }: { slide: CarouselSlide; index: number }) {
  const isDark = slide.bg === 'dark'
  return (
    <div style={{
      width: 200, minHeight: 200, flexShrink: 0,
      background: isDark ? '#111114' : '#F8F8F7',
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)'}`,
      borderRadius: 12, padding: '14px 14px 12px',
      display: 'flex', flexDirection: 'column', gap: 8, position: 'relative',
      boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
    }}>
      {/* Slide number */}
      <div style={{ position: 'absolute', top: 8, right: 10, fontSize: 10, fontWeight: 700, color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)', letterSpacing: '0.05em' }}>
        {index + 1}
      </div>

      {/* Brand tag */}
      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: isDark ? '#C49A2E' : '#888', marginBottom: 2 }}>
        77STF
      </div>

      {/* Headline */}
      <div style={{
        fontSize: slide.style === 'hook' ? 15 : 13,
        fontWeight: 800, lineHeight: 1.2,
        color: isDark ? '#F2F2F4' : '#111114',
        letterSpacing: slide.style === 'hook' ? '-0.02em' : '-0.01em',
      }}>
        {slide.headline}
      </div>

      {/* Body */}
      {slide.body.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
          {slide.body.map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, fontSize: 10, color: isDark ? 'rgba(242,242,244,0.7)' : 'rgba(0,0,0,0.7)', lineHeight: 1.4 }}>
              {slide.style === 'list' && <span style={{ color: isDark ? '#C49A2E' : '#888', flexShrink: 0 }}>—</span>}
              <span>{item}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CarouselGenerator({ onSaveCarousel }: { onSaveCarousel: (carousel: CarouselResult) => void }) {
  const [topic, setTopic] = useState('')
  const [format, setFormat] = useState('hook_list')
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<CarouselResult | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  const generate = async () => {
    if (!topic.trim()) return
    setGenerating(true); setError(''); setResult(null)
    const res = await fetch('/api/content/carousel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: topic.trim(), format }),
    })
    setGenerating(false)
    if (res.ok) {
      const { carousel } = await res.json() as { carousel: CarouselResult }
      setResult(carousel)
    } else {
      const { error: msg } = await res.json() as { error: string }
      setError(msg ?? 'Błąd generowania')
    }
  }

  const copy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(key); setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div style={{ background: 'rgba(196,154,46,0.05)', border: `1px solid rgba(196,154,46,0.18)`, borderRadius: 14, padding: 20, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <LayoutGrid size={15} style={{ color: '#C49A2E' }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: '#C49A2E' }}>Generator Karuzeli 77STF</span>
        <span style={{ fontSize: 11, color: t.text.muted, background: t.bg.muted, border: `1px solid ${t.border.subtle}`, borderRadius: 20, padding: '2px 8px' }}>Styl Oskar Lipiński</span>
      </div>

      {/* Input row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: result ? 16 : 0, flexWrap: 'wrap' }}>
        <input
          value={topic}
          onChange={e => setTopic(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && void generate()}
          placeholder="Temat (np. ile czasu tracisz bez automatyzacji, jak głosowy agent zastępuje recepcjonistę...)"
          style={{ flex: 1, minWidth: 260, background: t.bg.input, border: `1px solid ${t.border.default}`, borderRadius: 8, padding: '8px 12px', color: t.text.primary, fontSize: 13, outline: 'none' }}
        />
        <select
          value={format}
          onChange={e => setFormat(e.target.value)}
          style={{ background: t.bg.input, border: `1px solid ${t.border.default}`, borderRadius: 8, padding: '8px 12px', color: t.text.primary, fontSize: 12, outline: 'none', flexShrink: 0 }}
        >
          {CAROUSEL_FORMAT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <button
          onClick={() => void generate()}
          disabled={generating || !topic.trim()}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 8, background: '#C49A2E', border: 'none', color: '#111', fontSize: 13, fontWeight: 700, cursor: generating || !topic.trim() ? 'not-allowed' : 'pointer', opacity: generating || !topic.trim() ? 0.6 : 1, flexShrink: 0 }}
        >
          <Sparkles size={13} /> {generating ? 'Generuję...' : 'Generuj karuzelę'}
        </button>
      </div>

      {error && <div style={{ color: t.semantic.error, fontSize: 13, marginTop: 12 }}>{error}</div>}

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Slide previews */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: t.text.muted, marginBottom: 10 }}>
              Podgląd slajdów ({result.slides.length})
            </div>
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8 }}>
              {result.slides.map((slide, i) => (
                <SlidePreview key={i} slide={slide} index={i} />
              ))}
            </div>
          </div>

          {/* Caption + hashtags */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ background: t.bg.card, border: `1px solid ${t.border.subtle}`, borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: t.text.muted }}>Caption</span>
                <button onClick={() => void copy(result.caption, 'caption')} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: copied === 'caption' ? '#4ade80' : t.text.muted, background: 'none', border: 'none', cursor: 'pointer' }}>
                  <Copy size={11} /> {copied === 'caption' ? 'Skopiowano!' : 'Kopiuj'}
                </button>
              </div>
              <p style={{ fontSize: 12, color: t.text.secondary, lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap', maxHeight: 160, overflowY: 'auto' }}>{result.caption}</p>
            </div>

            <div style={{ background: t.bg.card, border: `1px solid ${t.border.subtle}`, borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: t.text.muted }}>Hashtagi ({result.hashtags.length})</span>
                <button onClick={() => void copy(result.hashtags.join(' '), 'tags')} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: copied === 'tags' ? '#4ade80' : t.text.muted, background: 'none', border: 'none', cursor: 'pointer' }}>
                  <Copy size={11} /> {copied === 'tags' ? 'Skopiowano!' : 'Kopiuj'}
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxHeight: 160, overflowY: 'auto' }}>
                {result.hashtags.map(h => (
                  <span key={h} style={{ fontSize: 11, color: '#818CF8', background: 'rgba(129,140,248,0.08)', padding: '2px 8px', borderRadius: 12 }}>{h}</span>
                ))}
              </div>
              {result.bio_cta && (
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${t.border.subtle}` }}>
                  <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: t.text.muted, marginBottom: 4 }}>Bio CTA</div>
                  <p style={{ fontSize: 12, color: '#C49A2E', margin: 0, lineHeight: 1.5 }}>{result.bio_cta}</p>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              onClick={() => {
                const json = JSON.stringify(result, null, 2)
                const blob = new Blob([json], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url; a.download = `77stf-carousel-${Date.now()}.json`
                a.click(); URL.revokeObjectURL(url)
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '7px 14px', borderRadius: 8, background: 'none', border: `1px solid ${t.border.default}`, color: t.text.muted, cursor: 'pointer' }}
            >
              <Download size={12} /> Eksportuj JSON
            </button>
            <button
              onClick={() => onSaveCarousel(result)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, padding: '8px 18px', borderRadius: 8, background: t.brand.gold, border: 'none', color: '#111', fontWeight: 700, cursor: 'pointer' }}
            >
              <Plus size={13} /> Zapisz do CMS
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── AI Ideas panel ───────────────────────────────────────────────────────────

function AIIdeasPanel({ onUseIdea }: { onUseIdea: (idea: IdeaPost) => void }) {
  const [topic, setTopic] = useState('')
  const [platform, setPlatform] = useState<Platform>('instagram')
  const [generating, setGenerating] = useState(false)
  const [ideas, setIdeas] = useState<IdeaPost[]>([])
  const [error, setError] = useState('')

  const generate = async () => {
    if (!topic.trim()) return
    setGenerating(true); setError(''); setIdeas([])
    const res = await fetch(`/api/content/posts?generate=1&topic=${encodeURIComponent(topic)}&platform=${platform}`)
    setGenerating(false)
    if (res.ok) {
      const { ideas: data } = await res.json() as { ideas: IdeaPost[] }
      setIdeas(data)
    } else {
      setError('Błąd generowania — spróbuj ponownie')
    }
  }

  return (
    <div style={{ background: 'rgba(129,140,248,0.06)', border: `1px solid rgba(129,140,248,0.2)`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <Sparkles size={15} style={{ color: '#818CF8' }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: '#818CF8' }}>AI Content Ideas</span>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          value={topic}
          onChange={e => setTopic(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && void generate()}
          placeholder="Temat (np. automatyzacje AI dla restauracji)"
          style={{ flex: 1, background: t.bg.input, border: `1px solid ${t.border.default}`, borderRadius: 8, padding: '7px 12px', color: t.text.primary, fontSize: 13, outline: 'none' }}
        />
        <select value={platform} onChange={e => setPlatform(e.target.value as Platform)} style={{ background: t.bg.input, border: `1px solid ${t.border.default}`, borderRadius: 8, padding: '7px 10px', color: t.text.primary, fontSize: 13, outline: 'none' }}>
          {(['instagram','linkedin','youtube','tiktok'] as Platform[]).map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <button onClick={generate} disabled={generating || !topic.trim()} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8, background: '#818CF8', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: generating ? 0.7 : 1 }}>
          <Sparkles size={13} /> {generating ? 'Generuję...' : 'Generuj 5 pomysłów'}
        </button>
      </div>
      {error && <div style={{ fontSize: 12, color: t.semantic.error, marginBottom: 8 }}>{error}</div>}
      {ideas.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ideas.map((idea, i) => (
            <div key={i} style={{ background: t.bg.card, border: `1px solid ${t.border.subtle}`, borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: t.text.primary }}>{idea.title}</div>
                <button onClick={() => onUseIdea(idea)} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '3px 10px', borderRadius: 8, background: 'rgba(129,140,248,0.15)', border: `1px solid rgba(129,140,248,0.3)`, color: '#818CF8', cursor: 'pointer', flexShrink: 0 }}>
                  <Plus size={10} /> Użyj
                </button>
              </div>
              {idea.hook && <p style={{ fontSize: 12, color: '#818CF8', fontStyle: 'italic', margin: '0 0 6px', lineHeight: 1.5 }}>&ldquo;{idea.hook}&rdquo;</p>}
              <p style={{ fontSize: 12, color: t.text.muted, margin: 0, lineHeight: 1.5 }}>{idea.caption?.slice(0, 120)}…</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

function StatsBar({ posts }: { posts: ContentPost[] }) {
  const byStatus = STATUS_ORDER.map(s => ({ status: s, count: posts.filter(p => p.status === s).length }))
  const scheduled = posts.filter(p => p.status === 'scheduled').length
  const published = posts.filter(p => p.status === 'published').length

  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
      {byStatus.map(({ status, count }) => {
        const sc = STATUS_CONFIG[status]
        return (
          <div key={status} style={{ background: sc.bg, border: `1px solid ${sc.border}`, borderRadius: 8, padding: '8px 14px', minWidth: 80 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: sc.color }}>{count}</div>
            <div style={{ fontSize: 10, color: sc.color, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{sc.label}</div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

type View = 'kanban' | 'list' | 'calendar'
type ActivePanel = 'ai' | 'carousel' | null

export default function ContentPage() {
  const [posts, setPosts] = useState<ContentPost[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('kanban')
  const [filterPlatform, setFilterPlatform] = useState<Platform | 'all'>('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [prefillPost, setPrefillPost] = useState<Partial<ContentPost & { hashtags_str: string }> | null>(null)
  const [showAI, setShowAI] = useState(true)
  const [activePanel, setActivePanel] = useState<ActivePanel>('carousel')

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filterPlatform !== 'all') params.set('platform', filterPlatform)
    const res = await fetch(`/api/content/posts?${params}`)
    if (res.ok) {
      const { posts: data } = await res.json() as { posts: ContentPost[] }
      setPosts(data)
    }
    setLoading(false)
  }, [filterPlatform])

  useEffect(() => { void fetchPosts() }, [fetchPosts])

  const deletePost = async (id: string) => {
    await fetch(`/api/content/posts?id=${id}`, { method: 'DELETE' })
    setPosts(prev => prev.filter(p => p.id !== id))
  }

  const changeStatus = async (id: string, status: PostStatus) => {
    await fetch('/api/content/posts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) })
    setPosts(prev => prev.map(p => p.id === id ? { ...p, status } : p))
  }

  const handleUseIdea = (idea: IdeaPost) => {
    setPrefillPost({ title: idea.title, caption: idea.caption, post_type: idea.post_type as PostType, hashtags: idea.hashtags, topics: idea.topics, ai_generated: true })
    setShowAddModal(true)
  }

  const handleSaveCarousel = async (carousel: CarouselResult) => {
    const captionText = `${carousel.caption}\n\n${carousel.hashtags.join(' ')}`
    await fetch('/api/content/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: carousel.title,
        caption: captionText,
        platform: 'instagram',
        post_type: 'carousel',
        status: 'draft',
        hashtags: carousel.hashtags,
        topics: ['77stf', 'ai', carousel.format],
        ai_generated: true,
      }),
    })
    await fetchPosts()
  }

  const postsByStatus = (status: PostStatus) => posts.filter(p => p.status === status && (filterPlatform === 'all' || p.platform === filterPlatform))

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(225,48,108,0.15)', border: '1px solid rgba(225,48,108,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PlatformIcon platform="instagram" size={18} />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: t.text.primary, margin: 0 }}>Content Studio</h1>
            <p style={{ fontSize: 13, color: t.text.muted, margin: 0 }}>Zarządzaj postami, planuj content, generuj pomysły z AI</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setActivePanel(activePanel === 'carousel' ? null : 'carousel')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: activePanel === 'carousel' ? 'rgba(196,154,46,0.12)' : t.bg.card, border: `1px solid ${activePanel === 'carousel' ? 'rgba(196,154,46,0.35)' : t.border.default}`, color: activePanel === 'carousel' ? '#C49A2E' : t.text.muted, fontSize: 13, cursor: 'pointer' }}
          >
            <LayoutGrid size={13} /> Karuzela
          </button>
          <button
            onClick={() => setActivePanel(activePanel === 'ai' ? null : 'ai')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: activePanel === 'ai' ? 'rgba(129,140,248,0.12)' : t.bg.card, border: `1px solid ${activePanel === 'ai' ? 'rgba(129,140,248,0.3)' : t.border.default}`, color: activePanel === 'ai' ? '#818CF8' : t.text.muted, fontSize: 13, cursor: 'pointer' }}
          >
            <Sparkles size={13} /> AI Ideas
          </button>
          <button onClick={() => { setPrefillPost(null); setShowAddModal(true) }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: t.brand.gold, border: 'none', color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            <Plus size={14} /> Nowy post
          </button>
        </div>
      </div>

      {/* Stats */}
      <StatsBar posts={posts} />

      {/* Carousel generator */}
      {activePanel === 'carousel' && <CarouselGenerator onSaveCarousel={handleSaveCarousel} />}

      {/* AI Ideas */}
      {activePanel === 'ai' && <AIIdeasPanel onUseIdea={handleUseIdea} />}

      {/* Filters + view switcher */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 4, background: t.bg.muted, borderRadius: 8, padding: 3 }}>
          {(['all', 'instagram', 'linkedin', 'youtube', 'tiktok'] as const).map(p => (
            <button key={p} onClick={() => setFilterPlatform(p)} style={{ padding: '5px 12px', borderRadius: 6, background: filterPlatform === p ? t.bg.cardSolid : 'transparent', border: 'none', color: filterPlatform === p ? t.text.primary : t.text.muted, fontSize: 12, cursor: 'pointer', fontWeight: filterPlatform === p ? 600 : 400 }}>
              {p === 'all' ? 'Wszystkie' : p}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, background: t.bg.muted, borderRadius: 8, padding: 3 }}>
          {(['kanban', 'list'] as View[]).map(v => (
            <button key={v} onClick={() => setView(v)} style={{ padding: '5px 12px', borderRadius: 6, background: view === v ? t.bg.cardSolid : 'transparent', border: 'none', color: view === v ? t.text.primary : t.text.muted, fontSize: 12, cursor: 'pointer' }}>
              {v === 'kanban' ? 'Kanban' : 'Lista'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ color: t.text.muted, fontSize: 13 }}>Ładowanie...</div>
      ) : view === 'kanban' ? (
        <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 16 }}>
          {STATUS_ORDER.map(status => (
            <KanbanColumn key={status} status={status} posts={postsByStatus(status)} onDelete={deletePost} onStatusChange={changeStatus} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {posts.filter(p => filterPlatform === 'all' || p.platform === filterPlatform).map(p => (
            <PostCard key={p.id} post={p} onDelete={deletePost} onStatusChange={changeStatus} />
          ))}
          {posts.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: t.text.muted, fontSize: 13 }}>
              Brak postów. Kliknij &quot;Nowy post&quot; lub wygeneruj pomysły z AI.
            </div>
          )}
        </div>
      )}

      {showAddModal && (
        <AddPostModal
          onClose={() => { setShowAddModal(false); setPrefillPost(null) }}
          onSave={fetchPosts}
        />
      )}
    </div>
  )
}
