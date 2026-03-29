import { Skeleton, SkeletonStyles } from '@/components/ui/skeleton'
import { t } from '@/lib/tokens'

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: t.bg.card, border: `1px solid ${t.border.default}`, borderRadius: t.radius.lg, padding: '20px 22px', boxShadow: t.shadow.card }}>
      {children}
    </div>
  )
}

export default function ClientDetailLoading() {
  return (
    <>
      <SkeletonStyles />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

        {/* Back */}
        <Skeleton width={80} height={16} borderRadius={t.radius.sm} />

        {/* Hero card */}
        <div style={{ backgroundColor: t.bg.card, border: `1px solid ${t.border.default}`, borderTop: `3px solid ${t.brand.gold}`, borderRadius: t.radius.lg, padding: '26px 30px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <Skeleton width={56} height={56} borderRadius={t.radius.lg} style={{ flexShrink: 0 }} />
            <div>
              <Skeleton width={200} height={22} style={{ marginBottom: 8 }} />
              <Skeleton width={120} height={13} style={{ marginBottom: 4 }} />
              <Skeleton width={160} height={12} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Skeleton width={80} height={32} borderRadius={t.radius.full} />
            <Skeleton width={120} height={34} borderRadius={t.radius.md} />
            <Skeleton width={120} height={34} borderRadius={t.radius.md} />
          </div>
        </div>

        {/* 2-col */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>
          {/* Left */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
              <Skeleton width={80} height={11} style={{ marginBottom: 14 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[0, 1].map((i) => (
                  <Card key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <Skeleton width={150} height={14} />
                      <Skeleton width={80} height={16} />
                    </div>
                    <Skeleton width={80} height={22} borderRadius={t.radius.full} style={{ marginBottom: 10 }} />
                    <div style={{ display: 'flex', gap: 3 }}>
                      {[0, 1, 2, 3, 4].map((j) => <Skeleton key={j} height={4} style={{ flex: 1 }} borderRadius={20} />)}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
            <div>
              <Skeleton width={100} height={11} style={{ marginBottom: 14 }} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                {[0, 1, 2].map((i) => (
                  <Card key={i}>
                    <Skeleton width={130} height={14} style={{ marginBottom: 10 }} />
                    <Skeleton width={80} height={13} style={{ marginBottom: 4 }} />
                    <Skeleton width={100} height={12} />
                  </Card>
                ))}
              </div>
            </div>
          </div>

          {/* Right */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[0, 1, 2].map((i) => (
              <Card key={i}>
                <Skeleton width={70} height={11} style={{ marginBottom: 14 }} />
                <Skeleton width="80%" height={15} style={{ marginBottom: 8 }} />
                <Skeleton width="60%" height={13} style={{ marginBottom: 6 }} />
                <Skeleton width="70%" height={13} />
              </Card>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
