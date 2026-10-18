import { NextResponse } from 'next/server'

import { authorizeSportBlogger } from '@/lib/blogger/legacy-authorize'
import { saveBloggerPostImage } from '@/lib/blogger/publisher.mjs'
import { assertTrustedMutation } from '@/lib/security/mutations.mjs'

export const runtime = 'nodejs'

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  try { assertTrustedMutation(request, { requireJson: true }) } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'forbidden' }, { status: (error as { status?: number }).status ?? 403 })
  }
  try { await authorizeSportBlogger() } catch (error) {
    return NextResponse.json({ error: 'unauthorized' }, { status: (error as { status?: number }).status ?? 403 })
  }
  const { slug } = await context.params
  const payload = await request.json().catch(() => ({})) as { fileName?: string; data?: string; alt?: string; description?: string }
  if (!payload.fileName || !payload.data) return NextResponse.json({ error: 'file_required' }, { status: 400 })
  try {
    return NextResponse.json(await saveBloggerPostImage(slug, payload.fileName, payload.data, payload), { status: 201 })
  } catch (error) {
    console.error('[blogger/image-upload]', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'image_upload_failed' }, { status: 400 })
  }
}
