declare module '@/lib/billin/pagination.mjs' {
  export function collectAllPages<T>(loadPage: (from: number, to: number) => Promise<T[]>, pageSize?: number): Promise<T[]>
}
