import { NextResponse } from 'next/server'
import { authorizeBloggerSite } from '@/lib/blogger/authorize'
import { readPostImage } from '@/lib/blogger/content-store.mjs'

export async function GET(_request: Request, { params }: { params: Promise<{ siteKey: string; slug: string; file: string }> }) {
  try {
    const { siteKey, slug, file } = await params
    const { root, site } = await authorizeBloggerSite(siteKey)
    const image = await readPostImage(root, slug, decodeURIComponent(file), {
      publicDir: site.blogger.contentDir,
      publicPostBase: site.blogger.publicPostBase,
    })
    return new NextResponse(new Uint8Array(image.data), {
      headers: {
        'Content-Type': image.contentType,
        'Cache-Control': 'private, no-store',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo cargar la imagen.' }, { status: (error as { status?: number; code?: string }).code === 'ENOENT' ? 404 : (error as { status?: number }).status ?? 500 })
  }
}
