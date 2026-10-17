import { NextResponse } from 'next/server'
import { authorizeBloggerSite } from '@/lib/blogger/authorize'
import { deletePostImage, saveImageMetadata } from '@/lib/blogger/content-store.mjs'

export async function PUT(request: Request, { params }: { params: Promise<{ siteKey: string; slug: string; file: string }> }) {
  try {
    const { siteKey, slug, file } = await params
    const { root } = await authorizeBloggerSite(siteKey)
    return NextResponse.json(await saveImageMetadata(root, slug, decodeURIComponent(file), await request.json()))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudieron guardar los metadatos.' }, { status: (error as { status?: number }).status ?? 500 })
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ siteKey: string; slug: string; file: string }> }) {
  try {
    const { siteKey, slug, file } = await params
    const { root } = await authorizeBloggerSite(siteKey)
    return NextResponse.json(await deletePostImage(root, slug, decodeURIComponent(file)))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo borrar la imagen.' }, { status: (error as { status?: number }).status ?? 500 })
  }
}
