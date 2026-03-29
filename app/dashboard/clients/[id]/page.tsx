import { createSupabaseServerClient } from '@/lib/supabase'
import { Client, Project, Automation, Meeting, Document } from '@/lib/types'
import { ClientDetail } from './client-detail'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ClientPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()

  const [
    { data: client },
    { data: projects },
    { data: automations },
    { data: meetings },
    { data: documents },
  ] = await Promise.all([
    supabase.from('clients').select('*').eq('id', id).single(),
    supabase
      .from('projects')
      .select('*')
      .eq('client_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('automations')
      .select('*')
      .eq('client_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('meetings')
      .select('id, date, summary_ai, decisions')
      .eq('client_id', id)
      .order('date', { ascending: false })
      .limit(5),
    supabase
      .from('documents')
      .select('id, type, status, created_at, sent_at')
      .eq('client_id', id)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  if (!client) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          gap: 16,
        }}
      >
        <p style={{ fontSize: 18, fontWeight: 600, color: 'rgba(240,244,255,0.5)' }}>
          Klient nie istnieje
        </p>
        <a
          href="/dashboard/clients"
          style={{ fontSize: 14, color: '#C49A2E', textDecoration: 'none' }}
        >
          ← Wróć do listy klientów
        </a>
      </div>
    )
  }

  return (
    <ClientDetail
      client={client as Client}
      projects={(projects ?? []) as Project[]}
      automations={(automations ?? []) as Automation[]}
      meetings={
        (meetings ?? []) as Pick<Meeting, 'id' | 'date' | 'summary_ai' | 'decisions'>[]
      }
      documents={
        (documents ?? []) as Pick<Document, 'id' | 'type' | 'status' | 'created_at' | 'sent_at'>[]
      }
    />
  )
}
