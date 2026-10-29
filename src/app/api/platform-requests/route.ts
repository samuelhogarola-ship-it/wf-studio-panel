import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  handlePlatformRequestOptions,
  handlePlatformRequestPost,
  persistPlatformRequest,
  type PlatformRequestInsert,
} from '@/lib/platform-requests/public-api.mjs'

export const runtime = 'nodejs'

export async function OPTIONS(request: Request) {
  return handlePlatformRequestOptions(request)
}

export async function POST(request: Request) {
  return handlePlatformRequestPost(request, {
    createRequest: (payload: PlatformRequestInsert) => persistPlatformRequest(getSupabaseAdminClient(), payload),
  })
}
