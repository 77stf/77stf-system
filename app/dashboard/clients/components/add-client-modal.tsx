'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Loader2 } from 'lucide-react'
import { t } from '@/lib/tokens'
import { ClientStatus } from '@/lib/types'

interface AddClientModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

const STATUS_OPTIONS: { value: ClientStatus; label: string }[] = [
  { value: 'lead', label: 'Lead' },
  { value: 'active', label: 'Aktywny' },
  { value: 'partner', label: 'Partner' },
  { value: 'closed', label: 'Zamknięty' },
]

interface FormState {
  name: string
  industry: string
  size: string
  owner_name: string
  owner_email: string
  owner_phone: string
  status: ClientStatus
  source: string
  notes: string
}

const INITIAL_FORM: FormState = {
  name: '',
  industry: '',
  size: '',
  owner_name: '',
  owner_email: '',
  owner_phone: '',
  status: 'lead',
  source: '',
  notes: '',
}

export function AddClientModal({ open, onClose, onSuccess }: AddClientModalProps) {
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  // Focus first field when modal opens; reset form when modal closes
  useEffect(() => {
    if (open) {
      setForm(INITIAL_FORM)
      setError(null)
      setTimeout(() => nameRef.current?.focus(), 80)
    }
  }, [open])

  // Close on Escape key
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const set = (field: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('Nazwa firmy jest wymagana.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          industry: form.industry || undefined,
          size: form.size || undefined,
          owner_name: form.owner_name || undefined,
          owner_email: form.owner_email || undefined,
          owner_phone: form.owner_phone || undefined,
          status: form.status,
          source: form.source || undefined,
          notes: form.notes || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Nieznany błąd.')
        return
      }
      onSuccess()
      onClose()
    } catch {
      setError('Błąd połączenia z serwerem.')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '9px 12px',
    backgroundColor: t.bg.input,
    border: `1px solid ${t.border.default}`,
    borderRadius: t.radius.sm,
    fontSize: 14,
    color: t.text.primary,
    outline: 'none',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 12,
    fontWeight: 500,
    color: t.text.secondary,
    marginBottom: 6,
    letterSpacing: '0.02em',
    textTransform: 'uppercase',
  }

  const fieldStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.60)',
          backdropFilter: 'blur(4px)',
          zIndex: 100,
        }}
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 101,
          width: '100%',
          maxWidth: 560,
          maxHeight: '90vh',
          overflowY: 'auto',
          backgroundColor: t.bg.cardSolid,
          border: `1px solid ${t.border.default}`,
          borderRadius: t.radius.lg,
          boxShadow: t.shadow.cardLg,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px 16px',
            borderBottom: `1px solid ${t.border.subtle}`,
          }}
        >
          <h2
            id="modal-title"
            style={{ fontSize: 16, fontWeight: 700, color: t.text.primary, margin: 0 }}
          >
            Dodaj klienta
          </h2>
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

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '20px 24px 24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Nazwa firmy */}
            <div style={fieldStyle}>
              <label style={labelStyle} htmlFor="name">
                Nazwa firmy <span style={{ color: t.semantic.error }}>*</span>
              </label>
              <input
                ref={nameRef}
                id="name"
                type="text"
                value={form.name}
                onChange={set('name')}
                placeholder="np. TransPol Sp. z o.o."
                style={inputStyle}
                required
              />
            </div>

            {/* Branża + Wielkość */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={fieldStyle}>
                <label style={labelStyle} htmlFor="industry">
                  Branża
                </label>
                <input
                  id="industry"
                  type="text"
                  value={form.industry}
                  onChange={set('industry')}
                  placeholder="np. Transport, Farmacja"
                  style={inputStyle}
                />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle} htmlFor="size">
                  Wielkość firmy
                </label>
                <input
                  id="size"
                  type="text"
                  value={form.size}
                  onChange={set('size')}
                  placeholder="np. 10-50 osób"
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Status */}
            <div style={fieldStyle}>
              <label style={labelStyle} htmlFor="status">
                Status
              </label>
              <select
                id="status"
                value={form.status}
                onChange={set('status')}
                style={{ ...inputStyle, appearance: 'none' }}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Kontakt */}
            <div style={{ borderTop: `1px solid ${t.border.subtle}`, paddingTop: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: t.text.muted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Dane kontaktowe
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={fieldStyle}>
                  <label style={labelStyle} htmlFor="owner_name">
                    Imię i nazwisko
                  </label>
                  <input
                    id="owner_name"
                    type="text"
                    value={form.owner_name}
                    onChange={set('owner_name')}
                    placeholder="np. Jan Kowalski"
                    style={inputStyle}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={fieldStyle}>
                    <label style={labelStyle} htmlFor="owner_email">
                      Email
                    </label>
                    <input
                      id="owner_email"
                      type="email"
                      value={form.owner_email}
                      onChange={set('owner_email')}
                      placeholder="jan@firma.pl"
                      style={inputStyle}
                    />
                  </div>
                  <div style={fieldStyle}>
                    <label style={labelStyle} htmlFor="owner_phone">
                      Telefon
                    </label>
                    <input
                      id="owner_phone"
                      type="tel"
                      value={form.owner_phone}
                      onChange={set('owner_phone')}
                      placeholder="+48 600 000 000"
                      style={inputStyle}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Źródło + Notatki */}
            <div style={fieldStyle}>
              <label style={labelStyle} htmlFor="source">
                Źródło pozyskania
              </label>
              <input
                id="source"
                type="text"
                value={form.source}
                onChange={set('source')}
                placeholder="np. Polecenie, LinkedIn, cold email"
                style={inputStyle}
              />
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle} htmlFor="notes">
                Notatki
              </label>
              <textarea
                id="notes"
                value={form.notes}
                onChange={set('notes')}
                placeholder="Dodatkowe informacje o kliencie..."
                rows={3}
                style={{
                  ...inputStyle,
                  resize: 'vertical',
                  minHeight: 72,
                  fontFamily: 'inherit',
                  lineHeight: '1.5',
                }}
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div
              style={{
                marginTop: 16,
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

          {/* Footer buttons */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
              marginTop: 24,
              paddingTop: 16,
              borderTop: `1px solid ${t.border.subtle}`,
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
                border: `1px solid ${t.brand.gold}`,
                backgroundColor: t.brand.gold,
                color: t.text.inverted,
                fontSize: 14,
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                boxShadow: loading ? 'none' : t.shadow.btn,
              }}
            >
              {loading && <Loader2 style={{ width: 15, height: 15, animation: 'spin 1s linear infinite' }} />}
              {loading ? 'Zapisywanie...' : 'Dodaj klienta'}
            </button>
          </div>
        </form>

        {/* Spin keyframes injected via style tag */}
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </>
  )
}
