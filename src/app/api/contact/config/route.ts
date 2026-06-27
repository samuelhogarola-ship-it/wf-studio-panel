import { NextResponse } from 'next/server'

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

function getTurnstileSiteKey() {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || process.env.TURNSTILE_SITE_KEY || ''
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

  const siteKey = getTurnstileSiteKey()

  if (!siteKey) {
    return NextResponse.json(
      { error: 'turnstile_not_configured' },
      {
        status: 503,
        headers: buildCorsHeaders(origin),
      },
    )
  }

  return NextResponse.json(
    { turnstileSiteKey: siteKey },
    {
      headers: buildCorsHeaders(origin),
    },
  )
}
