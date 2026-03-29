'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Plus, Trash2, Loader2, Search } from 'lucide-react'
import { t } from '@/lib/tokens'
import { formatPLN } from '@/lib/format'
import { Quote, QuoteItemCategory } from '@/lib/types'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ClientSearchResult {
  id: string
  name: string
  industry?: string
  status: string
}

interface LineItem {
  id: string // local key only
  name: string
  category: QuoteItemCategory
  price: string // string for controlled input, convert on submit
  quantity: string
}

interface NewQuoteModalProps {
  open: boolean
  onClose: () => void
  onSuccess: (quote: Quote) => void
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<QuoteItemCategory, string> = {
  setup: 'Wdrożenie',
  monthly: 'Miesięcznie',
  onetime: 'Jednorazowo',
}

const BLANK_ITEM = (): LineItem => ({
  id: Math.random().toString(36).slice(2),
  name: '',
  category: 'setup',
  price: '',
  quantity: '1',
})

// ─── Shared input/label styles ────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  backgroundColor: t.bg.input,
  border: `1px solid ${t.border.default}`,
  borderRadius: t.radius.sm,
  fontSize: 14,
  color: t.text.primary,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 500,
  color: t.text.secondary,
  marginBottom: 5,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
}

// ─── Component ────────────────────────────────────────────────────────────────

export function NewQuoteModal({ open, onClose, onSuccess }: NewQuoteModalProps) {
  // Client search
  const [clientQuery, setClientQuery] = useState('')
  const [clientResults, setClientResults] = useState<ClientSearchResult[]>([])
  const [selectedClient, setSelectedClient] = useState<ClientSearchResult | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Form fields
  const [title, setTitle] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [discountPct, setDiscountPct] = useState('0')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<LineItem[]>([BLANK_ITEM()])

  // Submit state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Reset on open ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setClientQuery('')
      setClientResults([])
      setSelectedClient(null)
      setShowDropdown(false)
      setTitle('')
      setValidUntil('')
      setDiscountPct('0')
      setNotes('')
      setItems([BLANK_ITEM()])
      setError(null)
      setTimeout(() => searchRef.current?.focus(), 80)
    }
  }, [open])

  // ── Escape key ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  // ── Client search debounce ────────────────────────────────────────────────
  useEffect(() => {
    if (selectedClient) return
    if (!clientQuery.trim()) {
      setClientResults([])
      setShowDropdown(false)
      return
    }
    const timer = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(clientQuery)}`)
        const json = await res.json()
        setClientResults(json.clients ?? [])
        setShowDropdown(true)
      } catch {
        setClientResults([])
      } finally {
        setSearchLoading(false)
      }
    }, 220)
    return () => clearTimeout(timer)
  }, [clientQuery, selectedClient])

  // ── Close dropdown on outside click ──────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !searchRef.current?.contains(e.target as Node)
      ) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Line item helpers ─────────────────────────────────────────────────────
  const updateItem = useCallback((id: string, field: keyof LineItem, value: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    )
  }, [])

  const removeItem = useCallback((id: string) => {
    setItems((prev) => (prev.length > 1 ? prev.filter((i) => i.id !== id) : prev))
  }, [])

  const addItem = useCallback(() => {
    setItems((prev) => [...prev, BLANK_ITEM()])
  }, [])

  // ── Live totals ───────────────────────────────────────────────────────────
  const totals = items.reduce(
    (acc, item) => {
      const price = parseFloat(item.price) || 0
      const qty = parseInt(item.quantity) || 1
      const total = price * qty
      if (item.category === 'setup') acc.setup += total
      else if (item.category === 'monthly') acc.monthly += total
      else acc.onetime += total
      return acc
    },
    { setup: 0, monthly: 0, onetime: 0 }
  )

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedClient) {
      setError('Wybierz klienta z listy.')
      return
    }
    if (!title.trim()) {
      setError('Tytuł wyceny jest wymagany.')
      return
    }
    const validItems = items.filter((i) => i.name.trim() && parseFloat(i.price) > 0)
    if (validItems.length === 0) {
      setError('Dodaj co najmniej jedną pozycję z nazwą i ceną.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: selectedClient.id,
          title: title.trim(),
          valid_until: validUntil || undefined,
          discount_pct: parseFloat(discountPct) || 0,
          notes: notes.trim() || undefined,
          items: validItems.map((item, index) => ({
            name: item.name.trim(),
            category: item.category,
            price: parseFloat(item.price),
            quantity: parseInt(item.quantity) || 1,
            sort_order: index,
          })),
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Nieznany błąd.')
        return
      }

      onSuccess(json.quote)
      onClose()
    } catch {
      setError('Błąd połączenia z serwerem.')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.70)',
          backdropFilter: 'blur(4px)',
          zIndex: 200,
        }}
      />

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="quote-modal-title"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 640,
          zIndex: 201,
          backgroundColor: t.bg.cardSolid,
          border: `1px solid ${t.border.default}`,
          borderRight: 'none',
          boxShadow: t.shadow.cardLg,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px 16px',
            borderBottom: `1px solid ${t.border.subtle}`,
            flexShrink: 0,
            position: 'sticky',
            top: 0,
            backgroundColor: t.bg.cardSolid,
            zIndex: 1,
          }}
        >
          <div>
            <h2
              id="quote-modal-title"
              style={{ fontSize: 16, fontWeight: 700, color: t.text.primary, margin: 0 }}
            >
              Nowa wycena
            </h2>
            <p style={{ fontSize: 12, color: t.text.muted, margin: '3px 0 0' }}>
              Utwórz ofertę cenową dla klienta
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Zamknij"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: t.radius.sm,
              border: 'none',
              backgroundColor: 'transparent',
              color: t.text.muted,
              cursor: 'pointer',
            }}
          >
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        {/* ── Body ── */}
        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20, flex: 1 }}>

          {/* ── Section: Client ── */}
          <section>
            <p style={{ fontSize: 11, fontWeight: 600, color: t.text.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
              Klient
            </p>

            {selectedClient ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  backgroundColor: t.bg.input,
                  border: `1px solid ${t.border.success}`,
                  borderRadius: t.radius.sm,
                }}
              >
                <div>
                  <span style={{ fontSize: 14, fontWeight: 600, color: t.text.primary }}>
                    {selectedClient.name}
                  </span>
                  {selectedClient.industry && (
                    <span style={{ fontSize: 12, color: t.text.muted, marginLeft: 8 }}>
                      {selectedClient.industry}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedClient(null)
                    setClientQuery('')
                    setTimeout(() => searchRef.current?.focus(), 50)
                  }}
                  style={{
                    fontSize: 12,
                    color: t.text.muted,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '2px 6px',
                  }}
                >
                  Zmień
                </button>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'relative' }}>
                  <Search
                    style={{
                      position: 'absolute',
                      left: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 15,
                      height: 15,
                      color: t.text.placeholder,
                      pointerEvents: 'none',
                    }}
                  />
                  {searchLoading && (
                    <Loader2
                      style={{
                        position: 'absolute',
                        right: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: 14,
                        height: 14,
                        color: t.text.muted,
                        animation: 'spin 1s linear infinite',
                      }}
                    />
                  )}
                  <input
                    ref={searchRef}
                    type="text"
                    value={clientQuery}
                    onChange={(e) => setClientQuery(e.target.value)}
                    onFocus={() => clientResults.length > 0 && setShowDropdown(true)}
                    placeholder="Szukaj klienta..."
                    style={{ ...inputStyle, paddingLeft: 40 }}
                    autoComplete="off"
                  />
                </div>

                {/* Dropdown */}
                {showDropdown && clientResults.length > 0 && (
                  <div
                    ref={dropdownRef}
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      marginTop: 4,
                      backgroundColor: t.bg.cardSolid,
                      border: `1px solid ${t.border.default}`,
                      borderRadius: t.radius.sm,
                      boxShadow: t.shadow.cardMd,
                      zIndex: 10,
                      overflow: 'hidden',
                    }}
                  >
                    {clientResults.map((client) => (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() => {
                          setSelectedClient(client)
                          setClientQuery(client.name)
                          setShowDropdown(false)
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          width: '100%',
                          padding: '10px 14px',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          textAlign: 'left',
                          borderBottom: `1px solid ${t.border.subtle}`,
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.backgroundColor = t.bg.cardHover
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'
                        }}
                      >
                        <span style={{ fontSize: 14, color: t.text.primary }}>{client.name}</span>
                        {client.industry && (
                          <span style={{ fontSize: 12, color: t.text.muted }}>{client.industry}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {showDropdown && clientResults.length === 0 && !searchLoading && clientQuery.trim() && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      marginTop: 4,
                      backgroundColor: t.bg.cardSolid,
                      border: `1px solid ${t.border.default}`,
                      borderRadius: t.radius.sm,
                      padding: '12px 14px',
                      zIndex: 10,
                    }}
                  >
                    <span style={{ fontSize: 13, color: t.text.muted }}>Brak wyników</span>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* ── Section: Details ── */}
          <section>
            <p style={{ fontSize: 11, fontWeight: 600, color: t.text.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
              Szczegoly wyceny
            </p>

            {/* Title */}
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle} htmlFor="quote-title">
                Tytuł <span style={{ color: t.semantic.error }}>*</span>
              </label>
              <input
                id="quote-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="np. Automatyzacja procesów operacyjnych"
                style={inputStyle}
              />
            </div>

            {/* Valid until + Discount */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle} htmlFor="quote-valid-until">
                  Ważna do
                </label>
                <input
                  id="quote-valid-until"
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  style={{
                    ...inputStyle,
                    colorScheme: 'dark',
                  }}
                />
              </div>
              <div>
                <label style={labelStyle} htmlFor="quote-discount">
                  Rabat (%)
                </label>
                <input
                  id="quote-discount"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={discountPct}
                  onChange={(e) => setDiscountPct(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Notes */}
            <div style={{ marginTop: 12 }}>
              <label style={labelStyle} htmlFor="quote-notes">
                Notatki
              </label>
              <textarea
                id="quote-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Dodatkowe informacje, warunki specjalne..."
                rows={2}
                style={{
                  ...inputStyle,
                  resize: 'vertical',
                  minHeight: 60,
                  lineHeight: '1.5',
                }}
              />
            </div>
          </section>

          {/* ── Section: Line items ── */}
          <section style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: t.text.muted, textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>
                Pozycje
              </p>
              <button
                type="button"
                onClick={addItem}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '5px 12px',
                  borderRadius: t.radius.sm,
                  border: `1px solid ${t.border.default}`,
                  backgroundColor: 'transparent',
                  color: t.text.secondary,
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                <Plus style={{ width: 13, height: 13 }} />
                Dodaj pozycje
              </button>
            </div>

            {/* Column headers */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 110px 90px 70px 28px',
                gap: 8,
                padding: '0 0 6px',
                borderBottom: `1px solid ${t.border.subtle}`,
                marginBottom: 8,
              }}
            >
              {['Nazwa', 'Kategoria', 'Cena PLN', 'Ilość', ''].map((col) => (
                <span key={col} style={{ fontSize: 10, color: t.text.placeholder, fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  {col}
                </span>
              ))}
            </div>

            {/* Item rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 110px 90px 70px 28px',
                    gap: 8,
                    alignItems: 'center',
                  }}
                >
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                    placeholder="np. Konfiguracja n8n"
                    style={{ ...inputStyle, fontSize: 13 }}
                  />
                  <select
                    value={item.category}
                    onChange={(e) => updateItem(item.id, 'category', e.target.value as QuoteItemCategory)}
                    style={{ ...inputStyle, fontSize: 13, appearance: 'none', cursor: 'pointer' }}
                  >
                    {(Object.keys(CATEGORY_LABELS) as QuoteItemCategory[]).map((cat) => (
                      <option key={cat} value={cat}>
                        {CATEGORY_LABELS[cat]}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={item.price}
                    onChange={(e) => updateItem(item.id, 'price', e.target.value)}
                    placeholder="0"
                    style={{ ...inputStyle, fontSize: 13 }}
                  />
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={item.quantity}
                    onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                    style={{ ...inputStyle, fontSize: 13 }}
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    disabled={items.length === 1}
                    aria-label="Usuń pozycję"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 28,
                      height: 28,
                      borderRadius: t.radius.xs,
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: items.length === 1 ? t.text.placeholder : t.text.muted,
                      cursor: items.length === 1 ? 'not-allowed' : 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    <Trash2 style={{ width: 14, height: 14 }} />
                  </button>
                </div>
              ))}
            </div>

            {/* Live totals */}
            <div
              style={{
                marginTop: 16,
                padding: '14px 16px',
                backgroundColor: t.bg.muted,
                border: `1px solid ${t.border.subtle}`,
                borderRadius: t.radius.sm,
                display: 'flex',
                gap: 28,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <span style={{ fontSize: 11, color: t.text.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Wdrozenie
                </span>
                <div style={{ fontSize: 18, fontWeight: 700, color: t.text.primary, marginTop: 2 }}>
                  {formatPLN(totals.setup)}
                </div>
              </div>
              <div>
                <span style={{ fontSize: 11, color: t.text.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Miesieczenie
                </span>
                <div style={{ fontSize: 18, fontWeight: 700, color: t.text.primary, marginTop: 2 }}>
                  {formatPLN(totals.monthly)}<span style={{ fontSize: 12, fontWeight: 400, color: t.text.muted }}>/mc</span>
                </div>
              </div>
              {totals.onetime > 0 && (
                <div>
                  <span style={{ fontSize: 11, color: t.text.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Jednorazowo
                  </span>
                  <div style={{ fontSize: 18, fontWeight: 700, color: t.text.primary, marginTop: 2 }}>
                    {formatPLN(totals.onetime)}
                  </div>
                </div>
              )}
              {parseFloat(discountPct) > 0 && (
                <div>
                  <span style={{ fontSize: 11, color: t.text.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Rabat
                  </span>
                  <div style={{ fontSize: 18, fontWeight: 700, color: t.semantic.warning, marginTop: 2 }}>
                    -{discountPct}%
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Error */}
          {error && (
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: t.semantic.errorBg,
                border: `1px solid ${t.semantic.errorBorder}`,
                borderRadius: t.radius.sm,
                fontSize: 13,
                color: t.semantic.error,
              }}
            >
              {error}
            </div>
          )}

          {/* Footer */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
              paddingTop: 16,
              borderTop: `1px solid ${t.border.subtle}`,
              position: 'sticky',
              bottom: 0,
              backgroundColor: t.bg.cardSolid,
              marginTop: 'auto',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '9px 18px',
                borderRadius: t.radius.sm,
                border: `1px solid ${t.border.default}`,
                backgroundColor: 'transparent',
                color: t.text.secondary,
                fontSize: 14,
                fontWeight: 500,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1,
              }}
            >
              Anuluj
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '9px 22px',
                borderRadius: t.radius.sm,
                background: t.brand.gradient,
                border: 'none',
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                boxShadow: loading ? 'none' : t.shadow.btn,
              }}
            >
              {loading && (
                <Loader2 style={{ width: 15, height: 15, animation: 'spin 1s linear infinite' }} />
              )}
              {loading ? 'Zapisywanie...' : 'Zapisz wycene'}
            </button>
          </div>
        </form>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>
  )
}
