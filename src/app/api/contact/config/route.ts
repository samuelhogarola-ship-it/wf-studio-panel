import { NextResponse } from 'next/server'

import { getTurnstileConfig } from '@/lib/contact-protection.mjs'

export const runtime = 'nodejs'

const ALLOWED_ORIGINS = new Set([
  'https://webfuengirola.com',
  'https://www.webfuengirola.com',
])

function buildCorsHeaders(origin: string) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
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

export async function GET(request: Request) {
  const origin = getAllowedOrigin(request)

  if (!origin) {
    return NextResponse.json({ error: 'forbidden_origin' }, { status: 403 })
  }

  const turnstile = getTurnstileConfig()

  return NextResponse.json(
    {
      turnstileEnabled: turnstile.enabled,
      turnstileSiteKey: turnstile.siteKey,
    },
    {
      headers: buildCorsHeaders(origin),
    },
  )
}
