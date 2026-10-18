import { NextResponse } from 'next/server'

import { getOptionalIdentity } from '@/lib/auth'
import { readBloggerPost, saveBloggerPost } from '@/lib/blogger/publisher.mjs'
import { assertTrustedMutation } from '@/lib/security/mutations.mjs'

export const runtime = 'nodejs'

async function adminOnly() {
  const identity = await getOptionalIdentity()
  return identity?.role === 'admin'
}

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  if (!(await adminOnly())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { slug } = await context.params
  const post = await readBloggerPost(slug)
  return post ? NextResponse.json(post) : NextResponse.json({ error: 'not_found' }, { status: 404 })
}

export async function PUT(request: Request, context: { params: Promise<{ slug: string }> }) {
  try { assertTrustedMutation(request, { requireJson: true }) } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'forbidden' }, { status: (error as { status?: number }).status ?? 403 })
  }
  if (!(await adminOnly())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { slug } = await context.params
  try {
    return NextResponse.json(await saveBloggerPost(slug, await request.json()))
  } catch (error) {
    console.error('[blogger/update]', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'blogger_save_failed' }, { status: 400 })
  }
}
