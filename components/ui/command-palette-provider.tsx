'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

// Dynamic import — CommandPalette is heavy (Framer + fetch logic).
// Loaded only when first opened (ssr: false because it reads window events).
const CommandPalette = dynamic(
  () => import('./command-palette').then((m) => m.CommandPalette),
  { ssr: false }
)

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  // Avoid loading the palette chunk until the user has pressed ⌘K once
  const [everOpened, setEverOpened] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setEverOpened(true)
        setOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <>
      {children}
      {everOpened && (
        <CommandPalette open={open} onClose={() => setOpen(false)} />
      )}
    </>
  )
}
