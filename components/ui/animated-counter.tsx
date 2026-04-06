'use client'

import { useEffect, useRef } from 'react'

interface AnimatedCounterProps {
  value: number
  formatter?: (v: number) => string
  duration?: number
  style?: React.CSSProperties
  className?: string
}

export function AnimatedCounter({
  value,
  formatter = (v) => String(Math.round(v)),
  duration = 1.4,
  style,
  className,
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const startRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const startVal = 0
    const endVal = value
    const durationMs = duration * 1000

    startRef.current = null

    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now
      const elapsed = now - startRef.current
      const progress = Math.min(elapsed / durationMs, 1)
      const current = startVal + (endVal - startVal) * easeOut(progress)
      el.textContent = formatter(current)
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <span ref={ref} style={style} className={className}>
      {formatter(0)}
    </span>
  )
}
