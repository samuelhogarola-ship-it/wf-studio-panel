import { NextResponse } from 'next/server'

import { authorizeSportBlogger } from '@/lib/blogger/legacy-authorize'
import { deleteBloggerPostImage } from '@/lib/blogger/publisher.mjs'
import { assertTrustedMutation } from '@/lib/security/mutations.mjs'

export const runtime = 'nodejs'

export async function DELETE(request: Request, context: { params: Promise<{ slug: string; file: string }> }) {
  try { assertTrustedMutation(request) } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'forbidden' }, { status: (error as { status?: number }).status ?? 403 })
  }
  try { await authorizeSportBlogger() } catch (error) {
    return NextResponse.json({ error: 'unauthorized' }, { status: (error as { status?: number }).status ?? 403 })
  }
  const { slug, file } = await context.params
  try {
    await deleteBloggerPostImage(slug, file)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[blogger/image-delete]', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'image_delete_failed' }, { status: 400 })
  }
}

export async function PUT(request: Request, context: { params: Promise<{ slug: string; file: string }> }) {
  try { assertTrustedMutation(request, { requireJson: true }) } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'forbidden' }, { status: (error as { status?: number }).status ?? 403 })
  }
  try { await authorizeSportBlogger() } catch (error) {
    return NextResponse.json({ error: 'unauthorized' }, { status: (error as { status?: number }).status ?? 403 })
  }
  const { slug, file } = await context.params
  const payload = await request.json().catch(() => ({})) as { alt?: string; description?: string; isFeatured?: boolean }
  return NextResponse.json({ file, url: `/blog/${slug}/img/${file}`, alt: payload.alt || '', description: payload.description || '', isFeatured: Boolean(payload.isFeatured), canDelete: true })
}
