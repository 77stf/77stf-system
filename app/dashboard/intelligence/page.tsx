import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import { IntelligenceHub } from './intelligence-hub'
import type { StackItem, Client } from '@/lib/types'

export default async function IntelligencePage() {
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) notFound()

  const supabase = createSupabaseAdminClient()

  const [{ data: items }, { data: clients }] = await Promise.all([
    supabase.from('stack_items').select('*').order('created_at', { ascending: true }),
    supabase.from('clients').select('id, name, status, industry').order('name'),
  ])

  return (
    <IntelligenceHub
      initialItems={(items ?? []) as StackItem[]}
      clients={(clients ?? []) as Pick<Client, 'id' | 'name' | 'status' | 'industry'>[]}
    />
  )
}
