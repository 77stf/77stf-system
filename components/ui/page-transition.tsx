import type { ReactNode } from 'react'

/**
 * PageTransition — pure CSS fade, no framer-motion.
 * framer-motion motion.div wrapping page content caused
 * "Router action dispatched before initialization" in Next.js 14 App Router.
 * CSS animation has zero router interaction.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <div className="page-fade">
      {children}
    </div>
  )
}
