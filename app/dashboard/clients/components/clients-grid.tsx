'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Users, FolderKanban, DollarSign, Plus } from 'lucide-react'
import { Client, ClientStatus } from '@/lib/types'
import { t } from '@/lib/tokens'
import { getInitials, formatPLN } from '@/lib/format'
import { AddClientModal } from './add-client-modal'

interface ProjectStats {
  projectCount: number
  totalValue: number
  paidValue: number
  hasActive: boolean
}

interface ClientsGridProps {
  clients: Client[]
  projectStats: Record<string, ProjectStats>
}

const STATUS_LABELS: Record<ClientStatus, string> = {
  lead: 'Lead',
  active: 'Aktywny',
  partner: 'Partner',
  closed: 'Zamknięty',
}

const FILTER_TABS = [
  { value: 'wszystkie', label: 'Wszystkie' },
  { value: 'active', label: 'Aktywni' },
  { value: 'partner', label: 'Partnerzy' },
  { value: 'lead', label: 'Leady' },
  { value: 'closed', label: 'Zamknięci' },
] as const

type FilterValue = (typeof FILTER_TABS)[number]['value']

export function ClientsGrid({ clients, projectStats }: ClientsGridProps) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterValue>('wszystkie')
  const [modalOpen, setModalOpen] = useState(false)
  const router = useRouter()

  const handleAddSuccess = () => {
    router.refresh()
  }

  const filtered = useMemo(() => {
    return clients.filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.industry ?? '').toLowerCase().includes(search.toLowerCase())
      const matchesFilter = filter === 'wszystkie' || c.status === filter
      return matchesSearch && matchesFilter
    })
  }, [clients, search, filter])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <style>{`.client-card:hover { background-color: ${t.bg.cardHover} !important; transform: translateY(-2px); border-color: ${t.border.hover} !important; }`}</style>
      {/* Toolbar: filter pills left, search + count right */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        {/* Filter pills */}
        <div style={{ display: 'flex', gap: 6 }}>
          {FILTER_TABS.map((tab) => {
            const isActive = filter === tab.value
            return (
              <button
                key={tab.value}
                onClick={() => setFilter(tab.value)}
                style={{
                  padding: '5px 14px',
                  borderRadius: t.radius.full,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: '1px solid',
                  transition: 'all 150ms',
                  borderColor: isActive ? t.border.hover : t.border.default,
                  backgroundColor: isActive ? t.bg.overlay : 'transparent',
                  color: isActive ? t.text.primary : t.text.secondary,
                }}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Search + count */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ position: 'relative', width: 260 }}>
            <Search
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 16,
                height: 16,
                color: t.text.placeholder,
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Szukaj klienta..."
              style={{
                width: '100%',
                paddingLeft: 40,
                paddingRight: 16,
                paddingTop: 10,
                paddingBottom: 10,
                backgroundColor: t.bg.input,
                border: `1px solid ${t.border.default}`,
                borderRadius: t.radius.md,
                fontSize: 14,
                color: t.text.primary,
                outline: 'none',
              }}
            />
          </div>
          <span style={{ fontSize: 13, color: t.text.muted, whiteSpace: 'nowrap' }}>
            {filtered.length} klientów
          </span>
          <button
            onClick={() => setModalOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              borderRadius: t.radius.sm,
              border: `1px solid ${t.brand.gold}`,
              backgroundColor: t.brand.gold,
              color: t.text.inverted,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: t.shadow.btn,
            }}
          >
            <Plus style={{ width: 15, height: 15 }} />
            Dodaj klienta
          </button>
        </div>
      </div>

      {/* Add client modal */}
      <AddClientModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={handleAddSuccess}
      />

      {/* Grid */}
      {filtered.length === 0 ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '80px 0',
            gap: 12,
          }}
        >
          <Users style={{ width: 48, height: 48, color: t.text.placeholder }} />
          <span style={{ fontSize: 16, color: t.text.primary, fontWeight: 600 }}>Brak klientów</span>
          <span style={{ fontSize: 14, color: t.text.muted }}>
            Zmień filtry lub dodaj pierwszego klienta
          </span>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 16,
          }}
        >
          {filtered.map((client, index) => {
            const stats = projectStats[client.id] ?? {
              projectCount: 0,
              totalValue: 0,
              paidValue: 0,
              hasActive: false,
            }
            const isClosed = client.status === 'closed'

            return (
              <div
                key={client.id}
                className="client-card"
                onClick={() => router.push(`/dashboard/clients/${client.id}`)}
                style={{
                  borderRadius: t.radius.md,
                  backgroundColor: t.bg.card,
                  border: `1px solid ${t.border.subtle}`,
                  cursor: 'pointer',
                  opacity: isClosed ? 0.5 : 1,
                  boxShadow: t.shadow.card,
                  transition: 'background-color 150ms, border-color 150ms, transform 150ms',
                  overflow: 'hidden',
                  animation: `cardEnter 0.3s ease-out ${index * 0.04}s both`,
                }}
              >
                {/* Top section */}
                <div style={{ padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    {/* Avatar */}
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: t.radius.md,
                        backgroundColor: t.bg.muted,
                        border: `1px solid ${t.border.default}`,
                        color: t.text.secondary,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 15,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {getInitials(client.name)}
                    </div>

                    {/* Status badge */}
                    <span
                      style={{
                        ...t.statusBadge[client.status],
                        display: 'inline-block',
                        padding: '3px 10px',
                        borderRadius: t.radius.full,
                        fontSize: 12,
                        fontWeight: 500,
                      }}
                    >
                      {STATUS_LABELS[client.status]}
                    </span>
                  </div>

                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: t.text.primary }}>
                      {client.name}
                    </div>
                    {client.industry && (
                      <div style={{ fontSize: 13, color: t.text.muted, marginTop: 4 }}>
                        {client.industry}
                      </div>
                    )}
                  </div>
                </div>

                {/* Divider */}
                <div style={{ height: 1, backgroundColor: t.border.subtle }} />

                {/* Bottom section */}
                <div
                  style={{
                    padding: '14px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                  }}
                >
                  {/* Projekty */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <FolderKanban style={{ width: 14, height: 14, color: t.text.muted }} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: t.text.primary }}>
                      {stats.projectCount}
                    </span>
                    <span style={{ fontSize: 12, color: t.text.muted }}>proj.</span>
                  </div>

                  {/* Wartość */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <DollarSign style={{ width: 14, height: 14, color: t.text.muted }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: t.text.primary }}>
                      {formatPLN(stats.totalValue)}
                    </span>
                  </div>

                  {/* Status aktywny */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 'auto' }}>
                    <div
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        backgroundColor: stats.hasActive ? t.semantic.success : t.border.default,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: 12, color: t.text.muted }}>
                      {stats.hasActive ? 'W toku' : 'Brak'}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
