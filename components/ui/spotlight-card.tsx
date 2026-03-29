'use client'

import { useRef, useEffect } from 'react'
import type { MouseEvent, CSSProperties, ReactNode } from 'react'

interface SpotlightCardProps {
  children: ReactNode
  style?: CSSProperties
  className?: string
  spotlightColor?: string
}

/**
 * SpotlightCard — premium glass card with cursor-tracking light effect.
 * Performance: rect is cached via ResizeObserver, no getBoundingClientRect() in hot path.
 * Transform removed — scale() triggers layout, pure shadow/border is enough.
 */
export function SpotlightCard({
  children,
  style,
  className,
  spotlightColor = 'rgba(255,255,255,0.055)',
}: SpotlightCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const spotRef = useRef<HTMLDivElement>(null)
  const rectRef = useRef<DOMRect | null>(null)

  // Cache rect — update only on mount and resize (not on every mousemove)
  useEffect(() => {
    const card = cardRef.current
    if (!card) return
    const update = () => { rectRef.current = card.getBoundingClientRect() }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(card)
    return () => ro.disconnect()
  }, [])

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const spot = spotRef.current
    const rect = rectRef.current
    if (!spot || !rect) return
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    spot.style.background = `radial-gradient(260px circle at ${x}px ${y}px, ${spotlightColor}, transparent 70%)`
    spot.style.opacity = '1'
    if (cardRef.current) cardRef.current.style.borderColor = 'rgba(255,255,255,0.14)'
  }

  const handleMouseLeave = () => {
    if (spotRef.current) spotRef.current.style.opacity = '0'
    if (cardRef.current) cardRef.current.style.borderColor = ''
  }

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={className}
      style={{
        position: 'relative',
        overflow: 'hidden',
        transition: 'border-color 180ms ease, box-shadow 180ms ease',
        ...style,
      }}
    >
      <div
        ref={spotRef}
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0,
          transition: 'opacity 350ms ease',
          pointerEvents: 'none',
          zIndex: 0,
          borderRadius: 'inherit',
        }}
      />
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </div>
  )
}
