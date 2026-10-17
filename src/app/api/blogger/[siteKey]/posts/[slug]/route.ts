import { NextResponse } from 'next/server'
import { authorizeBloggerSite } from '@/lib/blogger/authorize'
import { readPost, savePost } from '@/lib/blogger/content-store.mjs'

async function authorize(siteKey: string) {
  return authorizeBloggerSite(siteKey)
}

export async function GET(_request: Request, { params }: { params: Promise<{ siteKey: string; slug: string }> }) {
  try {
    const { siteKey, slug } = await params
    const { root } = await authorize(siteKey)
    return NextResponse.json(await readPost(root, slug))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo cargar el post.' }, { status: (error as { status?: number }).status ?? 500 })
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ siteKey: string; slug: string }> }) {
  try {
    const { siteKey, slug } = await params
    const { root, site } = await authorize(siteKey)
    return NextResponse.json(await savePost(root, slug, await request.json(), { defaultAuthor: site.name, defaultLanguage: 'es' }))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo actualizar el post.' }, { status: (error as { status?: number }).status ?? 500 })
  }
}
