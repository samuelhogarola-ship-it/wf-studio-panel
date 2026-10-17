import { NextResponse } from 'next/server'
import { authorizeBloggerSite } from '@/lib/blogger/authorize'

export async function POST(_request: Request, { params }: { params: Promise<{ siteKey: string }> }) {
  const { siteKey } = await params
  await authorizeBloggerSite(siteKey)
  const hook = process.env[`BLOGGER_BUILD_HOOK_${siteKey.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`]
  if (!hook) return NextResponse.json({ error: `Falta el webhook de publicación para ${siteKey}.` }, { status: 503 })
  const response = await fetch(hook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ siteKey }), cache: 'no-store' })
  if (!response.ok) return NextResponse.json({ error: `El webhook de ${siteKey} respondió ${response.status}.` }, { status: 502 })
  return NextResponse.json({ ok: true, siteKey })
}
