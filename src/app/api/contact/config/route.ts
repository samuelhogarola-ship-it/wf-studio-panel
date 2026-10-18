import { handleContactConfigGet, handleContactOptions } from '@/lib/contact-form.mjs'

export const runtime = 'nodejs'

export async function OPTIONS(request: Request) {
  return handleContactOptions(request, 'GET,OPTIONS')
}

export async function GET(request: Request) {
  return handleContactConfigGet(request)
}
