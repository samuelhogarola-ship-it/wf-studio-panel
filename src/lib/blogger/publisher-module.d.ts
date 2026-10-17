declare module '@/lib/blogger/publisher.mjs' {
  export function listBloggerPosts(): Promise<Array<Record<string, unknown>>>
  export function readBloggerPost(slug: string): Promise<{ slug: string; meta: Record<string, string>; body: string; format: string; isPublished: boolean } | null>
  export function saveBloggerPost(slug: string | null, input: Record<string, unknown>): Promise<Record<string, unknown>>
  export function publishBloggerPost(meta: Record<string, string>, body: string): Promise<{ slug: string; url: string; repository: string; branch: string }>
}
