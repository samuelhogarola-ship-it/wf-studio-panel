import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDuration(minutes: number | string | null | undefined): string {
  const total = Math.round(Number(minutes ?? 0))
  if (total <= 0) return '0 min'
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} h`
  return `${h} h ${m} min`
}

// Backwards-compat alias
export const formatHours = formatDuration

export function formatDate(value: string | null | undefined) {
  if (!value) return 'Sin fecha'

  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

export function normalizeSearch(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? ''
}
