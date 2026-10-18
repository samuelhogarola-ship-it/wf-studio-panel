import { NextResponse } from 'next/server'

import { authorizeSportBlogger } from '@/lib/blogger/legacy-authorize'
import { listBloggerPosts, saveBloggerPost } from '@/lib/blogger/publisher.mjs'
import { assertTrustedMutation } from '@/lib/security/mutations.mjs'

export const runtime = 'nodejs'

async function authorize() {
  try { await authorizeSportBlogger(); return null } catch (error) {
    return NextResponse.json({ error: 'unauthorized' }, { status: (error as { status?: number }).status ?? 403 })
  }
}

export async function GET() {
  const denied = await authorize()
  if (denied) return denied
  try {
    return NextResponse.json({ posts: await listBloggerPosts() })
  } catch (error) {
    console.error('[blogger/list]', error)
    return NextResponse.json({ error: 'blogger_unavailable' }, { status: 503 })
  }
}

export async function POST(request: Request) {
  try { assertTrustedMutation(request, { requireJson: true }) } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'forbidden' }, { status: (error as { status?: number }).status ?? 403 })
  }
  const denied = await authorize()
  if (denied) return denied
  try {
    return NextResponse.json(await saveBloggerPost(null, await request.json()), { status: 201 })
  } catch (error) {
    console.error('[blogger/save]', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'blogger_save_failed' }, { status: 400 })
  }
}
