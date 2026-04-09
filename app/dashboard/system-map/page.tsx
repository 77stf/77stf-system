import { createSupabaseServerClient } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import { SystemMap } from './system-map'

export const metadata = { title: 'System Map — 77STF' }

export default async function SystemMapPage() {
  const auth = await createSupabaseServerClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) notFound()

  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'rgba(242,242,244,0.95)', margin: 0 }}>
            System Architecture
          </h1>
          <span style={{ fontSize: 11, color: 'rgba(242,242,244,0.3)', fontFamily: 'monospace' }}>77STF v2.0</span>
        </div>
        <p style={{ fontSize: 13, color: 'rgba(242,242,244,0.38)', margin: 0 }}>
          Pełna mapa systemu — integracje, agenty AI, n8n workflows, API, strony, bazy danych i tech stack.
        </p>
      </div>
      <SystemMap />
    </div>
  )
}
