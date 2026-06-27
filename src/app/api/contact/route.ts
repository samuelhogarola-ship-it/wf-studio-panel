import { NextResponse } from 'next/server'
import { z } from 'zod'

import { sendPublicContactEmail } from '@/lib/email'
import { getRequiredServerEnv } from '@/lib/env'

export const runtime = 'nodejs'

const ALLOWED_ORIGINS = new Set([
  'https://webfuengirola.com',
  'https://www.webfuengirola.com',
])

const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160),
  company: z.string().trim().max(160).optional().default(''),
  message: z.string().trim().min(10).max(5000),
  website: z.string().trim().max(200).optional().default(''),
  token: z.string().trim().min(1),
  pageUrl: z.string().trim().url().max(500).optional().default(''),
})

function buildCorsHeaders(origin: string) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function getAllowedOrigin(request: Request) {
  const origin = request.headers.get('origin')

  if (!origin || !ALLOWED_ORIGINS.has(origin)) {
    return null
  }

  return origin
}

async function verifyTurnstileToken(token: string, remoteIp: string | null) {
  const formData = new FormData()
  formData.append('secret', getRequiredServerEnv('TURNSTILE_SECRET_KEY'))
  formData.append('response', token)

  if (remoteIp) {
    formData.append('remoteip', remoteIp)
  }

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: formData,
    cache: 'no-store',
  })

  if (!response.ok) {
    return false
  }

  const payload = (await response.json()) as { success?: boolean }
  return Boolean(payload.success)
}

export async function OPTIONS(request: Request) {
  const origin = getAllowedOrigin(request)

  if (!origin) {
    return NextResponse.json({ error: 'forbidden_origin' }, { status: 403 })
  }

  return new NextResponse(null, {
    status: 204,
    headers: buildCorsHeaders(origin),
  })
}

export async function POST(request: Request) {
  const origin = getAllowedOrigin(request)

  if (!origin) {
    return NextResponse.json({ success: false, error: 'forbidden_origin' }, { status: 403 })
  }

  const corsHeaders = buildCorsHeaders(origin)

  try {
    const parsed = contactSchema.safeParse(await request.json())

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'invalid_payload' },
        { status: 400, headers: corsHeaders },
      )
    }

    const { name, email, company, message, website, token, pageUrl } = parsed.data

    if (website) {
      return NextResponse.json({ success: true }, { headers: corsHeaders })
    }

    const isTurnstileValid = await verifyTurnstileToken(
      token,
      request.headers.get('x-forwarded-for'),
    )

    if (!isTurnstileValid) {
      return NextResponse.json(
        { success: false, error: 'turnstile_failed' },
        { status: 400, headers: corsHeaders },
      )
    }

    await sendPublicContactEmail({
      name,
      email,
      company,
      message,
      pageUrl,
    })

    return NextResponse.json({ success: true }, { headers: corsHeaders })
  } catch (error) {
    console.error('Public contact form submission failed', error)

    return NextResponse.json(
      { success: false, error: 'server_error' },
      { status: 500, headers: corsHeaders },
    )
  }
}
