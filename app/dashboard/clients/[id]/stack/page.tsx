import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import { StackPanel } from './stack-panel'
import type { StackItem } from '@/lib/types'

interface PageProps { params: Promise<{ id: string }> }

export default async function StackPage({ params }: PageProps) {
  const { id } = await params

  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) notFound()

  const supabase = createSupabaseAdminClient()

  const [{ data: client }, { data: stackItems }] = await Promise.all([
    supabase.from('clients').select('id, name').eq('id', id).single(),
    supabase
      .from('stack_items')
      .select('*')
      .eq('client_id', id)
      .order('created_at', { ascending: true }),
  ])

  if (!client) notFound()

  return (
    <StackPanel
      clientId={id}
      clientName={client.name as string}
      initialItems={(stackItems ?? []) as StackItem[]}
    />
  )
}
