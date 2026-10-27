const PAGE_SIZE = 500

type DataPage<T> = { data: T[] | null; error: unknown }

export async function collectAllRows<T, Cursor>(
  loadPage: (cursor: Cursor | null, limit: number) => PromiseLike<DataPage<T>>,
  getCursor: (row: T) => Cursor,
) {
  const rows: T[] = []
  let cursor: Cursor | null = null
  for (;;) {
    const page = await loadPage(cursor, PAGE_SIZE)
    if (page.error) throw page.error
    const data = page.data ?? []
    rows.push(...data)
    if (data.length < PAGE_SIZE) return rows
    cursor = getCursor(data[data.length - 1])
  }
}

export type DateIdCursor = { date: string; id: string }

export function dateIdCursorFilter(field: string, cursor: DateIdCursor, direction: 'ascending' | 'descending' = 'ascending') {
  const operator = direction === 'ascending' ? 'gt' : 'lt'
  return `${field}.${operator}.${cursor.date},and(${field}.eq.${cursor.date},id.${operator}.${cursor.id})`
}
