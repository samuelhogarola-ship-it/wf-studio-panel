import { NextResponse } from 'next/server'
import { authorizeBloggerSite } from '@/lib/blogger/authorize'
import { savePostImage } from '@/lib/blogger/content-store.mjs'
import { assertTrustedMutation } from '@/lib/security/mutations.mjs'

export async function POST(request: Request, { params }: { params: Promise<{ siteKey: string; slug: string }> }) {
  try {
    assertTrustedMutation(request, { requireJson: true })
    const { siteKey, slug } = await params
    const { root, site } = await authorizeBloggerSite(siteKey)
    const input = await request.json()
    return NextResponse.json(await savePostImage(root, slug, input.fileName, input.data, { publicDir: site.blogger.contentDir, publicPostBase: site.blogger.publicPostBase, productionUrl: site.productionUrl, previewBase: `/api/blogger/${siteKey}/posts` }))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo subir la imagen.' }, { status: (error as { status?: number }).status ?? 500 })
  }
}
