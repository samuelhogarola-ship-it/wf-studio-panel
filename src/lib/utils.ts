import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatHours(value: number | string | null | undefined) {
  const amount = Number(value ?? 0)
  return `${amount.toFixed(1)} h`
}

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
