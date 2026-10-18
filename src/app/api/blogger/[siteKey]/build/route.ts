import { NextResponse } from 'next/server'
import { authorizeBloggerSite } from '@/lib/blogger/authorize'
import { executeBuildHook } from '@/lib/blogger/build-hook.mjs'

export async function POST(_request: Request, { params }: { params: Promise<{ siteKey: string }> }) {
  const { siteKey } = await params
  await authorizeBloggerSite(siteKey)
  const result = await executeBuildHook(siteKey)
  return NextResponse.json(result.body, { status: result.status })
}
