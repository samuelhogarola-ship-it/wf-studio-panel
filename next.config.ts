import type { NextConfig } from 'next'

function configuredOrigins() {
  const values = [
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.UMAMI_PERSONAL_URL,
    process.env.UMAMI_AGAMA_URL,
    process.env.STAT_REPORT_UMAMI_URL,
  ]

  return values.flatMap((value) => {
    if (!value) return []
    try {
      return [new URL(value).origin]
    } catch {
      return []
    }
  })
}

function securityHeaders() {
  const origins = configuredOrigins()
  const connectSources = ["'self'", 'https://api.github.com', 'https://api.deepl.com', ...origins]
  const imageSources = ["'self'", 'data:', 'blob:', ...origins]
  const frameSources = ["'self'", 'https://www.samuelcoachdealeman.com']
  const formSources = ["'self'", 'https://blogger.sportmassagefuengirola.com']
  const policy = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    `frame-src ${frameSources.join(' ')}`,
    `form-action ${formSources.join(' ')}`,
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    `connect-src ${connectSources.join(' ')}`,
    `img-src ${imageSources.join(' ')}`,
    "font-src 'self' data:",
  ].join('; ')

  return [
    { key: 'Content-Security-Policy', value: policy },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
    { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  ]
}

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: { serverActions: { bodySizeLimit: '12mb' } },
  outputFileTracingRoot: __dirname,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders() }]
  },
}

export default nextConfig
