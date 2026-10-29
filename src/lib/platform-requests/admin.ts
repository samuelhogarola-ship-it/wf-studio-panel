import { requireAdmin } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Json, PlatformRequestPlatform, PlatformRequestStatus, PlatformRequestType } from '@/lib/supabase/types'

const REQUEST_FIELDS = 'id,platform,request_type,name,email,phone,company,profile_data,message,source_url,status,converted_client_id,reviewed_at,rejection_reason,created_at' as const

export type PlatformRequestListItem = {
  id: string
  platform: PlatformRequestPlatform
  request_type: PlatformRequestType
  name: string
  email: string
  phone: string | null
  company: string | null
  profile_data: Json
  message: string | null
  source_url: string | null
  status: PlatformRequestStatus
  converted_client_id: string | null
  reviewed_at: string | null
  rejection_reason: string | null
  created_at: string
}

export type PlatformRequestCounts = Record<PlatformRequestPlatform, number>

export async function getPlatformRequestInbox(input: {
  platforms: PlatformRequestPlatform[]
  status?: PlatformRequestStatus
  query?: string
  selectedId?: string
}) {
  await requireAdmin()
  const supabase = await createSupabaseServerClient()
  let requestQuery = supabase
    .from('platform_requests')
    .select(REQUEST_FIELDS)
    .in('platform', input.platforms)
    .order('created_at', { ascending: false })

  if (input.status) requestQuery = requestQuery.eq('status', input.status)
  const { data, error } = await requestQuery
  if (error) throw new Error('No se pudieron cargar las solicitudes.')

  const normalizedQuery = input.query?.trim().toLowerCase() ?? ''
  const requests = ((data ?? []) as PlatformRequestListItem[]).filter((item) => {
    if (!normalizedQuery) return true
    return [item.name, item.email, item.company ?? '', item.phone ?? '']
      .some((value) => value.toLowerCase().includes(normalizedQuery))
  })
  const selectedRequest = input.selectedId
    ? requests.find((item) => item.id === input.selectedId) ?? null
    : null

  return { requests, selectedRequest }
}

export async function getPendingPlatformRequestCounts(): Promise<PlatformRequestCounts> {
  await requireAdmin()
  const supabase = await createSupabaseServerClient()
  const platforms: PlatformRequestPlatform[] = ['vivir-fuengirola', 'vivir-fuengirola-negocios', 'conoce-fuengirola']
  const results = await Promise.all(platforms.map((platform) => supabase
    .from('platform_requests')
    .select('*', { count: 'exact', head: true })
    .eq('platform', platform)
    .eq('status', 'pending')))

  const counts = {} as PlatformRequestCounts
  for (const [index, result] of results.entries()) {
    if (result.error) throw new Error('No se pudieron cargar los contadores de solicitudes.')
    counts[platforms[index]] = result.count ?? 0
  }
  return counts
}
