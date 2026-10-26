import { NextResponse } from 'next/server'
import { authorizeSportBlogger } from '@/lib/blogger/legacy-authorize'
import { generateBloggerTranslations, approveBloggerTranslation } from '@/lib/blogger/publisher.mjs'
import { assertTrustedMutation } from '@/lib/security/mutations.mjs'

export const runtime = 'nodejs'

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  try { assertTrustedMutation(request, { requireJson: true }) } catch (error) {
    return NextResponse.json({error:'forbidden'}, {status:(error as {status?:number}).status ?? 403})
  }
  try { await authorizeSportBlogger() } catch (error) {
    return NextResponse.json({error:'unauthorized'}, {status:(error as {status?:number}).status ?? 403})
  }
  const { slug } = await context.params
  const payload = await request.json().catch(() => ({})) as {action?:string;languages?:string[];language?:string;sourceFingerprint?:string;contentFingerprint?:string}
  try {
    if (payload.action === 'generate') return NextResponse.json(await generateBloggerTranslations(slug, payload.languages))
    if (payload.action === 'approve' && payload.language && payload.sourceFingerprint && payload.contentFingerprint) return NextResponse.json(await approveBloggerTranslation(slug, payload.language, payload.sourceFingerprint, payload.contentFingerprint))
    return NextResponse.json({error:'Choose generate or approve.'}, {status:400})
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Translation action failed'
    return NextResponse.json({error:message === 'Missing DEEPL_AUTH_KEY' ? 'Automatic translation is optional and not connected yet. You can edit translations manually.' : message}, {status:400})
  }
}
