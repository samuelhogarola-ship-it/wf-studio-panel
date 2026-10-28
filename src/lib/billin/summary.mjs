const emptyArea = () => ({ invoiced: 0, collected: 0, expenses: 0, net: 0 })

function areaKey(value) {
  return value === 'classes' ? 'classes' : 'general'
}

function amount(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function summarizeBillin({ invoices = [], expenses = [] } = {}) {
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

    const value = amount(invoice.amount)
    const area = summary.areas[areaKey(invoice.accounting_area)]
    summary.counts.invoices += 1
    summary.totals.invoiced += value
    area.invoiced += value
    if (invoice.status === 'paid') {
      summary.totals.collected += value
      area.collected += value
    } else if (invoice.status === 'issued') {
      summary.counts.pendingInvoices += 1
    }
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

