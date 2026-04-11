'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Brain, Send, Wrench, Plus, MessageSquare, Trash2 } from 'lucide-react'
import { t } from '@/lib/tokens'
import { relativeTime } from '@/lib/format'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  role: 'user' | 'assistant'
  content: string
  tools_used?: string[]
  error?: boolean
}

interface ConversationMeta {
  id: string
  title: string
  updated_at: string
}

// ─── Tool name labels ─────────────────────────────────────────────────────────

const TOOL_LABELS: Record<string, string> = {
  list_clients:          'Pobrano klientów',
  get_client_details:    'Pobrano dane klienta',
  create_task:           'Tworzę zadanie',
  add_client_note:       'Dodaję notatkę',
  update_client_status:  'Zmieniam status klienta',
  list_tasks:            'Pobrano zadania',
  get_system_stats:      'Pobrano statystyki',
  search_clients:        'Szukam klientów',
  get_roadmap_overview:  'Przeglądam pipeline',
  advance_pipeline_stage:'Przesuwam klienta',
  add_roadmap_activity:  'Dodaję aktywność',
  get_cost_summary:      'Pobrano koszty',
  save_offline_idea:     'Zapisuję pomysł',
  get_daily_priorities:  'Sprawdzam priorytety',
  run_guardian_scan:     'Uruchamiam Opiekuna',
  generate_meeting_brief:'Generuję brief',
}

// ─── Suggested prompts ────────────────────────────────────────────────────────

const SUGGESTIONS = [
  'Co powinienem dziś zrobić?',
  'Jak wygląda nasz pipeline?',
  'Przygotuj brief na spotkanie z Avvlo',
  'Zanotuj: Michał z Avvlo zainteresowany voice agentem',
  'Ile wydaliśmy na AI w tym miesiącu?',
  'Zapisz pomysł: chatbot RAG dla branży farmaceutycznej',
]

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', gap: 4 }}>
      {msg.tools_used && msg.tools_used.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', background: 'rgba(129,140,248,0.1)', border: '1px solid rgba(129,140,248,0.2)', borderRadius: 20 }}>
          <Wrench size={10} style={{ color: '#818CF8' }} />
          <span style={{ fontSize: 11, color: '#818CF8', fontWeight: 500 }}>
            {[...new Set(msg.tools_used)].map(tool => TOOL_LABELS[tool] ?? tool).join(' · ')}
          </span>
        </div>
      )}
      <div style={{
        maxWidth: '76%', padding: '10px 14px',
        borderRadius: isUser ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
        background: isUser ? '#818CF8' : msg.error ? t.semantic.errorBg : t.bg.card,
        border: isUser ? 'none' : `1px solid ${msg.error ? t.semantic.errorBorder : t.border.default}`,
        color: isUser ? '#fff' : msg.error ? t.semantic.error : t.text.primary,
        fontSize: 13, lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}>
        {msg.content}
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start' }}>
      <div style={{ padding: '10px 14px', background: t.bg.card, border: `1px solid ${t.border.default}`, borderRadius: '12px 12px 12px 4px', display: 'flex', gap: 4, alignItems: 'center' }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: t.text.muted, animation: `dmPulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
        ))}
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
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Load conversation list
  useEffect(() => {
    fetch('/api/operator/conversations')
      .then(r => r.json())
      .then(d => setConversations(d.data ?? []))
      .finally(() => setLoadingConvs(false))
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const startNew = useCallback(() => {
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

    const apiMessages = nextMessages.map(m => ({ role: m.role, content: m.content }))

    const res = await fetch('/api/operator/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: apiMessages,
        conversation_id: conversationId,
      }),
    })

    setLoading(false)

    if (res.ok) {
      const { text: reply, tools_used } = await res.json() as { text: string; tools_used: string[] }
      setMessages(prev => [...prev, { role: 'assistant', content: reply, tools_used }])
      // Refresh conversation list in background
      fetch('/api/operator/conversations')
        .then(r => r.json())
        .then(d => setConversations(d.data ?? []))
        .catch(() => {})
    } else {
      const { error } = await res.json() as { error: string }
      setMessages(prev => [...prev, { role: 'assistant', content: error ?? 'Coś poszło nie tak.', error: true }])
    }
  }, [messages, loading, conversationId])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(input) }
  }

  const isEmpty = messages.length === 0

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 0px)' }}>

      {/* Conversations sidebar */}
      <div style={{
        width: 220, flexShrink: 0,
        borderRight: `1px solid ${t.border.subtle}`,
        display: 'flex', flexDirection: 'column',
        background: 'rgba(0,0,0,0.2)',
      }}>
        <div style={{ padding: '14px 12px 8px' }}>
          <button
            onClick={startNew}
            style={{
              width: '100%', padding: '8px 12px',
              background: 'rgba(129,140,248,0.1)',
              border: '1px solid rgba(129,140,248,0.25)',
              borderRadius: 7, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 7,
              fontSize: 12, fontWeight: 600, color: '#818CF8',
              transition: 'all 150ms',
            }}
          >
            <Plus size={13} /> Nowa rozmowa
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 12px' }}>
          {loadingConvs && (
            <div style={{ fontSize: 11, color: t.text.muted, textAlign: 'center', padding: '12px 0' }}>
              Ładowanie...
            </div>
          )}
          {conversations.map(conv => (
            <button
              key={conv.id}
              onClick={() => loadConversation(conv.id)}
              style={{
                width: '100%', textAlign: 'left',
                padding: '8px 10px', borderRadius: 7,
                background: conversationId === conv.id ? 'rgba(129,140,248,0.1)' : 'none',
                border: conversationId === conv.id ? '1px solid rgba(129,140,248,0.2)' : '1px solid transparent',
                cursor: 'pointer', marginBottom: 2,
                transition: 'all 100ms',
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 500, color: t.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {conv.title || 'Rozmowa'}
              </div>
              <div style={{ fontSize: 10, color: t.text.muted, marginTop: 2 }}>
                {relativeTime(conv.updated_at)}
              </div>
            </button>
          ))}
          {!loadingConvs && conversations.length === 0 && (
            <div style={{ fontSize: 11, color: t.text.muted, textAlign: 'center', padding: '16px 8px' }}>
              Brak historii rozmów
            </div>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px 12px', borderBottom: `1px solid ${t.border.subtle}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(129,140,248,0.15)', border: '1px solid rgba(129,140,248,0.30)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Brain size={16} style={{ color: '#818CF8' }} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.text.primary }}>Drugi Mózg</div>
              <div style={{ fontSize: 11, color: t.text.muted }}>Partner biznesowy 77STF · 16 narzędzi · Sonnet</div>
            </div>
          </div>
          {messages.length > 0 && (
            <button
              onClick={startNew}
              style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: `1px solid ${t.border.subtle}`, borderRadius: 7, padding: '5px 12px', color: t.text.muted, fontSize: 12, cursor: 'pointer' }}
            >
              <Trash2 size={11} /> Wyczyść
            </button>
          )}
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {isEmpty && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, paddingBottom: 40 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: 56, height: 56, borderRadius: 14, background: 'rgba(129,140,248,0.12)', border: '1px solid rgba(129,140,248,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  <MessageSquare size={24} style={{ color: '#818CF8' }} />
                </div>
                <div style={{ fontSize: 17, fontWeight: 700, color: t.text.secondary, marginBottom: 6 }}>Czym mogę pomóc?</div>
                <div style={{ fontSize: 13, color: t.text.muted, maxWidth: 380 }}>
                  Jestem Twoim partnerem biznesowym. Znam cały system, pipeline, klientów i koszty. Pytaj o wszystko.
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 560 }}>
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => void send(s)}
                    style={{ background: t.bg.card, border: `1px solid ${t.border.default}`, borderRadius: 20, padding: '6px 14px', fontSize: 12, color: t.text.secondary, cursor: 'pointer', transition: 'border-color 100ms' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = '#818CF8')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = t.border.default)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
          {loading && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ padding: '10px 24px 18px', borderTop: `1px solid ${t.border.subtle}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', background: t.bg.card, border: `1px solid ${t.border.default}`, borderRadius: 10, padding: '8px 8px 8px 14px' }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              placeholder="Napisz do Drugiego Mózgu... (Enter — wyślij, Shift+Enter — nowa linia)"
              rows={1}
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                color: t.text.primary, fontSize: 13, lineHeight: 1.6,
                resize: 'none', fontFamily: 'inherit', maxHeight: 120, overflowY: 'auto',
              }}
              onInput={e => {
                const el = e.currentTarget
                el.style.height = 'auto'
                el.style.height = `${Math.min(el.scrollHeight, 120)}px`
              }}
            />
            <button
              onClick={() => void send(input)}
              disabled={!input.trim() || loading}
              style={{
                width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: (!input.trim() || loading) ? t.bg.muted : '#818CF8',
                border: 'none', borderRadius: 7,
                cursor: (!input.trim() || loading) ? 'not-allowed' : 'pointer', flexShrink: 0,
              }}
            >
              <Send size={14} style={{ color: (!input.trim() || loading) ? t.text.muted : '#fff' }} />
            </button>
          </div>
          <div style={{ fontSize: 10, color: t.text.muted, marginTop: 5, textAlign: 'center' }}>
            16 narzędzi CRM · pipeline · koszty · pomysły · briefingi
          </div>
        </div>
      </div>

      <style>{`
        @keyframes dmPulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}
