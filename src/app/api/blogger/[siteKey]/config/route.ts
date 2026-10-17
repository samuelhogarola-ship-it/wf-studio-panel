import { NextResponse } from 'next/server'
import { authorizeBloggerSite } from '@/lib/blogger/authorize'

export async function GET(_request: Request, { params }: { params: Promise<{ siteKey: string }> }) {
  const { siteKey } = await params
  const { site } = await authorizeBloggerSite(siteKey)
  return NextResponse.json({ siteKey, siteName: site.name, defaultAuthor: site.name, defaultLanguage: 'es', apiBase: `/api/blogger/${siteKey}/posts`, buildEndpoint: `/api/blogger/${siteKey}/build`, publicPostBase: site.blogger.publicPostBase })
}
