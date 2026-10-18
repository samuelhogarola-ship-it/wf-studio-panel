import { NextResponse } from 'next/server'

import { getOptionalIdentity } from '@/lib/auth'
import { publishBloggerPost, readBloggerPost } from '@/lib/blogger/publisher.mjs'
import { assertTrustedMutation } from '@/lib/security/mutations.mjs'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try { assertTrustedMutation(request, { requireJson: true }) } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'forbidden' }, { status: (error as { status?: number }).status ?? 403 })
  }
  const identity = await getOptionalIdentity()
  if (identity?.role !== 'admin') return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const payload = await request.json().catch(() => ({})) as { slug?: string }
  if (!payload.slug) return NextResponse.json({ error: 'slug_required' }, { status: 400 })
  try {
    const post = await readBloggerPost(payload.slug)
    if (!post) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    return NextResponse.json(await publishBloggerPost({ ...post.meta, slug: post.slug, content_format: post.format }, post.body))
  } catch (error) {
    console.error('[blogger/build]', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'blogger_publish_failed' }, { status: 502 })
  }
}
