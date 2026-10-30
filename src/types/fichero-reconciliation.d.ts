declare module '@/lib/fichero/reconciliation.mjs' {
  export type ReconciliationChannel = 'vivir-fuengirola' | 'conoce-fuengirola'
  export type ReconciliationRow = {
    id: string
    channelKey: ReconciliationChannel
    canonicalProfileId?: string | null
    name: string
    slug: string
    cif?: string | null
    website?: string | null
    contactEmail?: string | null
    phone?: string | null
  }
  export function normalizeCif(value: unknown): string | null
  export function normalizeDomain(value: unknown): string | null
  export function compatibleBusinessName(left: unknown, right: unknown): boolean
  export function matchBusinessToCanonical(row: ReconciliationRow, canonicalProfiles: Array<Record<string, unknown>>): Record<string, unknown>
  export function redactReconciliationRow(row: ReconciliationRow): Record<string, unknown>
  export function buildReconciliationReport(input: {
    canonicalProfiles?: Array<Record<string, unknown>>
    vivirBusinesses?: ReconciliationRow[]
    conoceBusinesses?: ReconciliationRow[]
  }): Record<string, unknown>
}
