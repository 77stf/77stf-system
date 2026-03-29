'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useRef, useEffect, useState } from 'react'
import {
  LayoutDashboard, Users, FolderKanban, FileText,
  Shield, Settings, LogOut, Receipt, CheckSquare, ClipboardCheck, AlertTriangle,
} from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import { t } from '@/lib/tokens'

const NAV_ITEMS = [
  { href: '/dashboard',           label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/dashboard/clients',   label: 'Klienci',      icon: Users },
  { href: '/dashboard/quotes',    label: 'Wyceny',       icon: Receipt },
  { href: '/dashboard/tasks',     label: 'Zadania',      icon: CheckSquare },
  { href: '/dashboard/audits',    label: 'Audyty',       icon: ClipboardCheck },
  { href: '/dashboard/errors',    label: 'Logi błędów',  icon: AlertTriangle },
  { href: '/dashboard/projects',  label: 'Projekty',     icon: FolderKanban },
  { href: '/dashboard/documents', label: 'Dokumenty',    icon: FileText },
  { href: '/dashboard/guardian',  label: 'Guardian',     icon: Shield },
  { href: '/dashboard/settings',  label: 'Ustawienia',   icon: Settings },
]

interface SidebarProps {
  userEmail?: string
  userName?: string
}

export function Sidebar({ userEmail, userName }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  // ── Single-pill approach: one pill animates between items ─────────────────
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([])
  const [pill, setPill] = useState({ top: 0, height: 38 })

  const activeIndex = NAV_ITEMS.findIndex(
    ({ href }) => pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
  )

  useEffect(() => {
    const el = itemRefs.current[activeIndex]
    if (el) {
      setPill({ top: el.offsetTop, height: el.offsetHeight })
    }
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

  return (
    <>
      {/* ── CSS hover helper ── */}
      <style>{`
        .nav-link { color: ${t.text.secondary}; }
        .nav-link:hover { color: ${t.text.primary} !important; }
        .nav-link.active { color: ${t.text.primary}; }
      `}</style>

      <aside
        style={{
          position: 'fixed', left: 0, top: 0,
          height: '100vh', width: 240,
          display: 'flex', flexDirection: 'column',
          backgroundColor: '#080811',
          borderRight: `1px solid ${t.border.subtle}`,
          zIndex: 40,
        }}
      >
        {/* ── Logo ── */}
        <div style={{
          padding: '22px 20px 20px',
          borderBottom: `1px solid ${t.border.subtle}`,
          display: 'flex', alignItems: 'center', gap: 11,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: t.radius.sm,
            background: t.brand.gradient,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 800, color: '#fff', letterSpacing: '-0.04em',
            flexShrink: 0, boxShadow: '0 2px 10px rgba(196,154,46,0.35)',
          }}>
            77
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: t.text.primary, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
              77STF
            </div>
            <div style={{ fontSize: 10, color: t.text.muted, textTransform: 'uppercase', letterSpacing: '0.20em', marginTop: 2 }}>
              Operations
            </div>
          </div>
        </div>

        {/* ── Navigation ── */}
        <nav style={{ flex: 1, padding: '10px 10px', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          <div style={{
            fontSize: 10, fontWeight: 500, textTransform: 'uppercase',
            letterSpacing: '0.18em', color: t.text.muted, padding: '6px 10px 10px',
          }}>
            Menu
          </div>

          {/* Pill container — pill is a sibling of links, not inside them */}
          <div style={{ position: 'relative' }}>
            {/* Single animated pill — CSS transition, no framer-motion */}
            {activeIndex >= 0 && (
              <div
                aria-hidden
                style={{
                  position: 'absolute', left: 0, right: 0,
                  borderRadius: t.radius.sm,
                  backgroundColor: 'rgba(255,255,255,0.065)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  pointerEvents: 'none',
                  zIndex: 0,
                  top: pill.top,
                  height: pill.height,
                  transition: 'top 280ms cubic-bezier(0.4,0,0.2,1), height 280ms cubic-bezier(0.4,0,0.2,1)',
                }}
              />
            )}

            {/* Left accent bar */}
            {activeIndex >= 0 && (
              <div
                aria-hidden
                style={{
                  position: 'absolute', left: 0, width: 2,
                  borderRadius: '0 2px 2px 0',
                  backgroundColor: 'rgba(242,242,244,0.55)',
                  pointerEvents: 'none',
                  zIndex: 1,
                  top: pill.top + 8,
                  height: Math.max(0, pill.height - 16),
                  transition: 'top 280ms cubic-bezier(0.4,0,0.2,1), height 280ms cubic-bezier(0.4,0,0.2,1)',
                }}
              />
            )}

            {/* Nav links */}
            {NAV_ITEMS.map(({ href, label, icon: Icon }, idx) => {
              const isActive = activeIndex === idx
              return (
                <Link
                  key={href}
                  href={href}
                  ref={el => { itemRefs.current[idx] = el }}
                  className={`nav-link${isActive ? ' active' : ''}`}
                  style={{
                    position: 'relative', zIndex: 1,
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 10px 9px 14px',
                    borderRadius: t.radius.sm,
                    fontSize: 13.5, fontWeight: isActive ? 500 : 400,
                    letterSpacing: '-0.01em', textDecoration: 'none',
                    transition: 'color 120ms',
                  }}
                >
                  <Icon style={{ width: 15, height: 15, flexShrink: 0, opacity: isActive ? 0.82 : 0.38, transition: 'opacity 120ms' }} />
                  {label}
                </Link>
              )
            })}
          </div>
        </nav>

        {/* ── Admin user ── */}
        <div style={{
          padding: '14px 14px 16px',
          borderTop: `1px solid ${t.border.subtle}`,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: t.radius.sm,
            background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.11)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: t.text.secondary, letterSpacing: '-0.02em', flexShrink: 0,
          }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 13, fontWeight: 500, color: t.text.primary,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.01em',
            }}>
              {displayName}
            </div>
            <div style={{ fontSize: 11, color: t.text.muted, display: 'flex', alignItems: 'center', gap: 5, marginTop: 1 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: t.semantic.success, display: 'inline-block', flexShrink: 0 }} />
              Online
            </div>
          </div>
          <button
            onClick={handleSignOut} title="Wyloguj"
            style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0, opacity: 0.45, transition: 'opacity 150ms' }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '0.45')}
          >
            <LogOut style={{ width: 13, height: 13, color: t.text.muted }} />
          </button>
        </div>
      </aside>
    </>
  )
}
