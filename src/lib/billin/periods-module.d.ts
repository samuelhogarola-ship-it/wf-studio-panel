declare module '@/lib/billin/periods.mjs' {
  export type MonthBounds = { key: string; start: string; end: string; label: string }
  export type QuarterBounds = { year: number; quarter: number; start: string; end: string; label: string }
  export type AccountingPeriod = { key: string; label: string; start?: string; end?: string }
  export function monthBounds(value?: string, now?: Date): MonthBounds
  export function quarterBounds(year?: string | number, quarter?: string | number, now?: Date): QuarterBounds
  export function resolveAccountingPeriod(input?: { period?: string; month?: string; from?: string; to?: string }, now?: Date): AccountingPeriod
}
