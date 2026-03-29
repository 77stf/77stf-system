'use client'

import { usePathname } from 'next/navigation'
import { Search, Bell, Command } from 'lucide-react'
import { t } from '@/lib/tokens'

function openCommandPalette() {
  window.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true })
  )
}

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':           'Dashboard',
  '/dashboard/clients':   'Klienci',
  '/dashboard/quotes':    'Wyceny',
  '/dashboard/tasks':     'Zadania',
  '/dashboard/audits':    'Audyty',
  '/dashboard/projects':  'Projekty',
  '/dashboard/documents': 'Dokumenty',
  '/dashboard/guardian':  'Guardian',
  '/dashboard/settings':  'Ustawienia',
}

interface TopBarProps {
  userEmail?: string
}

export function TopBar({ userEmail }: TopBarProps) {
  const pathname = usePathname()

  const title =
    PAGE_TITLES[pathname] ??
    Object.entries(PAGE_TITLES).find(
      ([key]) => pathname.startsWith(key) && key !== '/dashboard'
    )?.[1] ??
    'Dashboard'

  // Derive avatar initials from email — fallback to "77"
  const initials = userEmail
    ? userEmail[0].toUpperCase()
    : '77'

  return (
    <header
      style={{
        height: 56,
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        gap: 16,
        padding: '0 40px',
        backgroundColor: '#0A0A0D',
        borderBottom: `1px solid ${t.border.subtle}`,
        position: 'sticky',
        top: 0,
        zIndex: 30,
      }}
    >
      {/* LEFT — page title */}
      <span
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: t.text.muted,
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </span>

      {/* CENTER — search trigger, always visually centered */}
      <button
        onClick={openCommandPalette}
        style={{
          position: 'relative',
          width: 280,
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'text',
          textAlign: 'left',
        }}
      >
        <Search
          style={{
            position: 'absolute',
            left: 11,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 13,
            height: 13,
            color: t.text.muted,
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            width: '100%',
            padding: '6px 68px 6px 30px',
            borderRadius: t.radius.sm,
            fontSize: 13,
            backgroundColor: t.bg.muted,
            border: `1px solid ${t.border.default}`,
            color: t.text.placeholder,
            letterSpacing: '-0.01em',
            lineHeight: '20px',
          }}
        >
          Szukaj...
        </div>
        <div
          style={{
            position: 'absolute',
            right: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            pointerEvents: 'none',
          }}
        >
          <kbd
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              fontSize: 10,
              color: t.text.muted,
              backgroundColor: t.bg.muted,
              border: `1px solid ${t.border.default}`,
              borderRadius: t.radius.xs,
              padding: '2px 5px',
            }}
          >
            <Command style={{ width: 9, height: 9 }} />K
          </kbd>
        </div>
      </button>

      {/* RIGHT — notifications + avatar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {/* Bell */}
        <button
          style={{
            width: 32,
            height: 32,
            borderRadius: t.radius.sm,
            backgroundColor: 'transparent',
            border: `1px solid ${t.border.default}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 150ms',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = t.bg.overlay
            e.currentTarget.style.borderColor = t.border.hover
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
            e.currentTarget.style.borderColor = t.border.default
          }}
        >
          <Bell style={{ width: 14, height: 14, color: t.text.muted }} />
        </button>

        <div style={{ width: 1, height: 18, backgroundColor: t.border.default }} />

        {/* User avatar */}
        <div
          title={userEmail}
          style={{
            width: 28,
            height: 28,
            borderRadius: t.radius.full,
            backgroundColor: t.bg.overlay,
            border: `1px solid ${t.border.hover}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 600,
            color: t.text.secondary,
            letterSpacing: '0.02em',
            cursor: 'default',
            userSelect: 'none',
            flexShrink: 0,
          }}
        >
          {initials}
        </div>
      </div>
    </header>
  )
}
