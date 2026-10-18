import { NextResponse } from 'next/server'
import { authorizeBloggerSite } from '@/lib/blogger/authorize'
import { buildHookRequest } from '@/lib/blogger/build-hook.mjs'

export async function POST(_request: Request, { params }: { params: Promise<{ siteKey: string }> }) {
  const { siteKey } = await params
  await authorizeBloggerSite(siteKey)
  try {
    const request = buildHookRequest(siteKey)
    const response = await fetch(request.url, { method: 'POST', headers: request.headers, body: request.body, cache: 'no-store' })
    if (!response.ok) return NextResponse.json({ error: `El webhook de ${siteKey} respondió ${response.status}.` }, { status: 502 })
    return NextResponse.json({ ok: true, siteKey })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo publicar.' }, { status: (error as { status?: number }).status ?? 500 })
  }
}
