import { NextResponse } from 'next/server'
import { authorizeBloggerSite } from '@/lib/blogger/authorize'
import { listPosts, savePost } from '@/lib/blogger/content-store.mjs'

async function authorize(siteKey: string) {
  return authorizeBloggerSite(siteKey)
}

export async function GET(_request: Request, { params }: { params: Promise<{ siteKey: string }> }) {
  try {
    const { siteKey } = await params
    const { root, site } = await authorize(siteKey)
    return NextResponse.json({ posts: await listPosts(root, { publicDir: site.blogger.contentDir, publicPostBase: site.blogger.publicPostBase }) })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudieron cargar los posts.' }, { status: (error as { status?: number }).status ?? 500 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ siteKey: string }> }) {
  try {
    const { siteKey } = await params
    const { root, site } = await authorize(siteKey)
    return NextResponse.json(await savePost(root, null, await request.json(), { defaultAuthor: site.name, defaultLanguage: 'es' }, { publicDir: site.blogger.contentDir, publicPostBase: site.blogger.publicPostBase }), { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo guardar el post.' }, { status: (error as { status?: number }).status ?? 500 })
  }
}
