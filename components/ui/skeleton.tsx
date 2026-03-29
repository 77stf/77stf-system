import { t } from '@/lib/tokens'
import type { CSSProperties } from 'react'

interface SkeletonProps {
  width?: string | number
  height?: string | number
  borderRadius?: string | number
  style?: CSSProperties
}

/**
 * Shimmer skeleton block — used in loading.tsx files.
 * Animates via CSS keyframes defined once in globals.
 */
export function Skeleton({ width = '100%', height = 16, borderRadius = t.radius.md, style }: SkeletonProps) {
  return (
    <div
      className="sk-shimmer"
      style={{
        width, height, borderRadius,
        backgroundColor: 'rgba(255,255,255,0.06)',
        backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0) 100%)',
        backgroundSize: '200% 100%',
        animation: 'sk-shimmer 1.6s infinite',
        flexShrink: 0,
        ...style,
      }}
    />
  )
}

/** Injects shimmer keyframes once — include in a layout or page once */
export function SkeletonStyles() {
  return (
    <style>{`
      @keyframes sk-shimmer {
        0%   { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
    `}</style>
  )
}
