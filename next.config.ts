import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: { serverActions: { bodySizeLimit: '12mb' } },
  outputFileTracingRoot: __dirname,
}

export default nextConfig
