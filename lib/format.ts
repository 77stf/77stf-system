/**
 * Shared formatters — import from here, never redefine locally.
 * import { formatPLN, formatDate, formatDateFull, relativeTime, getInitials } from '@/lib/format'
 */

export const formatPLN = (value: number): string =>
  new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    maximumFractionDigits: 0,
  }).format(value)

export const formatDate = (iso: string): string =>
  new Intl.DateTimeFormat('pl-PL', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(iso))

export const formatDateFull = (iso: string): string =>
  new Intl.DateTimeFormat('pl-PL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso))

export const relativeTime = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) return `${minutes} min. temu`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} godz. temu`
  return `${Math.floor(hours / 24)} dni temu`
}

export const getInitials = (name: string): string =>
  name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
