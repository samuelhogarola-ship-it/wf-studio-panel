import { handlePlatformRequestConfigGet, handlePlatformRequestOptions } from '@/lib/platform-requests/public-api.mjs'

export const runtime = 'nodejs'

export async function OPTIONS(request: Request) {
  return handlePlatformRequestOptions(request)
}

export async function GET(request: Request) {
  return handlePlatformRequestConfigGet(request)
}
