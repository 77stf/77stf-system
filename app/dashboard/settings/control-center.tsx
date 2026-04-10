'use client'

import { useState, useTransition } from 'react'
import { t } from '@/lib/tokens'

interface Toggle {
  key: string
  enabled: boolean
  label: string
  description: string | null
  category: string
  updated_at: string
}

const CAT_META: Record<string, { label: string; icon: string; color: string }> = {
  workflow: { label: 'n8n Workflows',  icon: '⚡', color: '#A78BFA' },
  agent:    { label: 'Agenci AI',      icon: '🤖', color: '#C9A84C' },
  infra:    { label: 'Infrastruktura', icon: '🏗️', color: '#F472B6' },
}

function ToggleSwitch({
  enabled, onChange, disabled,
}: { enabled: boolean; onChange: (v: boolean) => void; disabled: boolean }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      disabled={disabled}
      aria-checked={enabled}
      role="switch"
      style={{
        width: 40, height: 22, borderRadius: 11, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        background: enabled ? '#22C55E' : 'rgba(255,255,255,0.12)',
        position: 'relative', flexShrink: 0, transition: 'background 200ms',
        opacity: disabled ? 0.5 : 1,
        boxShadow: enabled ? '0 0 8px rgba(34,197,94,0.35)' : 'none',
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: enabled ? 21 : 3,
        width: 16, height: 16, borderRadius: '50%', background: '#fff',
        transition: 'left 200ms', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        display: 'block',
      }} />
    </button>
  )
}

export function ControlCenter({ initialToggles }: { initialToggles: Toggle[] }) {
  const [toggles, setToggles] = useState<Toggle[]>(initialToggles)
  const [pending, startTransition] = useTransition()
  const [loadingKey, setLoadingKey] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  async function handleToggle(key: string, enabled: boolean) {
    setLoadingKey(key)
    // Optimistic update
    setToggles(prev => prev.map(t => t.key === key ? { ...t, enabled } : t))

    try {
      const res = await fetch('/api/system/toggles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, enabled }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      showToast(`${enabled ? '✅ Włączono' : '⏸️ Wyłączono'}: ${toggles.find(t => t.key === key)?.label}`, true)
    } catch {
      // Revert
      setToggles(prev => prev.map(t => t.key === key ? { ...t, enabled: !enabled } : t))
      showToast('Błąd aktualizacji', false)
    } finally {
      setLoadingKey(null)
    }
  }

  const categories = ['workflow', 'agent', 'infra']
  const activeCount = toggles.filter(t => t.enabled).length
  const totalCount = toggles.length

  return (
    <div style={{ position: 'relative' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 999,
          padding: '10px 18px', borderRadius: 10,
          background: toast.ok ? 'rgba(34,197,94,0.15)' : 'rgba(248,113,113,0.15)',
          border: `1px solid ${toast.ok ? '#22C55E44' : '#f8717144'}`,
          color: toast.ok ? '#22C55E' : '#f87171',
          fontSize: 13, fontWeight: 600,
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          backdropFilter: 'blur(12px)',
          animation: 'fadeIn 150ms ease',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header stats */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24,
        padding: '14px 20px', borderRadius: 12,
        background: '#0E0E13', border: '1px solid rgba(255,255,255,0.07)',
      }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#22C55E', lineHeight: 1 }}>{activeCount}</div>
          <div style={{ fontSize: 10, color: t.text.muted, fontWeight: 600 }}>Aktywne</div>
        </div>
        <div style={{ width: 1, height: 28, background: t.border.subtle }} />
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: t.text.muted, lineHeight: 1 }}>{totalCount - activeCount}</div>
          <div style={{ fontSize: 10, color: t.text.muted, fontWeight: 600 }}>Wyłączone</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button
            onClick={() => toggles.forEach(tog => !tog.enabled && handleToggle(tog.key, true))}
            style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.08)', color: '#22C55E', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
          >
            ▶ Włącz wszystko
          </button>
          <button
            onClick={() => toggles.forEach(tog => tog.enabled && handleToggle(tog.key, false))}
            style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(251,146,60,0.3)', background: 'rgba(251,146,60,0.08)', color: '#FB923C', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
          >
            ⏸ Wyłącz wszystko
          </button>
        </div>
      </div>

      {/* Category sections */}
      {categories.map(cat => {
        const meta = CAT_META[cat]
        const items = toggles.filter(t => t.category === cat)
        if (!items.length) return null
        const catActive = items.filter(t => t.enabled).length

        return (
          <div key={cat} style={{ marginBottom: 20 }}>
            {/* Category header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 13 }}>{meta.icon}</span>
              <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: meta.color }}>
                {meta.label}
              </span>
              <div style={{ flex: 1, height: 1, background: t.border.subtle }} />
              <span style={{ fontSize: 10, color: meta.color, background: `${meta.color}18`, padding: '2px 8px', borderRadius: 10 }}>
                {catActive}/{items.length} aktywne
              </span>
            </div>

            {/* Items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {items.map(item => {
                const isLoading = loadingKey === item.key
                return (
                  <div
                    key={item.key}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '12px 16px', borderRadius: 10,
                      background: item.enabled ? 'rgba(34,197,94,0.04)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${item.enabled ? 'rgba(34,197,94,0.18)' : 'rgba(255,255,255,0.06)'}`,
                      transition: 'all 200ms',
                      opacity: isLoading ? 0.7 : 1,
                    }}
                  >
                    {/* Status dot */}
                    <div style={{
                      width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                      background: item.enabled ? '#22C55E' : '#4B5563',
                      boxShadow: item.enabled ? '0 0 6px rgba(34,197,94,0.5)' : 'none',
                      transition: 'all 200ms',
                    }} />

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: item.enabled ? t.text.primary : t.text.muted }}>
                        {item.label}
                      </div>
                      {item.description && (
                        <div style={{ fontSize: 11, color: t.text.muted, marginTop: 1, lineHeight: 1.4 }}>
                          {item.description}
                        </div>
                      )}
                    </div>

                    {/* Key badge */}
                    <code style={{ fontSize: 9, color: t.text.muted, background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: 4, flexShrink: 0 }}>
                      {item.key}
                    </code>

                    {/* Updated */}
                    <div style={{ fontSize: 9, color: t.text.muted, flexShrink: 0, textAlign: 'right', minWidth: 70 }}>
                      {isLoading ? '⏳ ...' : new Date(item.updated_at).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                    </div>

                    {/* Toggle */}
                    <ToggleSwitch
                      enabled={item.enabled}
                      onChange={v => handleToggle(item.key, v)}
                      disabled={isLoading}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }`}</style>
    </div>
  )
}
