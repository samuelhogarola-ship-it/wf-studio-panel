declare module '@/lib/fichero/validation.mjs' {
  import type { DirectoryPlan } from '@/lib/supabase/types'

  export type DirectoryProfileInput = {
    canonicalSlug?: unknown
    legalName?: unknown
    displayName?: unknown
    cif?: unknown
    contactEmail?: unknown
    phone?: unknown
    whatsapp?: unknown
    website?: unknown
    address?: unknown
    latitude?: unknown
    longitude?: unknown
    categoryKey?: unknown
    categoryLabel?: unknown
    neighborhoodKeys?: unknown
    shortDescription?: unknown
    longDescription?: unknown
    seoTitle?: unknown
    seoDescription?: unknown
    services?: unknown
    schedule?: unknown
    photos?: unknown
    plan?: unknown
  }

  export type ParsedDirectoryProfile = {
    canonicalSlug: string
    legalName: string | null
    displayName: string
    cif: string | null
    contactEmail: string | null
    phone: string | null
    whatsapp: string | null
    website: string | null
    address: string | null
    latitude: number | null
    longitude: number | null
    categoryKey: string
    categoryLabel: string
    neighborhoodKeys: string[]
    shortDescription: string
    longDescription: string
    seoTitle: string | null
    seoDescription: string | null
    services: string[]
    schedule: string[]
    photos: string[]
    plan: DirectoryPlan
  }

  export type DirectoryProfileParseResult =
    | { success: true; data: ParsedDirectoryProfile }
    | { success: false; fieldErrors: Record<string, string[]> }

  export function parseDirectoryProfileInput(input: unknown): DirectoryProfileParseResult
  export function normalizeDirectoryIdentity(input: unknown): {
    normalizedCif: string | null
    normalizedEmail: string | null
    normalizedDomain: string | null
    normalizedName: string | null
  }
  export function stablePayloadHash(input: unknown): string
}
