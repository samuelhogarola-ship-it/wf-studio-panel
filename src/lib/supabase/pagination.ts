const PAGE_SIZE = 500

type DataPage<T> = { data: T[] | null; error: unknown }

export async function collectAllRows<T>(loadPage: (from: number, to: number) => PromiseLike<DataPage<T>>) {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const page = await loadPage(from, from + PAGE_SIZE - 1)
    if (page.error) throw page.error
    const data = page.data ?? []
    rows.push(...data)
    if (data.length < PAGE_SIZE) return rows
  }
}
