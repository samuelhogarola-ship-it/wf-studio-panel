import { NextResponse } from 'next/server'

import { getOptionalIdentity } from '@/lib/auth'
import { saveBloggerPostImage } from '@/lib/blogger/publisher.mjs'

export const runtime = 'nodejs'

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const identity = await getOptionalIdentity()
  if (identity?.role !== 'admin') return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
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
