import { NextResponse } from 'next/server'

import { getOptionalIdentity } from '@/lib/auth'
import { listBloggerPosts, saveBloggerPost } from '@/lib/blogger/publisher.mjs'

export const runtime = 'nodejs'

async function adminOnly() {
  const identity = await getOptionalIdentity()
  return identity?.role === 'admin'
}

export async function GET() {
  if (!(await adminOnly())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  try {
    return NextResponse.json({ posts: await listBloggerPosts() })
  } catch (error) {
    console.error('[blogger/list]', error)
    return NextResponse.json({ error: 'blogger_unavailable' }, { status: 503 })
  }
}

export async function POST(request: Request) {
  if (!(await adminOnly())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  try {
    return NextResponse.json(await saveBloggerPost(null, await request.json()), { status: 201 })
  } catch (error) {
    console.error('[blogger/save]', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'blogger_save_failed' }, { status: 400 })
  }
}
