declare module '@/lib/fichero/entitlements.mjs' {
  import type { DirectoryPlanEntitlements } from '@/lib/fichero/types'
  import type { DirectoryPlan } from '@/lib/supabase/types'

  export function getPlanEntitlements(plan: DirectoryPlan): DirectoryPlanEntitlements
  export function canRenderMiniweb(plan: DirectoryPlan): boolean
  export function canShowContactActions(plan: DirectoryPlan): boolean
  export function canShowRecommendedPlacement(plan: DirectoryPlan): boolean
  export function canShowEditorialPlacement(plan: DirectoryPlan): boolean
}
