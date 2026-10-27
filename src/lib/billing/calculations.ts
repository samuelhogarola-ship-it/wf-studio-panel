export type TaxMode = 'taxable' | 'exempt' | 'non_taxable'

export type BillingLineInput = {
  quantity: number
  unitNetCents: number
  taxMode: TaxMode
  taxRateBps: number
}

export type BillingLineAmounts = {
  netCents: number
  taxCents: number
  totalCents: number
}

export type BillingTotals = BillingLineAmounts

function assertWholeCents(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} debe expresarse en céntimos enteros.`)
}

export function calculateLine(input: BillingLineInput): BillingLineAmounts {
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) throw new Error('La cantidad debe ser mayor que cero.')
  const quantityThousandths = Math.round(input.quantity * 1_000)
  if (Math.abs(input.quantity * 1_000 - quantityThousandths) > Number.EPSILON * 1_000) {
    throw new Error('La cantidad admite como máximo tres decimales.')
  }
  assertWholeCents(input.unitNetCents, 'El precio')
  if (!Number.isInteger(input.taxRateBps) || input.taxRateBps < 0 || input.taxRateBps > 10_000) {
    throw new Error('El tipo impositivo no es válido.')
  }

  const netCents = Math.round(quantityThousandths * input.unitNetCents / 1_000)
  const taxCents = input.taxMode === 'taxable' ? Math.round(netCents * input.taxRateBps / 10_000) : 0
  return { netCents, taxCents, totalCents: netCents + taxCents }
}

export function calculateDocument(lines: BillingLineInput[]): BillingTotals {
  if (lines.length === 0) throw new Error('El documento necesita al menos una línea.')
  return lines.reduce<BillingTotals>((totals, line) => {
    const amounts = calculateLine(line)
    return {
      netCents: totals.netCents + amounts.netCents,
      taxCents: totals.taxCents + amounts.taxCents,
      totalCents: totals.totalCents + amounts.totalCents,
    }
  }, { netCents: 0, taxCents: 0, totalCents: 0 })
}

export function remainingBalance(totalCents: number, paymentsCents: number[]): number {
  assertWholeCents(totalCents, 'El total')
  const paidCents = paymentsCents.reduce((sum, payment) => {
    assertWholeCents(payment, 'El pago')
    return sum + payment
  }, 0)
  if (paidCents > totalCents) throw new Error('El total pagado excede el importe del documento.')
  return totalCents - paidCents
}

type LedgerIncome = { net_cents: number; tax_cents: number; total_cents: number; source_mode: string }
type LedgerExpense = { tax_cents: number; deductible_tax_cents: number; total_cents: number }
type BillingPayment = { id: string; document_id: string; advance_invoice_id: string | null; amount_cents: number; paid_on: string }
type BillingDocument = { id: string; total_cents: number }

export function calculateAccountingSummary(
  from: string,
  income: LedgerIncome[],
  expenses: LedgerExpense[],
  paymentsThroughPeriod: BillingPayment[],
  documents: BillingDocument[],
) {
  const individualIncome = income.filter(entry => entry.source_mode === 'individual')
  const documentIds = new Set(documents.map(document => document.id))
  const appliedByDocument = new Map<string, Map<string, number>>()
  for (const payment of paymentsThroughPeriod) {
    for (const documentId of [payment.document_id, payment.advance_invoice_id]) {
      if (!documentId || !documentIds.has(documentId)) continue
      const applied = appliedByDocument.get(documentId) ?? new Map<string, number>()
      applied.set(payment.id, payment.amount_cents)
      appliedByDocument.set(documentId, applied)
    }
  }
  return {
    netIncomeTotal: individualIncome.reduce((sum, entry) => sum + entry.net_cents, 0),
    outputTaxTotal: individualIncome.reduce((sum, entry) => sum + entry.tax_cents, 0),
    collectionTotal: paymentsThroughPeriod.filter(payment => payment.paid_on >= from).reduce((sum, payment) => sum + payment.amount_cents, 0),
    outstandingBalanceTotal: documents.reduce((sum, document) => {
      const paid = [...(appliedByDocument.get(document.id)?.values() ?? [])].reduce((total, amount) => total + amount, 0)
      return sum + Math.max(0, document.total_cents - paid)
    }, 0),
    expenseTotal: expenses.reduce((sum, entry) => sum + entry.total_cents, 0),
    inputTaxTotal: expenses.reduce((sum, entry) => sum + entry.tax_cents, 0),
    deductibleTaxTotal: expenses.reduce((sum, entry) => sum + entry.deductible_tax_cents, 0),
  }
}
