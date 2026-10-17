declare module '@/lib/blogger/content-store.mjs' {
  export function listPosts(rootDir: string): Promise<unknown[]>
  export function readPost(rootDir: string, slug: string, defaults?: Record<string, string>): Promise<unknown>
  export function savePost(rootDir: string, currentSlug: string | null, input: unknown, defaults?: Record<string, string>): Promise<unknown>
  export function savePostImage(rootDir: string, slug: string, fileName: string, data: string): Promise<unknown>
  export function saveImageMetadata(rootDir: string, slug: string, fileName: string, input: unknown): Promise<unknown>
  export function deletePostImage(rootDir: string, slug: string, fileName: string): Promise<unknown>
}
