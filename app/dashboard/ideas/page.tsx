import { createSupabaseServerClient } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import { t } from '@/lib/tokens'
import { Lightbulb } from 'lucide-react'
import { IdeasBoard } from './ideas-board'

export default async function IdeasPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: ideas } = await supabase
    .from('offline_ideas')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: 'rgba(196,154,46,0.1)',
          border: `1px solid rgba(196,154,46,0.2)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Lightbulb size={18} style={{ color: '#C49A2E' }} />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: t.text.primary, margin: 0, letterSpacing: '-0.02em' }}>
            Pomysły
          </h1>
          <p style={{ fontSize: 13, color: t.text.muted, margin: 0 }}>
            Rekomendacje agentów i Twoje pomysły do przeglądu
          </p>
        </div>
      </div>

      <IdeasBoard initialIdeas={ideas ?? []} />
    </div>
  )
}
