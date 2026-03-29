import { createSupabaseServerClient } from '@/lib/supabase'
import { Client } from '@/lib/types'
import { ClientsGrid } from './components/clients-grid'
import { t } from '@/lib/tokens'

interface ProjectStats {
  projectCount: number
  totalValue: number
  paidValue: number
  hasActive: boolean
}

export default async function ClientsPage() {
  const supabase = await createSupabaseServerClient()

  const [{ data: clients }, { data: projects }] = await Promise.all([
    supabase.from('clients').select('*').order('created_at', { ascending: false }),
    supabase.from('projects').select('client_id, value_netto, payment_status, status'),
  ])

  const projectStatsMap: Record<string, ProjectStats> = {}

  ;(projects ?? []).forEach((p) => {
    if (!projectStatsMap[p.client_id]) {
      projectStatsMap[p.client_id] = {
        projectCount: 0,
        totalValue: 0,
        paidValue: 0,
        hasActive: false,
      }
    }
    const entry = projectStatsMap[p.client_id]
    entry.projectCount++
    entry.totalValue += p.value_netto ?? 0
    if (p.payment_status === 'paid') entry.paidValue += p.value_netto ?? 0
    if (['kickoff', 'demo1', 'demo2', 'production'].includes(p.status)) {
      entry.hasActive = true
    }
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <div>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 600,
            color: t.text.primary,
            marginBottom: 4,
            margin: 0,
            letterSpacing: '-0.02em',
          }}
        >
          Klienci
        </h1>
        <p style={{ fontSize: 14, color: t.text.muted, margin: '6px 0 0' }}>
          Zarządzaj klientami i śledź postępy projektów
        </p>
      </div>

      <ClientsGrid
        clients={(clients ?? []) as Client[]}
        projectStats={projectStatsMap}
      />
    </div>
  )
}
