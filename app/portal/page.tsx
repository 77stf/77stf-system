import { redirect } from 'next/navigation'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase'
import { t } from '@/lib/tokens'

// /portal — redirect logged-in client to their portal
// Admin sees a list of all clients with portal links
export default async function PortalHomePage() {
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()

  if (!user) redirect('/login?next=/portal')

  const supabase = createSupabaseAdminClient()

  // Check if this user is mapped to a client (client login via Magic Link)
  const { data: contact } = await supabase
    .from('client_contacts')
    .select('client_id')
    .eq('user_id', user.id)
    .single()

  if (contact?.client_id) {
    redirect(`/portal/${contact.client_id}`)
  }

  // No client mapping — check if this is admin (has dashboard access)
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, status, industry, owner_name')
    .in('status', ['active', 'partner'])
    .order('name')

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: t.text.primary }}>
          Portal Klientów
        </h1>
        <p style={{ marginTop: 8, color: t.text.muted, fontSize: 14 }}>
          Wybierz klienta aby zobaczyć jego portal
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 16,
      }}>
        {(clients ?? []).map(client => (
          <a
            key={client.id}
            href={`/portal/${client.id}`}
            style={{
              display: 'block',
              padding: '20px 24px',
              background: t.bg.card,
              border: `1px solid ${t.border.default}`,
              borderRadius: t.radius.md,
              textDecoration: 'none',
              transition: 'all 0.15s',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: t.text.primary }}>{client.name}</div>
                <div style={{ fontSize: 13, color: t.text.muted, marginTop: 4 }}>
                  {client.industry ?? '—'} · {client.owner_name ?? '—'}
                </div>
              </div>
              <span style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '3px 8px',
                borderRadius: t.radius.full,
                ...(client.status === 'partner' ? t.statusBadge.partner : t.statusBadge.active),
              }}>
                {client.status === 'partner' ? 'Partner' : 'Aktywny'}
              </span>
            </div>
          </a>
        ))}
      </div>

      {(!clients || clients.length === 0) && (
        <p style={{ color: t.text.muted, fontSize: 14, textAlign: 'center', paddingTop: 48 }}>
          Brak aktywnych klientów z portalem.
        </p>
      )}
    </div>
  )
}
