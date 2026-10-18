declare module '@/lib/blogger/content-store.mjs' {
  type StoreOptions = { publicDir?: string; publicPostBase?: string; productionUrl?: string; previewBase?: string }
  export function listPosts(rootDir: string, options?: StoreOptions): Promise<unknown[]>
  export function readPost(rootDir: string, slug: string, defaults?: Record<string, string>, options?: StoreOptions): Promise<unknown>
  export function savePost(rootDir: string, currentSlug: string | null, input: unknown, defaults?: Record<string, string>, options?: StoreOptions): Promise<unknown>
  export function savePostImage(rootDir: string, slug: string, fileName: string, data: string, options?: StoreOptions): Promise<unknown>
  export function readPostImage(rootDir: string, slug: string, fileName: string, options?: StoreOptions): Promise<{ data: Uint8Array; contentType: string }>
  export function saveImageMetadata(rootDir: string, slug: string, fileName: string, input: unknown, options?: StoreOptions): Promise<unknown>
  export function deletePostImage(rootDir: string, slug: string, fileName: string, options?: StoreOptions): Promise<unknown>
}
