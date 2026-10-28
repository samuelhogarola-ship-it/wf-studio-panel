import { requireAdmin } from '@/lib/auth'
import { quarterBounds } from '@/lib/billin/periods.mjs'
import { getBillinPeriodData } from '@/lib/data/billin'

const natureLabels: Record<string, string> = { fixed: 'Fijo mensual', recurring: 'Recurrente variable', one_off: 'Único' }
const areaLabel = (area: string) => area === 'classes' ? 'Clases' : 'General'
const money = (value: number | string) => Number(value).toFixed(2).replace('.', ',')
const csvCell = (value: unknown) => {
  const text = String(value ?? '')
  return /[;",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export async function GET(request: Request) {
  await requireAdmin()
  const url = new URL(request.url)
  const period = quarterBounds(url.searchParams.get('year') ?? undefined, url.searchParams.get('quarter') ?? undefined)
  const data = await getBillinPeriodData(period)
  const rows: unknown[][] = [['Tipo', 'Fecha', 'Documento/Proveedor', 'Concepto', 'Área', 'Clasificación', 'Estado', 'Importe']]

  for (const invoice of data.invoices) rows.push([
    invoice.document_type === 'proposal' ? 'Propuesta' : 'Factura', invoice.issued_at, invoice.number, invoice.concept,
    areaLabel(invoice.accounting_area), invoice.document_type === 'proposal' ? 'Propuesta' : 'Factura',
    invoice.status === 'paid' ? 'Cobrada' : invoice.status === 'void' ? 'Anulada' : 'Pendiente', money(invoice.amount),
  ])
  for (const expense of data.expenses) rows.push([
    'Gasto', expense.expense_date, expense.supplier, expense.concept, areaLabel(expense.accounting_area),
    natureLabels[expense.expense_nature] ?? 'Único', expense.status === 'paid' ? 'Pagado' : expense.status === 'void' ? 'Anulado' : 'Pendiente', money(expense.amount),
  ])

  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(';')).join('\r\n')}\r\n`
  return new Response(csv, { headers: {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="billin-${period.year}-t${period.quarter}.csv"`,
    'Cache-Control': 'private, no-store',
  } })
}
