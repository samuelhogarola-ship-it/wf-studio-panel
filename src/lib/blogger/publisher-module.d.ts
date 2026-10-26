declare module '@/lib/blogger/publisher.mjs' {
  export function listBloggerPosts(): Promise<Array<Record<string, unknown>>>
  export function readBloggerPost(slug: string): Promise<{ slug: string; meta: Record<string, string>; body: string; format: string; isPublished: boolean; sourceFingerprint: string; translations: Record<string, unknown> } | null>
  export function generateBloggerTranslations(slug: string, languages?: string[]): Promise<Record<string, unknown> | null>
  export function approveBloggerTranslation(slug: string, language: string, sourceFingerprint: string, contentFingerprint: string): Promise<Record<string, unknown> | null>
  export function saveBloggerPost(slug: string | null, input: Record<string, unknown>): Promise<Record<string, unknown>>
  export function publishBloggerPost(meta: Record<string, string>, body: string): Promise<{ slug: string; url: string; repository: string; branch: string }>
  export function saveBloggerPostImage(slug: string, fileName: string, data: string, metadata?: Record<string, unknown>): Promise<Record<string, unknown>>
  export function updateBloggerPostImage(slug: string, fileName: string, metadata?: Record<string, unknown>): Promise<Record<string, unknown> | undefined>
  export function readBloggerPostImage(slug: string, fileName: string): Promise<{ data: Buffer; contentType: string | undefined }>
  export function deleteBloggerPostImage(slug: string, fileName: string): Promise<boolean>
}
