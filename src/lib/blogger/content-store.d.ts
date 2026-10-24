declare module '@/lib/blogger/content-store.mjs' {
  type StoreOptions = { publicDir?: string; publicPostBase?: string; productionUrl?: string; previewBase?: string }
  export function slugify(input: unknown): string
  export function assertSafeSlug(slug: string): void
  export function sanitizeImageName(fileName: string): string
  export function validateExistingImageName(fileName: string): string
  export function parsePostMarkdown(content: string): { meta: Record<string, string>; body: string }
  export function serializePostMarkdown(meta: Record<string, unknown>, body: string): string
  export function normalizePostInput(input: unknown, defaults?: Record<string, string>): { meta: Record<string, unknown>; body: string }
  export function listPosts(rootDir: string, options?: StoreOptions): Promise<unknown[]>
  export function readPost(rootDir: string, slug: string, defaults?: Record<string, string>, options?: StoreOptions): Promise<unknown>
  export function savePost(rootDir: string, currentSlug: string | null, input: unknown, defaults?: Record<string, string>, options?: StoreOptions): Promise<unknown>
  export function listPostImages(rootDir: string, slug: string, options?: StoreOptions): Promise<unknown[]>
  export function savePostImage(rootDir: string, slug: string, fileName: string, data: string, options?: StoreOptions): Promise<unknown>
  export function readPostImage(rootDir: string, slug: string, fileName: string, options?: StoreOptions): Promise<{ data: Uint8Array; contentType: string }>
  export function saveImageMetadata(rootDir: string, slug: string, fileName: string, input: unknown, options?: StoreOptions): Promise<unknown>
  export function deletePostImage(rootDir: string, slug: string, fileName: string, options?: StoreOptions): Promise<unknown>
}
