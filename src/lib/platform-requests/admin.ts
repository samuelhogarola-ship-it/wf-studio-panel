import { requireAdmin } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Json, PlatformRequestPlatform, PlatformRequestStatus, PlatformRequestType } from '@/lib/supabase/types'

const REQUEST_FIELDS = 'id,platform,request_type,name,email,phone,company,profile_data,message,source_url,status,converted_client_id,reviewed_at,rejection_reason,created_at' as const
const DEFAULT_PAGE_SIZE = 50
const MAX_PAGE_SIZE = 100
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function quotedIlike(value: string) {
  return `"%${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}%"`
}

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
  page?: number
  pageSize?: number
}) {
  await requireAdmin()
  const supabase = await createSupabaseServerClient()
  const page = Math.max(1, Math.trunc(input.page ?? 1))
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(input.pageSize ?? DEFAULT_PAGE_SIZE)))
  const normalizedQuery = input.query?.trim().toLowerCase().slice(0, 120) ?? ''
  let requestQuery = supabase
    .from('platform_requests')
    .select(REQUEST_FIELDS, { count: 'exact' })
    .in('platform', input.platforms)
    .order('created_at', { ascending: false })

  if (input.status) requestQuery = requestQuery.eq('status', input.status)
  if (normalizedQuery) {
    const pattern = quotedIlike(normalizedQuery)
    requestQuery = requestQuery.or([
      `name.ilike.${pattern}`,
      `email.ilike.${pattern}`,
      `company.ilike.${pattern}`,
      `phone.ilike.${pattern}`,
    ].join(','))
  }
  requestQuery = requestQuery.range((page - 1) * pageSize, page * pageSize - 1)

  const selectedQuery = input.selectedId && UUID_PATTERN.test(input.selectedId)
    ? supabase
        .from('platform_requests')
        .select(REQUEST_FIELDS)
        .in('platform', input.platforms)
        .eq('id', input.selectedId)
        .maybeSingle()
    : Promise.resolve({ data: null, error: null })

  const [{ data, error, count }, { data: selected, error: selectedError }] = await Promise.all([requestQuery, selectedQuery])
  if (error) throw new Error('No se pudieron cargar las solicitudes.')
  if (selectedError) throw new Error('No se pudo cargar la solicitud seleccionada.')

  return {
    requests: (data ?? []) as PlatformRequestListItem[],
    selectedRequest: selected as PlatformRequestListItem | null,
    page,
    pageSize,
    total: count ?? 0,
  }
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
