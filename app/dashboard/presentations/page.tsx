import { createSupabaseServerClient } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import { t } from '@/lib/tokens'
import { Presentation } from 'lucide-react'
import { PresentationsGrid } from './presentations-grid'

export default async function PresentationsPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: presentations } = await supabase
    .from('presentations')
    .select('*, clients(id, name, industry)')
    .order('updated_at', { ascending: false })

  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, industry')
    .order('name')

  return (
    <div style={{ padding: '28px 32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: 'rgba(255,255,255,0.06)',
          border: `1px solid ${t.border.default}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Presentation size={18} style={{ color: t.text.muted }} />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: t.text.primary, margin: 0, letterSpacing: '-0.02em' }}>
            Prezentacje
          </h1>
          <p style={{ fontSize: 13, color: t.text.muted, margin: 0 }}>
            Demo per klient — AI generuje slajdy, śledzisz co pokazano
          </p>
        </div>
      </div>

      <PresentationsGrid
        initialPresentations={(presentations ?? []) as Parameters<typeof PresentationsGrid>[0]['initialPresentations']}
        clients={(clients ?? []) as { id: string; name: string; industry?: string }[]}
      />
    </div>
  )
}
