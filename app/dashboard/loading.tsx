import { Skeleton, SkeletonStyles } from '@/components/ui/skeleton'
import { t } from '@/lib/tokens'

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        backgroundColor: t.bg.card,
        border: `1px solid ${t.border.default}`,
        borderRadius: t.radius.lg,
        padding: '20px 22px',
        boxShadow: t.shadow.card,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export default function DashboardLoading() {
  return (
    <>
      <SkeletonStyles />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

        {/* Greeting */}
        <div style={{ paddingBottom: 4 }}>
          <Skeleton width={280} height={30} borderRadius={t.radius.md} style={{ marginBottom: 10 }} />
          <Skeleton width={200} height={14} borderRadius={t.radius.sm} />
        </div>

        {/* Stats cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {[0, 1, 2, 3].map((i) => (
            <Card key={i} style={{ borderTop: `3px solid ${t.border.default}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <Skeleton width={100} height={11} />
                <Skeleton width={30} height={30} borderRadius={t.radius.md} />
              </div>
              <Skeleton width="60%" height={32} style={{ marginBottom: 14 }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <Skeleton width={80} height={12} />
                <Skeleton width={68} height={28} borderRadius={t.radius.sm} />
              </div>
            </Card>
          ))}
        </div>

        {/* Charts row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
          <Card>
            <Skeleton width={180} height={11} style={{ marginBottom: 12 }} />
            <div style={{ display: 'flex', gap: 20, marginBottom: 20 }}>
              <Skeleton width={120} height={24} />
              <Skeleton width={100} height={24} />
            </div>
            <Skeleton width="100%" height={200} borderRadius={t.radius.md} />
          </Card>
          <Card style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <Skeleton width={80} height={11} />
              <Skeleton width={60} height={22} borderRadius={t.radius.full} />
            </div>
            {[0, 1, 2].map((i) => (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                  <Skeleton width={80} height={13} />
                  <Skeleton width={100} height={13} />
                </div>
                <Skeleton width="100%" height={5} borderRadius={t.radius.full} />
              </div>
            ))}
            <div style={{ height: 1, backgroundColor: t.border.default, margin: '4px 0' }} />
            <Skeleton width={100} height={10} />
            <Skeleton width={120} height={22} />
          </Card>
        </div>

        {/* Table */}
        <Card style={{ padding: 0 }}>
          <div style={{ padding: '10px 16px', borderBottom: `1px solid ${t.border.default}`, backgroundColor: t.bg.muted, display: 'flex', justifyContent: 'space-between' }}>
            <Skeleton width={260} height={32} borderRadius={t.radius.md} />
            <Skeleton width={130} height={32} borderRadius={t.radius.sm} />
          </div>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} style={{ padding: '14px 16px', display: 'flex', gap: 16, alignItems: 'center', borderBottom: i < 4 ? `1px solid ${t.border.subtle}` : 'none' }}>
              <Skeleton width={34} height={34} borderRadius={t.radius.md} style={{ flexShrink: 0 }} />
              <Skeleton width={140} height={14} />
              <Skeleton width={80} height={14} style={{ marginLeft: 20 }} />
              <Skeleton width={70} height={22} borderRadius={t.radius.full} style={{ marginLeft: 'auto' }} />
            </div>
          ))}
        </Card>
      </div>
    </>
  )
}
