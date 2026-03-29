'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Search, ArrowRight } from 'lucide-react'
import { Client, ClientStatus } from '@/lib/types'
import { t } from '@/lib/tokens'
import { formatDate, getInitials } from '@/lib/format'

interface ClientsTableProps {
  clients: Client[]
}

const STATUS_LABELS: Record<ClientStatus, string> = {
  lead: 'Lead', active: 'Aktywny', partner: 'Partner', closed: 'Zamknięty',
}

const TABS = [
  { value: 'wszystkie', label: 'Wszystkie' },
  { value: 'active',    label: 'Aktywni' },
  { value: 'partner',   label: 'Partnerzy' },
  { value: 'lead',      label: 'Leady' },
] as const

type TabValue = (typeof TABS)[number]['value']

// Avatar initials — using subtle tints on gray bg
const AVATAR_COLORS = [
  { bg: 'rgba(255,255,255,0.09)', border: 'rgba(255,255,255,0.14)', text: 'rgba(242,242,244,0.75)' },
  { bg: 'rgba(196,154,46,0.14)',  border: 'rgba(196,154,46,0.28)',  text: '#C9A84C' },
  { bg: 'rgba(74,222,128,0.10)',  border: 'rgba(74,222,128,0.22)',  text: '#4ade80' },
  { bg: 'rgba(248,113,113,0.10)', border: 'rgba(248,113,113,0.22)', text: '#f87171' },
  { bg: 'rgba(251,191,36,0.10)',  border: 'rgba(251,191,36,0.22)',  text: '#fbbf24' },
]

export function ClientsTable({ clients }: ClientsTableProps) {
  const [activeTab, setActiveTab] = useState<TabValue>('wszystkie')
  const [search, setSearch] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const router = useRouter()

  const filtered = useMemo(() => {
    let list = activeTab === 'wszystkie' ? clients : clients.filter((c) => c.status === activeTab)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.industry?.toLowerCase().includes(q) ||
          c.owner_name?.toLowerCase().includes(q)
      )
    }
    return list
  }, [clients, activeTab, search])

  const tabCount = (val: TabValue) =>
    val === 'wszystkie' ? clients.length : clients.filter((c) => c.status === val).length

  return (
    <div
      style={{
        backgroundColor: t.bg.card,
        border: `1px solid ${t.border.default}`,
        borderRadius: t.radius.lg,
        overflow: 'hidden',
        boxShadow: t.shadow.card,
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px',
          borderBottom: `1px solid ${t.border.default}`,
          gap: 12,
          backgroundColor: t.bg.muted,
        }}
      >
        {/* Tabs */}
        <div
          style={{
            display: 'flex', gap: 2,
            backgroundColor: t.bg.muted,
            borderRadius: t.radius.md,
            padding: 4,
            border: `1px solid ${t.border.default}`,
          }}
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.value
            const count = tabCount(tab.value)
            return (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '6px 14px', borderRadius: t.radius.sm,
                  fontSize: 13, fontWeight: isActive ? 500 : 400,
                  cursor: 'pointer', border: 'none',
                  transition: 'all 150ms',
                  background: isActive ? 'rgba(255,255,255,0.10)' : 'transparent',
                  color: isActive ? t.text.primary : t.text.secondary,
                }}
              >
                {tab.label}
                <span
                  style={{
                    fontSize: 11, fontWeight: 600,
                    backgroundColor: isActive ? 'rgba(255,255,255,0.18)' : t.border.default,
                    color: isActive ? t.text.primary : t.text.muted,
                    padding: '0 6px', borderRadius: 10,
                    minWidth: 18, textAlign: 'center',
                  }}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Search */}
        <div style={{ position: 'relative', flexShrink: 0, width: 240 }}>
          <Search
            style={{
              position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
              width: 13, height: 13,
              color: searchFocused ? t.text.secondary : t.text.muted,
              pointerEvents: 'none', transition: 'color 150ms',
            }}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Szukaj..."
            style={{
              width: '100%',
              padding: '7px 10px 7px 28px',
              borderRadius: t.radius.sm,
              fontSize: 13,
              backgroundColor: searchFocused ? t.bg.input : t.bg.muted,
              border: `1px solid ${searchFocused ? t.border.hover : t.border.default}`,
              color: t.text.primary,
              outline: 'none',
              letterSpacing: '-0.01em',
              transition: 'all 150ms',
            }}
          />
        </div>
      </div>

      {/* Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: t.bg.muted }}>
            {['Firma', 'Branża', 'Status', 'Kontakt', 'Dodany', ''].map((col) => (
              <th
                key={col}
                style={{
                  padding: '10px 16px', textAlign: 'left',
                  fontSize: 10, fontWeight: 500, textTransform: 'uppercase',
                  letterSpacing: '0.14em', color: t.text.muted,
                  borderBottom: `1px solid ${t.border.default}`, whiteSpace: 'nowrap',
                }}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={6} style={{ padding: '52px 16px', textAlign: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 46, height: 46, borderRadius: t.radius.lg,
                      backgroundColor: t.bg.muted, border: `1px solid ${t.border.default}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Users style={{ width: 20, height: 20, color: t.text.muted }} />
                  </div>
                  <span style={{ fontSize: 14, color: t.text.muted, fontWeight: 400 }}>
                    {search ? 'Brak wyników' : 'Brak klientów'}
                  </span>
                  {!search && (
                    <button style={{ fontSize: 13, color: t.text.secondary, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
                      Dodaj pierwszego klienta →
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ) : (
            filtered.map((client, idx) => {
              const av = AVATAR_COLORS[idx % AVATAR_COLORS.length]
              return (
                <tr
                  key={client.id}
                  onClick={() => router.push(`/dashboard/clients/${client.id}`)}
                  style={{
                    borderBottom: idx < filtered.length - 1 ? `1px solid ${t.border.subtle}` : 'none',
                    cursor: 'pointer',
                    transition: 'background-color 120ms',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = t.bg.overlay }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
                >
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                      <div
                        style={{
                          width: 34, height: 34, borderRadius: t.radius.md,
                          backgroundColor: av.bg,
                          border: `1px solid ${av.border}`,
                          color: av.text,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 600, flexShrink: 0,
                        }}
                      >
                        {getInitials(client.name)}
                      </div>
                      <span style={{ fontWeight: 500, color: t.text.primary, fontSize: 14 }}>
                        {client.name}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: 13, color: t.text.muted }}>
                    {client.industry ?? '—'}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span
                      style={{
                        ...t.statusBadge[client.status],
                        display: 'inline-block',
                        padding: '3px 10px',
                        borderRadius: t.radius.full,
                        fontSize: 12, fontWeight: 500,
                      }}
                    >
                      {STATUS_LABELS[client.status]}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: 13, color: t.text.secondary }}>
                    {client.owner_name ?? '—'}
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: 12, color: t.text.muted }}>
                    {formatDate(client.created_at)}
                  </td>
                  <td style={{ padding: '14px 16px', width: 36 }}>
                    <ArrowRight style={{ width: 14, height: 14, color: t.text.muted, opacity: 0.5 }} />
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
