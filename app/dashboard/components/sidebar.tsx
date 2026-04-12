'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useRef, useEffect, useState } from 'react'
import {
  LayoutDashboard, Users, Receipt, CheckSquare, ClipboardCheck,
  Shield, Settings, LogOut, Terminal, Map, Brain, Presentation,
  DollarSign, Lightbulb, Kanban, Wifi, WifiOff,
} from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import { t } from '@/lib/tokens'

// ─── Nav structure ────────────────────────────────────────────────────────────

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  badge?: string
  planned?: boolean
}

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Pipeline',
    items: [
      { href: '/dashboard',              label: 'Dashboard',        icon: LayoutDashboard },
      { href: '/dashboard/roadmap',      label: 'Roadmap',          icon: Kanban },
      { href: '/dashboard/clients',      label: 'Klienci',          icon: Users },
      { href: '/dashboard/quotes',       label: 'Wyceny',           icon: Receipt },
      { href: '/dashboard/presentations',label: 'Prezentacje',      icon: Presentation },
    ],
  },
  {
    label: 'Narzędzia',
    items: [
      { href: '/dashboard/tasks',        label: 'Zadania',          icon: CheckSquare },
      { href: '/dashboard/audits',       label: 'Audyty',           icon: ClipboardCheck },
      { href: '/dashboard/costs',        label: 'Koszty',           icon: DollarSign,    planned: true  },
    ],
  },
  {
    label: 'Agenci AI',
    items: [
      { href: '/dashboard/operator',     label: 'Drugi Mózg',       icon: Terminal,      badge: 'AI' },
      { href: '/dashboard/guardian',     label: 'Opiekun Systemu',  icon: Shield,        badge: 'AI' },
      { href: '/dashboard/intelligence', label: 'Wywiad',           icon: Brain,         badge: 'AI' },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/dashboard/settings',     label: 'Ustawienia',       icon: Settings },
      { href: '/dashboard/system-map',   label: 'Mapa Systemu',     icon: Map },
      { href: '/dashboard/ideas',        label: 'Pomysły',          icon: Lightbulb },
    ],
  },
]

// Flat list for active index detection
const ALL_ITEMS = NAV_GROUPS.flatMap(g => g.items)

interface SidebarProps {
  userEmail?: string
  userName?: string
}

export function Sidebar({ userEmail, userName }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([])
  const [pill, setPill] = useState({ top: 0, height: 38 })

  const activeIndex = ALL_ITEMS.findIndex(
    ({ href }) => href !== '#slack' && href !== '#n8n' && (
      pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
    )
  )

  useEffect(() => {
    const el = itemRefs.current[activeIndex]
    if (el) setPill({ top: el.offsetTop, height: el.offsetHeight })
  }, [activeIndex, pathname])

  async function handleSignOut() {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const displayName = userName || (userEmail ? userEmail.split('@')[0] : 'Admin')
  const initials = displayName.slice(0, 1).toUpperCase()

  // MCP connections shown in sidebar
  const MCP_CONNECTIONS = [
    { label: 'Gmail',    connected: true },
    { label: 'GCal',     connected: true },
    { label: 'Notion',   connected: true },
    { label: 'Canva',    connected: true },
    { label: 'Slack',    connected: false },
  ]

  let itemIndex = -1 // running index across all items for refs

  return (
    <>
      <style>{`
        .nav-link { color: ${t.text.secondary}; }
        .nav-link:hover:not(.planned) { color: ${t.text.primary} !important; background: rgba(255,255,255,0.03); }
        .nav-link.active { color: ${t.text.primary}; }
        .nav-link.planned { cursor: default; opacity: 0.45; }
        .nav-link.planned:hover { color: ${t.text.secondary} !important; background: none !important; }
      `}</style>

      <aside style={{
        position: 'fixed', left: 0, top: 0,
        height: '100vh', width: 224,
        display: 'flex', flexDirection: 'column',
        backgroundColor: t.bg.sidebar,
        borderRight: `1px solid ${t.border.subtle}`,
        zIndex: 40,
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 18px 18px', borderBottom: `1px solid ${t.border.subtle}`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: t.radius.sm,
            background: t.brand.gradient,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 800, color: '#fff', letterSpacing: '-0.04em',
            flexShrink: 0, boxShadow: '0 2px 8px rgba(196,154,46,0.32)',
          }}>77</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.text.primary, lineHeight: 1.1, letterSpacing: '-0.02em' }}>77STF</div>
            <div style={{ fontSize: 9, color: t.text.muted, textTransform: 'uppercase', letterSpacing: '0.20em', marginTop: 2 }}>Operations</div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '8px 8px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0 }}>
          {/* Pill + accent — positioned relative to whole nav */}
          <div style={{ position: 'relative' }}>
            {activeIndex >= 0 && (
              <>
                <div aria-hidden style={{
                  position: 'absolute', left: 0, right: 0,
                  borderRadius: t.radius.sm,
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.09)',
                  pointerEvents: 'none', zIndex: 0,
                  top: pill.top, height: pill.height,
                  transition: 'top 260ms cubic-bezier(0.4,0,0.2,1), height 260ms cubic-bezier(0.4,0,0.2,1)',
                }} />
                <div aria-hidden style={{
                  position: 'absolute', left: 0, width: 2,
                  borderRadius: '0 2px 2px 0',
                  backgroundColor: 'rgba(242,242,244,0.5)',
                  pointerEvents: 'none', zIndex: 1,
                  top: pill.top + 8,
                  height: Math.max(0, pill.height - 16),
                  transition: 'top 260ms cubic-bezier(0.4,0,0.2,1), height 260ms cubic-bezier(0.4,0,0.2,1)',
                }} />
              </>
            )}

            {NAV_GROUPS.map(group => (
              <div key={group.label} style={{ marginBottom: 4 }}>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', color: t.text.muted, padding: '10px 10px 5px', opacity: 0.7 }}>
                  {group.label}
                </div>
                {group.items.map(({ href, label, icon: Icon, badge, planned }) => {
                  itemIndex++
                  const myIndex = itemIndex
                  const isActive = activeIndex === myIndex
                  const isPlanned = planned === true

                  return (
                    <Link
                      key={href}
                      href={isPlanned ? '#' : href}
                      ref={el => { itemRefs.current[myIndex] = el }}
                      className={`nav-link${isActive ? ' active' : ''}${isPlanned ? ' planned' : ''}`}
                      onClick={isPlanned ? (e) => e.preventDefault() : undefined}
                      style={{
                        position: 'relative', zIndex: 1,
                        display: 'flex', alignItems: 'center', gap: 9,
                        padding: '8px 10px 8px 12px',
                        borderRadius: t.radius.sm,
                        fontSize: 13, fontWeight: isActive ? 600 : 400,
                        letterSpacing: '-0.01em', textDecoration: 'none',
                        transition: 'color 100ms, background 100ms',
                      }}
                    >
                      <Icon style={{ width: 14, height: 14, flexShrink: 0, opacity: isActive ? 0.9 : isPlanned ? 0.4 : 0.45, transition: 'opacity 100ms' }} />
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
                      {badge && !isActive && !isPlanned && (
                        <span style={{
                          fontSize: 8, fontWeight: 800, letterSpacing: '0.06em',
                          color: '#818CF8', background: 'rgba(129,140,248,0.12)',
                          border: '1px solid rgba(129,140,248,0.22)',
                          borderRadius: t.radius.full, padding: '1px 5px', flexShrink: 0,
                        }}>
                          {badge}
                        </span>
                      )}
                      {isPlanned && (
                        <span style={{
                          fontSize: 8, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
                          color: t.text.muted, background: t.bg.muted,
                          border: `1px solid ${t.border.subtle}`,
                          borderRadius: t.radius.full, padding: '1px 5px', flexShrink: 0,
                        }}>
                          wkrótce
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            ))}
          </div>
        </nav>

        {/* MCP connections strip */}
        <div style={{ padding: '8px 12px', borderTop: `1px solid ${t.border.subtle}` }}>
          <div style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', color: t.text.muted, marginBottom: 6, opacity: 0.6 }}>
            MCP / API
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {MCP_CONNECTIONS.map(({ label, connected }) => (
              <div
                key={label}
                title={connected ? `${label} — połączono` : `${label} — niepołączono`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 3,
                  fontSize: 9, fontWeight: 600,
                  padding: '2px 6px', borderRadius: t.radius.full,
                  background: connected ? 'rgba(74,222,128,0.08)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${connected ? 'rgba(74,222,128,0.2)' : t.border.subtle}`,
                  color: connected ? '#4ade80' : t.text.muted,
                }}
              >
                {connected
                  ? <Wifi style={{ width: 7, height: 7 }} />
                  : <WifiOff style={{ width: 7, height: 7 }} />
                }
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* User */}
        <div style={{ padding: '12px 12px 14px', borderTop: `1px solid ${t.border.subtle}`, display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{
            width: 30, height: 30, borderRadius: t.radius.sm,
            background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.11)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: t.text.secondary, flexShrink: 0,
          }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: t.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {displayName}
            </div>
            <div style={{ fontSize: 10, color: t.text.muted, display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: t.semantic.success, display: 'inline-block', flexShrink: 0 }} />
              Online
            </div>
          </div>
          <button
            onClick={handleSignOut}
            title="Wyloguj"
            style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0, opacity: 0.4, transition: 'opacity 150ms' }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '0.4')}
          >
            <LogOut style={{ width: 13, height: 13, color: t.text.muted }} />
          </button>
        </div>
      </aside>
    </>
  )
}
