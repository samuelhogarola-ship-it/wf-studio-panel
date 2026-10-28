declare module '@/lib/billin/periods.mjs' {
  export type MonthBounds = { key: string; start: string; end: string; label: string }
  export type QuarterBounds = { year: number; quarter: number; start: string; end: string; label: string }
  export function monthBounds(value?: string, now?: Date): MonthBounds
  export function quarterBounds(year?: string | number, quarter?: string | number, now?: Date): QuarterBounds
}
