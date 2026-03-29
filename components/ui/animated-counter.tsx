'use client'

import { useEffect, useRef } from 'react'
import { animate } from 'framer-motion'

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

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const controls = animate(0, value, {
      duration,
      ease: [0.25, 0.46, 0.45, 0.94],
      onUpdate: (v) => {
        el.textContent = formatter(v)
      },
    })
    return () => controls.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <span ref={ref} style={style} className={className}>
      {formatter(0)}
    </span>
  )
}
