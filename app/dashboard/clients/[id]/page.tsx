import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import { Client, Project, Automation, Meeting, Document, ClientNote } from '@/lib/types'
import { ClientDetail } from './client-detail'

interface PageProps { params: Promise<{ id: string }> }

export default async function ClientPage({ params }: PageProps) {
  const { id } = await params

  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) notFound()

  // Admin client for cross-user queries on this internal dashboard
  const supabase = createSupabaseAdminClient()

  const [
    { data: client },
    { data: projects },
    { data: automations },
    { data: meetings },
    { data: documents },
    { data: notes },
  ] = await Promise.all([
    supabase.from('clients').select('*').eq('id', id).single(),
    supabase.from('projects').select('*').eq('client_id', id).order('created_at', { ascending: false }),
    supabase.from('automations').select('*').eq('client_id', id).order('created_at', { ascending: false }),
    supabase.from('meetings').select('id, date, summary_ai, decisions').eq('client_id', id).order('date', { ascending: false }).limit(5),
    supabase.from('documents').select('id, type, status, created_at, sent_at').eq('client_id', id).order('created_at', { ascending: false }).limit(5),
    supabase.from('client_notes').select('*').eq('client_id', id).order('created_at', { ascending: false }).limit(50),
  ])

  if (!client) notFound()

  return (
    <ClientDetail
      client={client as Client}
      projects={(projects ?? []) as Project[]}
      automations={(automations ?? []) as Automation[]}
      meetings={(meetings ?? []) as Pick<Meeting, 'id' | 'date' | 'summary_ai' | 'decisions'>[]}
      documents={(documents ?? []) as Pick<Document, 'id' | 'type' | 'status' | 'created_at' | 'sent_at'>[]}
      initialNotes={(notes ?? []) as ClientNote[]}
    />
  )
}
