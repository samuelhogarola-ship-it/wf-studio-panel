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
  assertWholeCents(input.unitNetCents, 'El precio')
  if (!Number.isInteger(input.taxRateBps) || input.taxRateBps < 0 || input.taxRateBps > 10_000) {
    throw new Error('El tipo impositivo no es válido.')
  }

  const netCents = Math.round(input.quantity * input.unitNetCents)
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
