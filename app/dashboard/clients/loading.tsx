import { Skeleton, SkeletonStyles } from '@/components/ui/skeleton'
import { t } from '@/lib/tokens'

export default function ClientsLoading() {
  return (
    <>
      <SkeletonStyles />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

      {/* Page header */}
      <div>
        <Skeleton width={120} height={22} style={{ marginBottom: 8 }} />
        <Skeleton width={280} height={14} />
      </div>

      {/* Toolbar: filter pills left, search right */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[80, 80, 90, 70, 100].map((w, i) => (
            <Skeleton key={i} width={w} height={32} borderRadius={t.radius.full} />
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Skeleton width={260} height={40} borderRadius={t.radius.md} />
          <Skeleton width={80} height={14} />
        </div>
      </div>

      {/* Grid of client cards — 3 columns */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16,
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            style={{
              borderRadius: t.radius.md,
              backgroundColor: t.bg.card,
              border: `1px solid ${t.border.subtle}`,
              overflow: 'hidden',
              boxShadow: t.shadow.card,
            }}
          >
            {/* Card top */}
            <div style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                <Skeleton width={48} height={48} borderRadius={t.radius.md} style={{ flexShrink: 0 }} />
                <Skeleton width={70} height={24} borderRadius={t.radius.full} />
              </div>
              <Skeleton width="70%" height={16} style={{ marginBottom: 6 }} />
              <Skeleton width="50%" height={13} />
            </div>

            {/* Divider */}
            <div style={{ height: 1, backgroundColor: t.border.subtle }} />

            {/* Card bottom */}
            <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <Skeleton width={60} height={14} />
              <Skeleton width={80} height={14} />
              <Skeleton width={50} height={14} style={{ marginLeft: 'auto' }} />
            </div>
          </div>
        ))}
      </div>
      </div>
    </>
  )
}
