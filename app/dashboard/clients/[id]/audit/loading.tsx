import { t } from '@/lib/tokens'

export default function AuditLoading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{
          height: i === 1 ? 60 : 200,
          borderRadius: 12,
          background: `linear-gradient(90deg, ${t.bg.muted} 0%, ${t.bg.overlay} 50%, ${t.bg.muted} 100%)`,
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.5s ease-in-out infinite',
        }} />
      ))}
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
    </div>
  )
}
