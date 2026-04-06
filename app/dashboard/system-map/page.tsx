import { createSupabaseServerClient } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import { SystemMap } from './system-map'

export const metadata = { title: 'System Map — 77STF' }

export default async function SystemMapPage() {
  const auth = await createSupabaseServerClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) notFound()

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'rgba(242,242,244,0.95)', margin: '0 0 4px' }}>
          System Architecture Map
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(242,242,244,0.4)', margin: 0 }}>
          Pełna mapa 77STF — integracje, agenty, API, strony, bazy danych. Kliknij węzeł po szczegóły.
        </p>
      </div>
      <SystemMap />
    </div>
  )
}
