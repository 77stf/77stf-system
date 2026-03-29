import { t } from '@/lib/tokens'

export default function TasksLoading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header skeleton */}
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <div style={{ width: 100, height: 22, background: t.bg.card, borderRadius: t.radius.sm, marginBottom: 8 }} />
          <div style={{ width: 200, height: 14, background: t.bg.card, borderRadius: t.radius.sm }} />
        </div>
        <div style={{ width: 130, height: 36, background: t.bg.card, borderRadius: t.radius.sm }} />
      </div>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ height: 70, background: t.bg.card, border: `1px solid ${t.border.subtle}`, borderRadius: t.radius.md }} />
        ))}
      </div>
      {/* Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{ height: 54, background: t.bg.card, border: `1px solid ${t.border.subtle}`, borderRadius: t.radius.sm }} />
        ))}
      </div>
    </div>
  )
}
