'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Send, Filter, RefreshCw, AlertTriangle, Zap, MessageSquare, ExternalLink, Image, Video, FileText, Volume2 } from 'lucide-react'
import { t } from '@/lib/tokens'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TelegramMessage {
  id: string
  channel_id: string
  channel_name: string
  message_id: number
  sender_name: string | null
  sender_username: string | null
  content: string | null
  media_type: string | null
  reply_to_id: number | null
  reply_to_sender: string | null
  reply_to_text: string | null
  forwarded_from: string | null
  ai_score: number | null
  ai_flag: string | null
  sent_at: string
}

interface ChannelStat {
  channel_id: string
  channel_name: string
  emoji: string
  topic_id: number
  today: number
  week: number
  last_message_at: string | null
  urgent_count: number
  opportunity_count: number
  issue_count: number
}

interface Props {
  initialMessages: TelegramMessage[]
  initialStats: ChannelStat[]
  totalToday: number
  urgentCount: number
  opportunityCount: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const REFRESH_INTERVAL_MS = 30_000   // 30s live refresh
const TARGET_GROUP_ID = '3683446930'

const FLAG_STYLES: Record<string, { label: string; color: string; bg: string; border: string }> = {
  urgent:      { label: 'Pilne',      color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.30)' },
  opportunity: { label: 'Szansa',     color: '#4ade80', bg: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.30)' },
  issue:       { label: 'Problem',    color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.30)' },
}

const MEDIA_ICONS: Record<string, React.ElementType> = {
  photo:    Image,
  video:    Video,
  document: FileText,
  audio:    Volume2,
  voice:    Volume2,
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'przed chwilą'
  if (m < 60) return `${m}m temu`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h temu`
  return `${Math.floor(h / 24)}d temu`
}

// ─── Message card ─────────────────────────────────────────────────────────────

function MessageCard({ msg }: { msg: TelegramMessage }) {
  const flag = msg.ai_flag ? FLAG_STYLES[msg.ai_flag] : null
  const MediaIcon = msg.media_type ? (MEDIA_ICONS[msg.media_type] ?? FileText) : null
  const topicId = msg.channel_id === '-1002360946496' ? 7
    : msg.channel_id === '-1002202808162' ? 11
    : msg.channel_id === '-1003468377891' ? 12
    : msg.channel_id === '-1001895589451' ? 15
    : msg.channel_id === '-1001916600905' ? 2
    : msg.channel_id === '-1001953219180' ? 4
    : msg.channel_id === '-1001950386772' ? 6
    : msg.channel_id === '-1002016536758' ? 8
    : msg.channel_id === '-1001854651007' ? 9
    : msg.channel_id === '-1001929535484' ? 5
    : msg.channel_id === '-1002492477972' ? 10
    : msg.channel_id === '-1001830816436' ? 14
    : msg.channel_id === '-1002003349867' ? 13 : 0

  const scoreColor = msg.ai_score !== null && msg.ai_score >= 8 ? '#f87171'
    : msg.ai_score !== null && msg.ai_score >= 6 ? '#fbbf24'
    : t.text.muted

  return (
    <div style={{
      background: t.bg.card,
      border: `1px solid ${flag ? flag.border : t.border.subtle}`,
      borderLeft: `3px solid ${flag ? flag.color : t.border.subtle}`,
      borderRadius: t.radius.md,
      padding: '12px 14px',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      {/* Header: channel + time + score + flag */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#818CF8', background: 'rgba(129,140,248,0.12)', border: '1px solid rgba(129,140,248,0.22)', borderRadius: t.radius.full, padding: '2px 8px' }}>
          {msg.channel_name}
        </span>
        {flag && (
          <span style={{ fontSize: 10, fontWeight: 700, color: flag.color, background: flag.bg, border: `1px solid ${flag.border}`, borderRadius: t.radius.full, padding: '2px 8px' }}>
            {flag.label}
          </span>
        )}
        {msg.ai_score !== null && (
          <span style={{ fontSize: 10, fontWeight: 700, color: scoreColor, marginLeft: 'auto' }}>
            {msg.ai_score}/10
          </span>
        )}
        <span style={{ fontSize: 11, color: t.text.muted }}>{relTime(msg.sent_at)}</span>
        {topicId > 0 && (
          <a
            href={`https://t.me/c/${TARGET_GROUP_ID}/${topicId}`}
            target="_blank" rel="noopener noreferrer"
            title="Otwórz w grupie Telegram"
            style={{ display: 'flex', alignItems: 'center', color: t.text.muted, textDecoration: 'none' }}
          >
            <ExternalLink size={12} />
          </a>
        )}
      </div>

      {/* Sender */}
      {(msg.sender_name || msg.sender_username) && (
        <div style={{ fontSize: 12, fontWeight: 600, color: t.text.secondary }}>
          {msg.sender_name ?? ''}
          {msg.sender_username && <span style={{ color: t.text.muted, fontWeight: 400 }}> @{msg.sender_username}</span>}
        </div>
      )}

      {/* Reply context */}
      {msg.reply_to_sender && (
        <div style={{ background: t.bg.muted, border: `1px solid ${t.border.subtle}`, borderRadius: t.radius.sm, padding: '6px 10px', borderLeft: `2px solid ${t.border.default}` }}>
          <div style={{ fontSize: 10, color: t.text.muted, marginBottom: 2 }}>Odpowiedź na: {msg.reply_to_sender}</div>
          {msg.reply_to_text && (
            <div style={{ fontSize: 11, color: t.text.muted, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {msg.reply_to_text}
            </div>
          )}
        </div>
      )}

      {/* Forwarded from */}
      {msg.forwarded_from && (
        <div style={{ fontSize: 11, color: t.text.muted }}>
          Przekazano z: <span style={{ color: t.text.secondary }}>{msg.forwarded_from}</span>
        </div>
      )}

      {/* Media indicator */}
      {MediaIcon && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: t.text.muted }}>
          <MediaIcon size={13} />
          <span style={{ textTransform: 'capitalize' }}>{msg.media_type}</span>
        </div>
      )}

      {/* Content */}
      {msg.content && (
        <div style={{ fontSize: 13, color: t.text.primary, lineHeight: 1.6, wordBreak: 'break-word' }}>
          {msg.content.length > 400 ? msg.content.slice(0, 400) + '…' : msg.content}
        </div>
      )}
    </div>
  )
}

// ─── Channel stats bar ────────────────────────────────────────────────────────

function ChannelStatsBar({ stats, activeChannel, onSelect }: {
  stats: ChannelStat[]
  activeChannel: string | null
  onSelect: (id: string | null) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
      <button
        onClick={() => onSelect(null)}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '5px 12px', borderRadius: t.radius.full,
          border: `1px solid ${activeChannel === null ? 'rgba(255,255,255,0.25)' : t.border.subtle}`,
          background: activeChannel === null ? 'rgba(255,255,255,0.08)' : 'transparent',
          color: activeChannel === null ? t.text.primary : t.text.muted,
          fontSize: 12, fontWeight: activeChannel === null ? 700 : 400,
          cursor: 'pointer',
        }}
      >
        Wszystkie
      </button>
      {stats.map(s => (
        <button
          key={s.channel_id}
          onClick={() => onSelect(activeChannel === s.channel_id ? null : s.channel_id)}
          title={s.channel_name}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 12px', borderRadius: t.radius.full,
            border: `1px solid ${activeChannel === s.channel_id ? 'rgba(129,140,248,0.5)' : t.border.subtle}`,
            background: activeChannel === s.channel_id ? 'rgba(129,140,248,0.12)' : 'transparent',
            color: activeChannel === s.channel_id ? '#818CF8' : t.text.muted,
            fontSize: 12, fontWeight: activeChannel === s.channel_id ? 700 : 400,
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          <span>{s.emoji}</span>
          {s.today > 0 && (
            <span style={{ fontWeight: 700, color: activeChannel === s.channel_id ? '#818CF8' : t.text.secondary }}>
              {s.today}
            </span>
          )}
          {s.urgent_count > 0 && (
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f87171', flexShrink: 0 }} />
          )}
        </button>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TelegramMonitor({ initialMessages, initialStats, totalToday, urgentCount, opportunityCount }: Props) {
  const [messages, setMessages] = useState<TelegramMessage[]>(initialMessages)
  const [stats, setStats] = useState<ChannelStat[]>(initialStats)
  const [activeChannel, setActiveChannel] = useState<string | null>(null)
  const [activeFlag, setActiveFlag] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [newCount, setNewCount] = useState(0)
  const prevMessageIdsRef = useRef(new Set(initialMessages.map(m => m.id)))

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true)
    try {
      const params = new URLSearchParams({ limit: '80' })
      if (activeChannel) params.set('channel_id', activeChannel)
      if (activeFlag) params.set('flag', activeFlag)

      const [msgRes, statsRes] = await Promise.all([
        fetch(`/api/telegram/messages?${params}`),
        fetch('/api/telegram/messages?stats=1'),
      ])

      if (msgRes.ok) {
        const { messages: fresh } = await msgRes.json() as { messages: TelegramMessage[] }
        const incoming = fresh.filter(m => !prevMessageIdsRef.current.has(m.id))
        if (incoming.length > 0) {
          setNewCount(prev => prev + incoming.length)
          incoming.forEach(m => prevMessageIdsRef.current.add(m.id))
        }
        setMessages(fresh)
        setLastUpdated(new Date())
      }
      if (statsRes.ok) {
        const { stats: freshStats } = await statsRes.json() as { stats: ChannelStat[] }
        setStats(freshStats)
      }
    } finally {
      if (!silent) setRefreshing(false)
    }
  }, [activeChannel, activeFlag])

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(() => void refresh(true), REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [refresh])

  // Re-fetch when filters change
  useEffect(() => { void refresh(false) }, [activeChannel, activeFlag]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalUrgent = stats.reduce((s, c) => s + c.urgent_count, 0)
  const totalOpportunity = stats.reduce((s, c) => s + c.opportunity_count, 0)

  const displayMessages = messages.filter(m => {
    if (activeChannel && m.channel_id !== activeChannel) return false
    if (activeFlag && m.ai_flag !== activeFlag) return false
    return true
  })

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <div style={{ width: 36, height: 36, borderRadius: t.radius.sm, background: 'rgba(129,140,248,0.15)', border: '1px solid rgba(129,140,248,0.30)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Send size={17} style={{ color: '#818CF8' }} />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: t.text.primary, margin: 0 }}>Telegram Monitor</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', display: 'inline-block', animation: 'pulse 2s infinite' }} />
              <span style={{ fontSize: 11, color: t.text.muted }}>Live · {lastUpdated.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
          <p style={{ color: t.text.muted, fontSize: 13, margin: 0 }}>
            {stats.length} kanałów · {totalToday} wiadomości dzisiaj · odświeżenie co 30s
          </p>
        </div>
        <button
          onClick={() => void refresh(false)}
          disabled={refreshing}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: `1px solid ${t.border.default}`, borderRadius: t.radius.sm, padding: '7px 14px', color: t.text.secondary, fontSize: 12, cursor: refreshing ? 'not-allowed' : 'pointer', flexShrink: 0 }}
        >
          <RefreshCw size={12} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          Odśwież
        </button>
      </div>

      {/* KPI bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 24 }}>
        {[
          { label: 'Dziś łącznie', value: String(totalToday), color: t.text.primary, sub: 'wiadomości' },
          { label: 'Pilnych',      value: String(totalUrgent),      color: '#f87171', sub: 'wymaga reakcji', clickFlag: 'urgent' },
          { label: 'Szanse',       value: String(totalOpportunity), color: '#4ade80', sub: 'nowe możliwości', clickFlag: 'opportunity' },
          { label: 'Kanałów aktywnych', value: String(stats.filter(s => s.today > 0).length), color: '#818CF8', sub: 'z wiadomościami dziś' },
        ].map(kpi => (
          <button
            key={kpi.label}
            onClick={() => 'clickFlag' in kpi ? setActiveFlag(activeFlag === kpi.clickFlag ? null : (kpi.clickFlag ?? null)) : null}
            style={{
              background: t.bg.card, border: `1px solid ${'clickFlag' in kpi && activeFlag === kpi.clickFlag ? kpi.color + '50' : t.border.default}`,
              borderRadius: t.radius.md, padding: '14px 16px', textAlign: 'left',
              cursor: 'clickFlag' in kpi ? 'pointer' : 'default',
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.10em', color: t.text.muted, marginBottom: 6 }}>{kpi.label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: kpi.color, lineHeight: 1, marginBottom: 4 }}>{kpi.value}</div>
            <div style={{ fontSize: 11, color: t.text.muted }}>{kpi.sub}</div>
          </button>
        ))}
      </div>

      {/* Channel filter */}
      <ChannelStatsBar stats={stats} activeChannel={activeChannel} onSelect={setActiveChannel} />

      {/* Flag filter strip */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, alignItems: 'center' }}>
        <Filter size={12} style={{ color: t.text.muted, flexShrink: 0 }} />
        {[
          { key: null,          label: 'Wszystkie', color: t.text.muted },
          { key: 'urgent',      label: '🔴 Pilne',  color: '#f87171' },
          { key: 'opportunity', label: '🟢 Szanse', color: '#4ade80' },
          { key: 'issue',       label: '🟡 Problemy', color: '#fbbf24' },
        ].map(f => (
          <button
            key={f.key ?? '__all__'}
            onClick={() => setActiveFlag(activeFlag === f.key ? null : f.key)}
            style={{
              fontSize: 12, padding: '4px 12px', borderRadius: t.radius.full,
              border: `1px solid ${activeFlag === f.key ? f.color + '60' : t.border.subtle}`,
              background: activeFlag === f.key ? f.color + '18' : 'transparent',
              color: activeFlag === f.key ? f.color : t.text.muted,
              cursor: 'pointer', fontWeight: activeFlag === f.key ? 700 : 400,
            }}
          >
            {f.label}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: t.text.muted }}>
          {displayMessages.length} wiadomości
        </span>
      </div>

      {/* New messages banner */}
      {newCount > 0 && (
        <button
          onClick={() => setNewCount(0)}
          style={{ width: '100%', marginBottom: 12, background: 'rgba(129,140,248,0.12)', border: '1px solid rgba(129,140,248,0.30)', borderRadius: t.radius.sm, padding: '8px', color: '#818CF8', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          +{newCount} nowych wiadomości — kliknij aby odświeżyć widok
        </button>
      )}

      {/* Message feed */}
      {displayMessages.length === 0 ? (
        <div style={{ background: t.bg.card, border: `1px solid ${t.border.subtle}`, borderRadius: t.radius.md, padding: '48px 24px', textAlign: 'center', color: t.text.muted }}>
          <MessageSquare size={28} style={{ marginBottom: 12, opacity: 0.4 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: t.text.secondary, marginBottom: 6 }}>Brak wiadomości</div>
          <div style={{ fontSize: 13 }}>
            {activeChannel || activeFlag
              ? 'Zmień filtry lub poczekaj na nowe wiadomości'
              : 'Uruchom forwarder service — instrukcja poniżej'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {displayMessages.map(msg => (
            <MessageCard key={msg.id ?? `${msg.channel_id}-${msg.message_id}`} msg={msg} />
          ))}
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.5 } }
      `}</style>
    </div>
  )
}
