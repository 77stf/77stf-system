import { createSupabaseServerClient } from '@/lib/supabase'
import { createSupabaseAdminClient } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import { AuditWizard } from './audit-wizard'
import type { Audit } from '@/lib/types'

interface PageProps { params: Promise<{ id: string }> }

export default async function AuditPage({ params }: PageProps) {
  const { id } = await params

  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) notFound()

  const supabase = createSupabaseAdminClient()

  const [{ data: client }, { data: audits }] = await Promise.all([
    supabase.from('clients').select('id, name, industry, status').eq('id', id).single(),
    supabase
      .from('audits')
      .select('*')
      .eq('client_id', id)
      .order('created_at', { ascending: false })
      .limit(1),
  ])

  if (!client) notFound()

  const latestAudit = (audits && audits.length > 0 ? audits[0] : null) as Audit | null

  return (
    <AuditWizard
      clientId={id}
      clientName={client.name}
      clientIndustry={client.industry}
      existingAudit={latestAudit}
    />
  )
}
