'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import { Search, Bell, Command, CloudSun, ChevronRight, LogOut, Settings, User } from 'lucide-react'
import { t } from '@/lib/tokens'
import { createBrowserClient } from '@supabase/ssr'

// ─── Page titles & breadcrumbs ────────────────────────────────────────────────

const PAGE_META: Record<string, { title: string; section: string }> = {
  '/dashboard':                      { title: 'Dashboard',         section: 'Główne' },
  '/dashboard/clients':              { title: 'Klienci',           section: 'CRM' },
  '/dashboard/tasks':                { title: 'Zadania',           section: 'CRM' },
  '/dashboard/quotes':               { title: 'Wyceny',            section: 'CRM' },
  '/dashboard/audits':               { title: 'Audyty',            section: 'CRM' },
  '/dashboard/intelligence':         { title: 'Intelligence Hub',  section: 'Agenci AI' },
  '/dashboard/operator':             { title: 'Operator',          section: 'Agenci AI' },
  '/dashboard/guardian':             { title: 'Guardian',          section: 'Agenci AI' },
  '/dashboard/content':              { title: 'Content Studio',    section: 'Agenci AI' },
  '/dashboard/ai-costs':             { title: 'Koszty AI',         section: 'Monitoring' },
  '/dashboard/errors':               { title: 'Logi błędów',       section: 'Monitoring' },
  '/dashboard/telegram':             { title: 'Telegram',          section: 'Monitoring' },
  '/dashboard/system-map':           { title: 'Mapa Systemu',      section: 'Monitoring' },
  '/dashboard/settings':             { title: 'Ustawienia',        section: 'Konto' },
}

function getPageMeta(pathname: string) {
  if (PAGE_META[pathname]) return PAGE_META[pathname]
  const match = Object.entries(PAGE_META).find(
    ([key]) => pathname.startsWith(key) && key !== '/dashboard'
  )
  return match?.[1] ?? { title: 'Dashboard', section: 'Główne' }
}

// ─── Clock ────────────────────────────────────────────────────────────────────

function Clock() {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  if (!now) return null

  const time = now.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const date = now.toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: t.text.secondary, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.02em' }}>
        {time}
      </span>
      <span style={{ fontSize: 10, color: t.text.muted, marginTop: 2 }}>{date}</span>
    </div>
  )
}

// ─── Weather ──────────────────────────────────────────────────────────────────

function Weather() {
  const [weather, setWeather] = useState<{ emoji: string; temp: string; city: string } | null>(null)

  useEffect(() => {
    const cached = sessionStorage.getItem('wx')
    if (cached) {
      try { setWeather(JSON.parse(cached)); return } catch {}
    }

    fetch('https://wttr.in/?format=%c+%t&lang=pl', { signal: AbortSignal.timeout(4000) })
      .then(r => r.text())
      .then(raw => {
        const text = raw.trim()
        const match = text.match(/^(\S+)\s+([+-]?\d+°C)$/)
        if (match) {
          const w = { emoji: match[1], temp: match[2], city: 'PL' }
          setWeather(w)
          sessionStorage.setItem('wx', JSON.stringify(w))
        }
      })
      .catch(() => {})
  }, [])

  if (!weather) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <CloudSun style={{ width: 13, height: 13, color: t.text.muted }} />
      <span style={{ fontSize: 11, color: t.text.muted }}>—</span>
    </div>
  )

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} title="Pogoda w Polsce">
      <span style={{ fontSize: 14, lineHeight: 1 }}>{weather.emoji}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: t.text.secondary }}>{weather.temp}</span>
    </div>
  )
}

// ─── Notifications bell ───────────────────────────────────────────────────────

function NotificationBell() {
  const [count] = useState(0) // future: fetch from guardian_reports / error_log

  return (
    <button
      title="Powiadomienia"
      style={{
        position: 'relative', width: 32, height: 32, borderRadius: 8,
        background: 'transparent', border: `1px solid ${t.border.default}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', flexShrink: 0, transition: 'all 150ms',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = t.bg.overlay; e.currentTarget.style.borderColor = t.border.hover }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = t.border.default }}
    >
      <Bell style={{ width: 14, height: 14, color: t.text.muted }} />
      {count > 0 && (
        <span style={{
          position: 'absolute', top: 5, right: 5, width: 6, height: 6,
          borderRadius: '50%', background: '#f87171',
          boxShadow: '0 0 6px rgba(248,113,113,0.6)',
        }} />
      )}
    </button>
  )
}

// ─── User menu ────────────────────────────────────────────────────────────────

function UserMenu({ userEmail }: { userEmail?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const initials = userEmail
    ? userEmail.split('@')[0].slice(0, 2).toUpperCase()
    : '77'

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function handleLogout() {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        title={userEmail}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '3px 8px 3px 3px',
          borderRadius: 10, border: `1px solid ${open ? t.border.hover : t.border.default}`,
          background: open ? t.bg.overlay : 'transparent',
          cursor: 'pointer', transition: 'all 150ms',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = t.bg.overlay; e.currentTarget.style.borderColor = t.border.hover }}
        onMouseLeave={e => { if (!open) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = t.border.default } }}
      >
        {/* Avatar */}
        <div style={{
          width: 26, height: 26, borderRadius: 8,
          background: 'linear-gradient(135deg, #C49A2E22, #818CF822)',
          border: `1px solid ${t.border.hover}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 800, color: t.text.secondary, letterSpacing: '0.04em',
        }}>
          {initials}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: t.text.secondary }}>
            {userEmail?.split('@')[0] ?? '77stf'}
          </span>
          <span style={{ fontSize: 9, color: t.text.muted }}>Admin</span>
        </div>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0,
          width: 200, background: '#13131A',
          border: `1px solid ${t.border.default}`, borderRadius: 10,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)', zIndex: 100, overflow: 'hidden',
        }}>
          <div style={{ padding: '10px 14px 8px', borderBottom: `1px solid ${t.border.subtle}` }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: t.text.primary }}>{userEmail?.split('@')[0]}</div>
            <div style={{ fontSize: 10, color: t.text.muted }}>{userEmail}</div>
          </div>
          {[
            { icon: User,     label: 'Profil',      href: '/dashboard/settings' },
            { icon: Settings, label: 'Ustawienia',  href: '/dashboard/settings' },
          ].map(item => (
            <button key={item.label} onClick={() => { router.push(item.href); setOpen(false) }} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
              color: t.text.secondary, fontSize: 12, transition: 'background 100ms',
            }}
              onMouseEnter={e => e.currentTarget.style.background = t.bg.overlay}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <item.icon style={{ width: 13, height: 13 }} />
              {item.label}
            </button>
          ))}
          <div style={{ borderTop: `1px solid ${t.border.subtle}`, margin: '4px 0' }} />
          <button onClick={handleLogout} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer',
            color: '#f87171', fontSize: 12, textAlign: 'left', transition: 'background 100ms',
          }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(248,113,113,0.08)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <LogOut style={{ width: 13, height: 13 }} />
            Wyloguj
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Search trigger ───────────────────────────────────────────────────────────

function SearchTrigger() {
  function open() {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))
  }

  return (
    <button onClick={open} style={{
      display: 'flex', alignItems: 'center', gap: 8,
      width: 260, padding: '6px 10px',
      background: t.bg.muted, border: `1px solid ${t.border.default}`,
      borderRadius: 8, cursor: 'text', transition: 'all 150ms',
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = t.border.hover; e.currentTarget.style.background = t.bg.input }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = t.border.default; e.currentTarget.style.background = t.bg.muted }}
    >
      <Search style={{ width: 13, height: 13, color: t.text.muted, flexShrink: 0 }} />
      <span style={{ fontSize: 12, color: t.text.placeholder, flex: 1, textAlign: 'left' }}>Szukaj...</span>
      <kbd style={{
        display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0,
        fontSize: 10, color: t.text.muted,
        background: t.bg.muted, border: `1px solid ${t.border.subtle}`,
        borderRadius: 4, padding: '2px 5px',
      }}>
        <Command style={{ width: 9, height: 9 }} />K
      </kbd>
    </button>
  )
}

// ─── Breadcrumb ───────────────────────────────────────────────────────────────

function Breadcrumb({ section, title }: { section: string; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 12, color: t.text.muted }}>{section}</span>
      <ChevronRight style={{ width: 11, height: 11, color: t.text.muted, flexShrink: 0 }} />
      <span style={{ fontSize: 13, fontWeight: 600, color: t.text.primary }}>{title}</span>
    </div>
  )
}

// ─── TopBar ───────────────────────────────────────────────────────────────────

interface TopBarProps {
  userEmail?: string
}

export function TopBar({ userEmail }: TopBarProps) {
  const pathname = usePathname()
  const meta = getPageMeta(pathname)

  return (
    <header style={{
      height: 52,
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      padding: '0 28px',
      background: t.bg.topbar,
      borderBottom: `1px solid ${t.border.subtle}`,
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      position: 'sticky',
      top: 0,
      zIndex: 40,
    }}>
      {/* LEFT — breadcrumb */}
      <div style={{ flex: '0 0 auto', minWidth: 160 }}>
        <Breadcrumb section={meta.section} title={meta.title} />
      </div>

      {/* CENTER — search */}
      <div style={{ flex: '0 0 auto' }}>
        <SearchTrigger />
      </div>

      {/* RIGHT — weather, clock, bell, user */}
      <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 14, minWidth: 160, justifyContent: 'flex-end' }}>
        <Weather />
        <div style={{ width: 1, height: 16, background: t.border.subtle, flexShrink: 0 }} />
        <Clock />
        <div style={{ width: 1, height: 16, background: t.border.subtle, flexShrink: 0 }} />
        <NotificationBell />
        <UserMenu userEmail={userEmail} />
      </div>
    </header>
  )
}
