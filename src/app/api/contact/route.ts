import { sendPublicContactEmail } from '@/lib/email'
import { handleContactOptions, handleContactPost } from '@/lib/contact-form.mjs'

export const runtime = 'nodejs'

export async function OPTIONS(request: Request) {
  return handleContactOptions(request, 'POST,OPTIONS')
}

export async function POST(request: Request) {
  return handleContactPost(request, { sendEmail: sendPublicContactEmail })
}
