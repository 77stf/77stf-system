import type { Metadata } from 'next'
import { t } from '@/lib/tokens'

export const metadata: Metadata = {
  title: 'Portal Klienta — 77STF',
  description: 'Twój panel wdrożeń i projektów AI',
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: t.bg.page,
      color: t.text.primary,
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      {/* Top bar */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        height: 60,
        background: t.bg.topbar,
        borderBottom: `1px solid ${t.border.subtle}`,
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: t.brand.gold, letterSpacing: '-0.5px' }}>
            77STF
          </span>
          <span style={{ color: t.border.default, fontSize: 20 }}>|</span>
          <span style={{ fontSize: 13, color: t.text.secondary, fontWeight: 500 }}>
            Portal Klienta
          </span>
        </div>
        <a
          href="mailto:kontakt@77stf.pl"
          style={{
            fontSize: 12,
            color: t.text.muted,
            textDecoration: 'none',
            padding: '6px 12px',
            borderRadius: t.radius.sm,
            border: `1px solid ${t.border.subtle}`,
            transition: 'all 0.15s',
          }}
        >
          Kontakt
        </a>
      </header>

      <main style={{ padding: '32px 24px', maxWidth: 1100, margin: '0 auto' }}>
        {children}
      </main>
    </div>
  )
}
