const emptyArea = () => ({ invoiced: 0, collected: 0, expenses: 0, net: 0 })

function areaKey(value) {
  return value === 'classes' ? 'classes' : 'general'
}

function amount(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function summarizeBillin({ invoices = [], collections, expenses = [] } = {}) {
  const summary = {
    totals: emptyArea(),
    counts: { invoices: 0, proposals: 0, pendingInvoices: 0, expenses: 0 },
    areas: { general: emptyArea(), classes: emptyArea() },
  }

  for (const invoice of invoices) {
    if (invoice.status === 'void') continue
    if (invoice.document_type === 'proposal') {
      summary.counts.proposals += 1
      continue
    }
    if (invoice.status !== 'issued' && invoice.status !== 'paid') continue

    const value = amount(invoice.amount)
    const area = summary.areas[areaKey(invoice.accounting_area)]
    summary.counts.invoices += 1
    summary.totals.invoiced += value
    area.invoiced += value
    if (collections === undefined && invoice.status === 'paid') {
      summary.totals.collected += value
      area.collected += value
    } else if (invoice.status === 'issued') {
      summary.counts.pendingInvoices += 1
    }
  }

  if (collections !== undefined) for (const invoice of collections) {
    if (invoice.status !== 'paid' || invoice.document_type === 'proposal') continue
    const value = amount(invoice.amount)
    const area = summary.areas[areaKey(invoice.accounting_area)]
    summary.totals.collected += value
    area.collected += value
  }

  for (const expense of expenses) {
    if (expense.status === 'void') continue
    summary.counts.expenses += 1
    if (expense.status !== 'paid') continue
    const value = amount(expense.amount)
    const area = summary.areas[areaKey(expense.accounting_area)]
    summary.totals.expenses += value
    area.expenses += value
  }

  for (const area of [summary.totals, summary.areas.general, summary.areas.classes]) {
    area.net = area.collected - area.expenses
  }

  return summary
}

export function summarizeAccounts({ accounts = [], invoices = [], collections, expenses = [] } = {}) {
  const names = new Map(accounts.map((account) => [account.id, account.name]))
  const areas = { general: new Map(), classes: new Map() }
  const rowFor = (areaValue, accountId) => {
    const area = areaKey(areaValue)
    const normalizedId = accountId && names.has(accountId) ? accountId : null
    const key = normalizedId ?? '__unassigned__'
    if (!areas[area].has(key)) areas[area].set(key, {
      id: normalizedId, name: normalizedId ? names.get(normalizedId) : 'Sin cuenta asignada', collected: 0, expenses: 0, net: 0,
    })
    return areas[area].get(key)
  }

  for (const invoice of collections ?? invoices) {
    if (invoice.status !== 'paid' || invoice.document_type === 'proposal') continue
    rowFor(invoice.accounting_area, invoice.billing_account_id).collected += amount(invoice.amount)
  }
  for (const expense of expenses) {
    if (expense.status !== 'paid') continue
    rowFor(expense.accounting_area, expense.billing_account_id).expenses += amount(expense.amount)
  }
  const finish = (rows) => [...rows.values()].map((row) => ({ ...row, net: row.collected - row.expenses }))
  return { general: finish(areas.general), classes: finish(areas.classes) }
}

