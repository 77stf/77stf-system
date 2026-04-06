import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import { AuditWizard } from './audit-wizard'
import type { Audit } from '@/lib/types'

interface PageProps { params: Promise<{ id: string }> }

export default async function AuditPage({ params }: PageProps) {
  const { id } = await params

  // Auth check — supabase.auth.getUser() also refreshes the session cookie
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) notFound()

  // Admin client used intentionally: audits + clients tables require service_role
  // for cross-user access in this internal-only dashboard
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
