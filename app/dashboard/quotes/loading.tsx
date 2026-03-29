import { Skeleton, SkeletonStyles } from '@/components/ui/skeleton'
import { t } from '@/lib/tokens'

export default function QuotesLoading() {
  return (
    <>
      <SkeletonStyles />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

        {/* Page header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <Skeleton width={100} height={22} style={{ marginBottom: 8 }} />
            <Skeleton width={240} height={14} />
          </div>
          <Skeleton width={140} height={38} borderRadius={t.radius.sm} />
        </div>

        {/* Stats row — 3 cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                borderRadius: t.radius.lg,
                padding: '20px 22px',
                backgroundColor: t.bg.card,
                border: `1px solid ${t.border.default}`,
                boxShadow: t.shadow.card,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Skeleton width={100} height={10} />
                <Skeleton width={16} height={16} borderRadius={t.radius.xs} />
              </div>
              <Skeleton width="50%" height={32} style={{ marginBottom: 12 }} />
              <Skeleton width="70%" height={11} />
            </div>
          ))}
        </div>

        {/* Table */}
        <div
          style={{
            borderRadius: t.radius.lg,
            backgroundColor: t.bg.card,
            border: `1px solid ${t.border.default}`,
            boxShadow: t.shadow.card,
            overflow: 'hidden',
          }}
        >
          {/* Table header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 100px 140px 140px 80px',
              gap: 12,
              padding: '10px 20px',
              backgroundColor: t.bg.muted,
              borderBottom: `1px solid ${t.border.default}`,
            }}
          >
            {[120, 80, 60, 80, 80, 40].map((w, i) => (
              <Skeleton key={i} width={w} height={10} />
            ))}
          </div>

          {/* Skeleton rows */}
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 100px 140px 140px 80px',
                gap: 12,
                padding: '14px 20px',
                alignItems: 'center',
                borderBottom: i < 4 ? `1px solid ${t.border.subtle}` : 'none',
              }}
            >
              {/* Client + title */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <Skeleton width={120} height={13} />
                  <Skeleton width={60} height={18} borderRadius={t.radius.full} />
                </div>
                <Skeleton width="75%" height={11} />
              </div>

              {/* Status + date */}
              <div>
                <Skeleton width={88} height={22} borderRadius={t.radius.full} style={{ marginBottom: 5 }} />
                <Skeleton width={60} height={10} />
              </div>

              {/* Discount */}
              <Skeleton width={30} height={13} />

              {/* Setup fee */}
              <div>
                <Skeleton width={90} height={13} style={{ marginBottom: 4 }} />
                <Skeleton width={60} height={10} />
              </div>

              {/* Monthly */}
              <Skeleton width={90} height={13} />

              {/* Actions */}
              <div style={{ display: 'flex', gap: 4 }}>
                <Skeleton width={30} height={30} borderRadius={t.radius.xs} />
                <Skeleton width={30} height={30} borderRadius={t.radius.xs} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
