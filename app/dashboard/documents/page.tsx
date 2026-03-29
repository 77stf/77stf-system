import { FileText } from 'lucide-react'
import { t } from '@/lib/tokens'

export default function DocumentsPage() {
  return (
    <div style={{ padding: '32px 28px', maxWidth: 700 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: t.text.primary, margin: '0 0 8px' }}>
        Dokumenty
      </h1>
      <p style={{ fontSize: 13, color: t.text.muted, margin: '0 0 32px' }}>
        Oferty, umowy i raporty generowane automatycznie
      </p>
      <div style={{
        background: t.bg.card,
        border: `1px solid ${t.border.default}`,
        borderRadius: t.radius.md,
        padding: '60px 24px',
        textAlign: 'center',
      }}>
        <FileText style={{ width: 36, height: 36, color: t.text.muted, margin: '0 auto 14px' }} />
        <div style={{ fontSize: 14, fontWeight: 600, color: t.text.secondary, marginBottom: 6 }}>
          W budowie — Etap 6
        </div>
        <div style={{ fontSize: 13, color: t.text.muted }}>
          Generator ofert PDF, szablony umów i archiwum dokumentów.
        </div>
      </div>
    </div>
  )
}
