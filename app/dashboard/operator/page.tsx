'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Brain, Send, Wrench, Plus, MessageSquare, Trash2,
  ChevronDown, Zap, Database, Users, ClipboardList,
  TrendingUp, Lightbulb, Shield, Calendar, ArrowRight,
} from 'lucide-react'
import { t } from '@/lib/tokens'
import { relativeTime } from '@/lib/format'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  role: 'user' | 'assistant'
  content: string
  tools_used?: string[]
  error?: boolean
  streaming?: boolean
}

interface ConversationMeta {
  id: string
  title: string
  updated_at: string
}

// ─── Tool metadata ────────────────────────────────────────────────────────────

const TOOL_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  list_clients:            { label: 'Klienci',           icon: Users,         color: '#818CF8' },
  get_client_details:      { label: 'Profil klienta',    icon: Users,         color: '#818CF8' },
  search_clients:          { label: 'Szukam',            icon: Users,         color: '#818CF8' },
  update_client_status:    { label: 'Status klienta',    icon: Users,         color: '#818CF8' },
  create_task:             { label: 'Nowe zadanie',      icon: ClipboardList, color: '#34D399' },
  list_tasks:              { label: 'Zadania',           icon: ClipboardList, color: '#34D399' },
  get_daily_priorities:    { label: 'Priorytety',        icon: ClipboardList, color: '#34D399' },
  add_client_note:         { label: 'Notatka',           icon: MessageSquare, color: '#60A5FA' },
  add_roadmap_activity:    { label: 'Aktywność',         icon: Calendar,      color: '#60A5FA' },
  get_roadmap_overview:    { label: 'Pipeline',          icon: TrendingUp,    color: '#F59E0B' },
  advance_pipeline_stage:  { label: 'Etap pipeline',     icon: TrendingUp,    color: '#F59E0B' },
  get_system_stats:        { label: 'Statystyki',        icon: Database,      color: '#A78BFA' },
  get_cost_summary:        { label: 'Koszty',            icon: Database,      color: '#A78BFA' },
  save_offline_idea:       { label: 'Zapisuję pomysł',   icon: Lightbulb,     color: '#C49A2E' },
  get_recent_ideas:        { label: 'Pomysły',           icon: Lightbulb,     color: '#C49A2E' },
  run_guardian_scan:       { label: 'Opiekun',           icon: Shield,        color: '#F87171' },
  generate_meeting_brief:  { label: 'Brief spotkania',   icon: Calendar,      color: '#34D399' },
  get_client_opportunities:{ label: 'Możliwości',        icon: TrendingUp,    color: '#F59E0B' },
  get_radar_signals:       { label: 'Radar',             icon: Zap,           color: '#818CF8' },
  draft_follow_up:         { label: 'Follow-up',         icon: MessageSquare, color: '#60A5FA' },
}

// ─── Suggested prompts ────────────────────────────────────────────────────────

const SUGGESTIONS = [
  { text: 'Co powinienem dziś zrobić?',                   icon: ClipboardList },
  { text: 'Jak wygląda nasz pipeline?',                   icon: TrendingUp },
  { text: 'Przygotuj brief na spotkanie z Avvlo',         icon: Calendar },
  { text: 'Jakie możliwości upsell mamy u klientów?',     icon: TrendingUp },
  { text: 'Napisz follow-up do Petro-Lawa',               icon: MessageSquare },
  { text: 'Ile wydaliśmy na AI w tym miesiącu?',          icon: Database },
]

// ─── Minimal markdown renderer ────────────────────────────────────────────────
// No external deps — pure CSS transforms

function renderMarkdown(text: string): string {
  return text
    // code blocks
    .replace(/```[\w]*\n?([\s\S]*?)```/g, '<pre style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.08);border-radius:6px;padding:10px 12px;overflow-x:auto;font-size:12px;line-height:1.6;margin:8px 0"><code>$1</code></pre>')
    // inline code
    .replace(/`([^`]+)`/g, '<code style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.08);border-radius:4px;padding:1px 5px;font-size:12px">$1</code>')
    // bold
    .replace(/\*\*([^*]+)\*\*/g, '<strong style="color:#F2F2F4;font-weight:700">$1</strong>')
    // italic
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // h3
    .replace(/^### (.+)$/gm, '<div style="font-size:13px;font-weight:700;color:#F2F2F4;margin:12px 0 4px">$1</div>')
    // h2
    .replace(/^## (.+)$/gm, '<div style="font-size:14px;font-weight:700;color:#F2F2F4;margin:14px 0 6px;border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:4px">$1</div>')
    // h1
    .replace(/^# (.+)$/gm, '<div style="font-size:16px;font-weight:700;color:#F2F2F4;margin:16px 0 8px">$1</div>')
    // numbered list items
    .replace(/^\d+\. (.+)$/gm, '<div style="display:flex;gap:8px;margin:3px 0"><span style="color:#818CF8;font-weight:700;flex-shrink:0">$&nbsp;</span></div>')
    // bullet list — ✅ ⚠️ 📌 🔴 or - •
    .replace(/^([•\-✅⚠️📌🔴🟡🟢]) (.+)$/gm, '<div style="display:flex;gap:7px;margin:3px 0;line-height:1.55"><span style="flex-shrink:0">$1</span><span>$2</span></div>')
    // generic bullet
    .replace(/^- (.+)$/gm, '<div style="display:flex;gap:7px;margin:3px 0;line-height:1.55"><span style="color:#818CF8;flex-shrink:0">›</span><span>$1</span></div>')
    // horizontal rule
    .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:12px 0"/>')
    // newlines to <br> (but not inside pre blocks — already handled)
    .replace(/\n/g, '<br/>')
}

// ─── Tool activity badge ──────────────────────────────────────────────────────

function ToolBadge({ tools }: { tools: string[] }) {
  const unique = [...new Set(tools)]
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
      {unique.map(tool => {
        const meta = TOOL_META[tool] ?? { label: tool, icon: Zap, color: '#818CF8' }
        const Icon = meta.icon
        return (
          <div key={tool} style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '2px 8px', borderRadius: 20,
            background: `${meta.color}14`,
            border: `1px solid ${meta.color}30`,
          }}>
            <Icon size={9} style={{ color: meta.color }} />
            <span style={{ fontSize: 10, color: meta.color, fontWeight: 600 }}>{meta.label}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', gap: 4 }}>
      {msg.tools_used && msg.tools_used.length > 0 && (
        <ToolBadge tools={msg.tools_used} />
      )}
      <div style={{
        maxWidth: isUser ? '72%' : '85%',
        padding: '11px 15px',
        borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
        background: isUser ? 'linear-gradient(135deg, #818CF8, #6366f1)' : msg.error ? t.semantic.errorBg : t.bg.card,
        border: isUser ? 'none' : `1px solid ${msg.error ? t.semantic.errorBorder : t.border.default}`,
        color: isUser ? '#fff' : msg.error ? t.semantic.error : t.text.primary,
        fontSize: 13, lineHeight: 1.7,
        wordBreak: 'break-word',
        boxShadow: isUser ? '0 2px 12px rgba(129,140,248,0.25)' : 'none',
      }}>
        {isUser ? (
          <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
        ) : (
          <span
            dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
            style={{ display: 'block' }}
          />
        )}
        {msg.streaming && (
          <span style={{
            display: 'inline-block', width: 8, height: 14,
            background: '#818CF8', borderRadius: 2,
            animation: 'cursor-blink 0.8s ease infinite',
            marginLeft: 2, verticalAlign: 'text-bottom',
          }} />
        )}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DrugMozgPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<ConversationMeta[]>([])
  const [loadingConvs, setLoadingConvs] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const activeController = useRef<AbortController | null>(null)

  const loadConversationList = useCallback(() => {
    fetch('/api/operator/conversations')
      .then(r => r.json())
      .then(d => setConversations((d as { data: ConversationMeta[] }).data ?? []))
      .catch(() => {})
      .finally(() => setLoadingConvs(false))
  }, [])

  useEffect(() => { loadConversationList() }, [loadConversationList])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const startNew = useCallback(() => {
    activeController.current?.abort()
    setMessages([])
    setInput('')
    setConversationId(null)
    inputRef.current?.focus()
  }, [])

  const loadConversation = useCallback(async (id: string) => {
    const res = await fetch(`/api/operator/conversations/${id}`)
    if (!res.ok) return
    const { data } = await res.json() as { data: { messages: Message[]; id: string } }
    setMessages(data.messages ?? [])
    setConversationId(id)
  }, [])

  const send = useCallback(async (text: string) => {
    if (!text.trim() || loading) return

    const userMsg: Message = { role: 'user', content: text.trim() }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setInput('')
    setLoading(true)

    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }

    const apiMessages = nextMessages.map(m => ({ role: m.role, content: m.content }))

    // Add streaming placeholder
    const placeholderIdx = nextMessages.length
    setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true }])

    const controller = new AbortController()
    activeController.current = controller

    try {
      const res = await fetch('/api/operator/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, conversation_id: conversationId }),
        signal: controller.signal,
      })

      if (!res.ok || !res.body) {
        const err = await res.json() as { error: string }
        setMessages(prev => prev.map((m, i) => i === placeholderIdx ? { ...m, content: err.error ?? 'Błąd połączenia.', error: true, streaming: false } : m))
        setLoading(false)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      const toolsUsed: string[] = []
      let buffer = ''
      let streamedContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6)) as { type: string; delta?: string; name?: string; tools_used?: string[]; error?: string }

            if (event.type === 'text' && event.delta) {
              streamedContent += event.delta
              setMessages(prev => prev.map((m, i) =>
                i === placeholderIdx ? { ...m, content: streamedContent, streaming: true } : m
              ))
            } else if (event.type === 'tool_start' && event.name) {
              toolsUsed.push(event.name)
              setMessages(prev => prev.map((m, i) =>
                i === placeholderIdx ? { ...m, tools_used: [...toolsUsed] } : m
              ))
            } else if (event.type === 'done') {
              const finalTools = event.tools_used ?? toolsUsed
              setMessages(prev => prev.map((m, i) =>
                i === placeholderIdx ? { ...m, streaming: false, tools_used: finalTools } : m
              ))
              setLoading(false)
              // Refresh conversation list
              setTimeout(loadConversationList, 500)
            } else if (event.type === 'error') {
              setMessages(prev => prev.map((m, i) =>
                i === placeholderIdx ? { ...m, content: event.error ?? 'Błąd.', error: true, streaming: false } : m
              ))
              setLoading(false)
            }
          } catch { /* ignore parse errors */ }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setMessages(prev => prev.map((m, i) =>
          i === placeholderIdx ? { ...m, content: 'Błąd połączenia. Spróbuj ponownie.', error: true, streaming: false } : m
        ))
      }
      setLoading(false)
    }
  }, [messages, loading, conversationId, loadConversationList])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send(input)
    }
    // Ctrl+K = new conversation
    if (e.key === 'k' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      startNew()
    }
  }

  const isEmpty = messages.length === 0

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 0px)', background: t.bg.page }}>

      {/* Conversations sidebar */}
      {sidebarOpen && (
        <div style={{
          width: 228, flexShrink: 0,
          borderRight: `1px solid ${t.border.subtle}`,
          display: 'flex', flexDirection: 'column',
          background: 'rgba(0,0,0,0.18)',
        }}>
          {/* Sidebar header */}
          <div style={{ padding: '14px 12px 10px', borderBottom: `1px solid ${t.border.subtle}` }}>
            <button
              onClick={startNew}
              style={{
                width: '100%', padding: '8px 12px',
                background: 'rgba(129,140,248,0.1)',
                border: '1px solid rgba(129,140,248,0.25)',
                borderRadius: 8, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 7,
                fontSize: 12, fontWeight: 600, color: '#818CF8',
              }}
            >
              <Plus size={12} /> Nowa rozmowa
              <span style={{ marginLeft: 'auto', fontSize: 9, opacity: 0.6, fontFamily: 'monospace' }}>Ctrl+K</span>
            </button>
          </div>

          {/* Conversation list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px 12px' }}>
            {loadingConvs ? (
              <div style={{ fontSize: 11, color: t.text.muted, textAlign: 'center', padding: '16px 0' }}>Ładowanie...</div>
            ) : conversations.length === 0 ? (
              <div style={{ fontSize: 11, color: t.text.muted, textAlign: 'center', padding: '20px 8px', lineHeight: 1.6 }}>
                Brak historii.<br />Zacznij pierwszą rozmowę.
              </div>
            ) : (
              conversations.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => void loadConversation(conv.id)}
                  style={{
                    width: '100%', textAlign: 'left',
                    padding: '8px 10px', borderRadius: 7,
                    background: conversationId === conv.id ? 'rgba(129,140,248,0.1)' : 'none',
                    border: conversationId === conv.id ? '1px solid rgba(129,140,248,0.2)' : '1px solid transparent',
                    cursor: 'pointer', marginBottom: 2,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 500, color: t.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>
                    {conv.title || 'Rozmowa'}
                  </div>
                  <div style={{ fontSize: 10, color: t.text.muted }}>{relativeTime(conv.updated_at)}</div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 24px 12px',
          borderBottom: `1px solid ${t.border.subtle}`,
          flexShrink: 0,
          background: 'rgba(0,0,0,0.12)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => setSidebarOpen(o => !o)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
              title={sidebarOpen ? 'Ukryj historię' : 'Pokaż historię'}
            >
              <ChevronDown size={14} style={{ color: t.text.muted, transform: sidebarOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
            </button>
            <div style={{
              width: 36, height: 36, borderRadius: 9,
              background: 'linear-gradient(135deg, rgba(129,140,248,0.2), rgba(99,102,241,0.15))',
              border: '1px solid rgba(129,140,248,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Brain size={17} style={{ color: '#818CF8' }} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.text.primary, letterSpacing: '-0.02em' }}>Drugi Mózg</div>
              <div style={{ fontSize: 11, color: t.text.muted }}>20 narzędzi · Sonnet · Streaming · Kontekst live</div>
            </div>
          </div>
          {messages.length > 0 && (
            <button
              onClick={startNew}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: 'none', border: `1px solid ${t.border.subtle}`,
                borderRadius: 7, padding: '5px 12px',
                color: t.text.muted, fontSize: 12, cursor: 'pointer',
              }}
            >
              <Trash2 size={11} /> Wyczyść
            </button>
          )}
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {isEmpty && (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 24, paddingBottom: 60,
            }}>
              {/* Hero */}
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  width: 64, height: 64, borderRadius: 16,
                  background: 'linear-gradient(135deg, rgba(129,140,248,0.15), rgba(99,102,241,0.1))',
                  border: '1px solid rgba(129,140,248,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 16px',
                  boxShadow: '0 0 32px rgba(129,140,248,0.12)',
                }}>
                  <Brain size={28} style={{ color: '#818CF8' }} />
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: t.text.primary, marginBottom: 8, letterSpacing: '-0.02em' }}>
                  Czym mogę pomóc?
                </div>
                <div style={{ fontSize: 13, color: t.text.muted, maxWidth: 420, lineHeight: 1.7 }}>
                  Jestem Twoim partnerem biznesowym. Znam pipeline, klientów, koszty i priorytety. Mam dostęp do 20 narzędzi CRM i mogę działać proaktywnie — nie tylko odpowiadać.
                </div>
              </div>

              {/* Suggestions */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, maxWidth: 600, width: '100%' }}>
                {SUGGESTIONS.map(s => {
                  const Icon = s.icon
                  return (
                    <button
                      key={s.text}
                      onClick={() => void send(s.text)}
                      style={{
                        background: t.bg.card,
                        border: `1px solid ${t.border.default}`,
                        borderRadius: 10, padding: '10px 14px',
                        fontSize: 12, color: t.text.secondary,
                        cursor: 'pointer', textAlign: 'left',
                        display: 'flex', alignItems: 'center', gap: 8,
                        transition: 'border-color 150ms, background 150ms',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = 'rgba(129,140,248,0.4)'
                        e.currentTarget.style.background = 'rgba(129,140,248,0.05)'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = t.border.default
                        e.currentTarget.style.background = t.bg.card
                      }}
                    >
                      <Icon size={12} style={{ color: '#818CF8', flexShrink: 0 }} />
                      <span style={{ flex: 1 }}>{s.text}</span>
                      <ArrowRight size={10} style={{ color: t.text.muted, opacity: 0.5 }} />
                    </button>
                  )
                })}
              </div>

              {/* Capabilities strip */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 520 }}>
                {['CRM', 'Pipeline', 'Zadania', 'Pomysły', 'Koszty', 'Follow-up', 'Radar', 'Opiekun'].map(cap => (
                  <span key={cap} style={{
                    fontSize: 10, fontWeight: 600, padding: '3px 9px',
                    borderRadius: 20, background: 'rgba(129,140,248,0.08)',
                    border: '1px solid rgba(129,140,248,0.15)', color: '#818CF8',
                  }}>
                    {cap}
                  </span>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div style={{ padding: '10px 24px 18px', borderTop: `1px solid ${t.border.subtle}`, flexShrink: 0 }}>
          <div style={{
            display: 'flex', gap: 10, alignItems: 'flex-end',
            background: t.bg.card,
            border: `1px solid ${loading ? 'rgba(129,140,248,0.35)' : t.border.default}`,
            borderRadius: 12, padding: '10px 10px 10px 16px',
            transition: 'border-color 200ms',
            boxShadow: loading ? '0 0 0 3px rgba(129,140,248,0.08)' : 'none',
          }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              placeholder={loading ? 'Drugi Mózg pracuje...' : 'Napisz do Drugiego Mózgu... (Enter — wyślij, Shift+Enter — nowa linia)'}
              rows={1}
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                color: t.text.primary, fontSize: 13, lineHeight: 1.65,
                resize: 'none', fontFamily: 'inherit',
                maxHeight: 140, overflowY: 'auto',
                opacity: loading ? 0.6 : 1,
              }}
              onInput={e => {
                const el = e.currentTarget
                el.style.height = 'auto'
                el.style.height = `${Math.min(el.scrollHeight, 140)}px`
              }}
            />
            <button
              onClick={() => void send(input)}
              disabled={!input.trim() || loading}
              style={{
                width: 36, height: 36,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: (!input.trim() || loading) ? t.bg.muted : 'linear-gradient(135deg, #818CF8, #6366f1)',
                border: 'none', borderRadius: 9,
                cursor: (!input.trim() || loading) ? 'not-allowed' : 'pointer',
                flexShrink: 0,
                boxShadow: (!input.trim() || loading) ? 'none' : '0 2px 8px rgba(129,140,248,0.3)',
                transition: 'all 150ms',
              }}
            >
              <Send size={14} style={{ color: (!input.trim() || loading) ? t.text.muted : '#fff' }} />
            </button>
          </div>
          <div style={{ fontSize: 10, color: t.text.muted, marginTop: 6, textAlign: 'center', opacity: 0.7 }}>
            20 narzędzi · kontekst pipeline i klientów ładowany automatycznie · Ctrl+K = nowa rozmowa
          </div>
        </div>
      </div>

      <style>{`
        @keyframes cursor-blink {
          0%, 50% { opacity: 1 }
          51%, 100% { opacity: 0 }
        }
      `}</style>
    </div>
  )
}
