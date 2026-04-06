'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search, LayoutDashboard, Users, FolderKanban,
  FileText, Shield, Settings, ArrowRight, Building2,
} from 'lucide-react'
import { t } from '@/lib/tokens'

// ─── Types ───────────────────────────────────────────────────────────────────

interface NavItem {
  kind: 'nav'
  label: string
  sub: string
  href: string
  icon: React.ElementType
}

interface ClientItem {
  kind: 'client'
  label: string
  sub: string
  href: string
  status: string
}

type PaletteItem = NavItem | ClientItem

// ─── Static nav items ────────────────────────────────────────────────────────

const NAV: NavItem[] = [
  { kind: 'nav', label: 'Dashboard',  sub: 'Przegląd',           href: '/dashboard',           icon: LayoutDashboard },
  { kind: 'nav', label: 'Klienci',    sub: 'Lista klientów',     href: '/dashboard/clients',   icon: Users },
  { kind: 'nav', label: 'Projekty',   sub: 'Wszystkie projekty', href: '/dashboard/projects',  icon: FolderKanban },
  { kind: 'nav', label: 'Dokumenty',  sub: 'Oferty i umowy',     href: '/dashboard/documents', icon: FileText },
  { kind: 'nav', label: 'Guardian',   sub: 'Monitor systemu',    href: '/dashboard/guardian',  icon: Shield },
  { kind: 'nav', label: 'Ustawienia', sub: 'Konfiguracja',       href: '/dashboard/settings',  icon: Settings },
]

const STATUS_COLORS: Record<string, string> = {
  lead:    t.semantic.warning,
  active:  'rgba(242,242,244,0.75)',
  partner: t.semantic.success,
  closed:  t.text.muted,
}

// ─── Command Palette ─────────────────────────────────────────────────────────

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [clients, setClients] = useState<ClientItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    if (open) {
      setQuery('')
      setClients([])
      setSelected(0)
      setTimeout(() => inputRef.current?.focus(), 60)
    }
  }, [open])

  useEffect(() => {
    if (!query.trim()) { setClients([]); return }
    const id = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
        const data = await res.json()
        setClients(
          (data.clients ?? []).map((c: { id: string; name: string; industry?: string; status: string }) => ({
            kind: 'client' as const,
            label: c.name,
            sub: c.industry ?? c.status,
            href: `/dashboard/clients/${c.id}`,
            status: c.status,
          }))
        )
      } finally {
        setLoading(false)
      }
    }, 200)
    return () => clearTimeout(id)
  }, [query])

  const navFiltered = query.trim()
    ? NAV.filter((n) => n.label.toLowerCase().includes(query.toLowerCase()))
    : NAV

  const items: PaletteItem[] = [...navFiltered, ...clients]

  const go = useCallback((href: string) => {
    router.push(href)
    onClose()
  }, [router, onClose])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelected((s) => Math.min(s + 1, items.length - 1)) }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)) }
      if (e.key === 'Enter' && items[selected]) { go(items[selected].href) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, items, selected, go, onClose])

  useEffect(() => { setSelected(0) }, [query])

  if (!open) return null

  return (
    <>
          {/* Backdrop */}
          <div
            onClick={onClose}
            style={{
              position: 'fixed', inset: 0,
              backgroundColor: 'rgba(0,0,0,0.60)',
              backdropFilter: 'blur(6px)',
              zIndex: 9998,
              animation: 'cpFadeIn 0.15s ease',
            }}
          />

          {/* Panel */}
          <div
            style={{
              position: 'fixed',
              top: '18%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 560,
              maxWidth: 'calc(100vw - 48px)',
              backgroundColor: t.bg.cardSolid,
              border: `1px solid ${t.border.hover}`,
              borderRadius: t.radius.xl,
              boxShadow: '0 24px 80px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.07)',
              overflow: 'hidden',
              zIndex: 9999,
              animation: 'cpSlideIn 0.18s cubic-bezier(0.25,0.46,0.45,0.94)',
            }}
          >
            {/* Search input */}
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '16px 20px',
                borderBottom: `1px solid ${t.border.default}`,
              }}
            >
              <Search style={{ width: 18, height: 18, color: query ? t.text.secondary : t.text.muted, flexShrink: 0, transition: 'color 150ms' }} />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Szukaj klientów, nawiguj..."
                style={{
                  flex: 1, background: 'none', border: 'none', outline: 'none',
                  fontSize: 16, color: t.text.primary,
                }}
              />
              {loading && (
                <div style={{ width: 16, height: 16, border: `2px solid ${t.border.default}`, borderTopColor: t.text.secondary, borderRadius: '50%', animation: 'cp-spin 0.7s linear infinite', flexShrink: 0 }} />
              )}
              <kbd style={{ fontSize: 11, color: t.text.muted, backgroundColor: t.bg.muted, border: `1px solid ${t.border.default}`, borderRadius: 4, padding: '2px 6px', fontFamily: 'monospace', flexShrink: 0 }}>
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div style={{ maxHeight: 380, overflowY: 'auto', padding: 8 }}>
              {items.length === 0 && query.trim() ? (
                <div style={{ padding: '28px 16px', textAlign: 'center', color: t.text.muted, fontSize: 14 }}>
                  Brak wyników dla &ldquo;{query}&rdquo;
                </div>
              ) : (
                <>
                  {/* Nav group */}
                  {navFiltered.length > 0 && (
                    <div>
                      {!query.trim() && (
                        <div style={{ padding: '6px 12px 4px', fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.14em', color: t.text.muted }}>
                          Nawigacja
                        </div>
                      )}
                      {navFiltered.map((item, idx) => {
                        const isSelected = idx === selected
                        return (
                          <button
                            key={item.href}
                            onClick={() => go(item.href)}
                            style={{
                              width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                              padding: '10px 12px', borderRadius: t.radius.md,
                              border: 'none', cursor: 'pointer', textAlign: 'left',
                              backgroundColor: isSelected ? 'rgba(255,255,255,0.08)' : 'transparent',
                              transition: 'background-color 100ms',
                            }}
                            onMouseEnter={() => setSelected(idx)}
                          >
                            <div style={{ width: 32, height: 32, borderRadius: t.radius.sm, backgroundColor: isSelected ? 'rgba(255,255,255,0.10)' : t.bg.muted, border: `1px solid ${isSelected ? t.border.hover : t.border.default}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 100ms' }}>
                              <item.icon style={{ width: 15, height: 15, color: isSelected ? t.text.primary : t.text.muted }} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 14, fontWeight: 500, color: isSelected ? t.text.primary : t.text.secondary }}>{item.label}</div>
                              <div style={{ fontSize: 12, color: t.text.muted }}>{item.sub}</div>
                            </div>
                            {isSelected && <ArrowRight style={{ width: 14, height: 14, color: t.text.secondary, flexShrink: 0 }} />}
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {/* Clients group */}
                  {clients.length > 0 && (
                    <div style={{ marginTop: navFiltered.length > 0 ? 4 : 0 }}>
                      <div style={{ padding: '6px 12px 4px', fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.14em', color: t.text.muted }}>
                        Klienci
                      </div>
                      {clients.map((item, i) => {
                        const idx = navFiltered.length + i
                        const isSelected = idx === selected
                        return (
                          <button
                            key={item.href}
                            onClick={() => go(item.href)}
                            style={{
                              width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                              padding: '10px 12px', borderRadius: t.radius.md,
                              border: 'none', cursor: 'pointer', textAlign: 'left',
                              backgroundColor: isSelected ? 'rgba(255,255,255,0.08)' : 'transparent',
                              transition: 'background-color 100ms',
                            }}
                            onMouseEnter={() => setSelected(idx)}
                          >
                            <div style={{ width: 32, height: 32, borderRadius: t.radius.sm, backgroundColor: isSelected ? 'rgba(255,255,255,0.10)' : t.bg.muted, border: `1px solid ${isSelected ? t.border.hover : t.border.default}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <Building2 style={{ width: 15, height: 15, color: STATUS_COLORS[item.status] ?? t.text.muted }} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 14, fontWeight: 500, color: isSelected ? t.text.primary : t.text.secondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</div>
                              <div style={{ fontSize: 12, color: t.text.muted }}>{item.sub}</div>
                            </div>
                            {isSelected && <ArrowRight style={{ width: 14, height: 14, color: t.text.secondary, flexShrink: 0 }} />}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '8px 16px', borderTop: `1px solid ${t.border.subtle}`, display: 'flex', gap: 16 }}>
              {[['↑↓', 'nawigacja'], ['↵', 'przejdź'], ['ESC', 'zamknij']].map(([key, label]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <kbd style={{ fontSize: 10, color: t.text.muted, backgroundColor: t.bg.muted, border: `1px solid ${t.border.default}`, borderRadius: 4, padding: '1px 5px', fontFamily: 'monospace' }}>{key}</kbd>
                  <span style={{ fontSize: 11, color: t.text.muted }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
    <style>{`
      @keyframes cpFadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes cpSlideIn { from { opacity: 0; transform: translateX(-50%) scale(0.96) translateY(-8px); } to { opacity: 1; transform: translateX(-50%) scale(1) translateY(0); } }
      @keyframes cp-spin { to { transform: rotate(360deg); } }
    `}</style>
    </>
  )
}
