import { NextResponse } from 'next/server'
import { authorizeBloggerSite } from '@/lib/blogger/authorize'
import { executeBuildHook } from '@/lib/blogger/build-hook.mjs'
import { assertTrustedMutation } from '@/lib/security/mutations.mjs'

export async function POST(request: Request, { params }: { params: Promise<{ siteKey: string }> }) {
  try {
    assertTrustedMutation(request)
    const { siteKey } = await params
    await authorizeBloggerSite(siteKey)
    const result = await executeBuildHook(siteKey)
    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo publicar.' }, { status: (error as { status?: number }).status ?? 500 })
  }
}
