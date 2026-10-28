export async function collectAllPages(loadPage, pageSize = 1_000) {
  const rows = []
  for (let from = 0; ; from += pageSize) {
    const page = await loadPage(from, from + pageSize - 1)
    rows.push(...page)
    if (page.length < pageSize) return rows
  }
}
