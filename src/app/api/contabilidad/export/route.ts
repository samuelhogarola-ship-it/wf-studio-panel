import { requireAdmin } from '@/lib/auth'
import { createSpanishCsv } from '@/lib/billing/csv'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const datasets = ['documents', 'payments', 'income', 'expenses'] as const
type Dataset = typeof datasets[number]
const within = (date: string, from: string, to: string) => date >= from && date <= to

export async function GET(request: Request) {
  await requireAdmin()
  const url = new URL(request.url)
  const dataset = url.searchParams.get('dataset') as Dataset
  const from = url.searchParams.get('from') ?? ''
  const to = url.searchParams.get('to') ?? ''
  if (!datasets.includes(dataset) || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) return new Response('Parámetros no válidos', { status: 400 })
  const db = await createSupabaseServerClient()
  let headers: string[] = []
  let rows: Array<Array<string | number | null>> = []

  if (dataset === 'documents') {
    const { data } = await db.from('billing_documents').select('*').order('document_date')
    headers = ['Número', 'Fecha', 'Tipo', 'Estado', 'Cliente', 'Concepto', 'Base', 'IVA', 'Total']
    rows = (data ?? []).filter(item => within(item.document_date, from, to)).map(item => [item.number, item.document_date, item.document_type, item.status, item.recipient_name, item.title, item.net_cents, item.tax_cents, item.total_cents])
  } else if (dataset === 'payments') {
    const [{ data }, { data: documents }] = await Promise.all([db.from('billing_payments').select('*').is('reversed_at', null).order('paid_on'), db.from('billing_documents').select('*')])
    const documentNumbers = new Map((documents ?? []).map(document => [document.id, document.number ?? document.title]))
    headers = ['Fecha', 'Documento', 'Método', 'Importe', 'Nota']
    rows = (data ?? []).filter(item => within(item.paid_on, from, to)).map(item => [item.paid_on, documentNumbers.get(item.document_id) ?? item.document_id, item.method, item.amount_cents, item.note])
  } else if (dataset === 'income') {
    const { data } = await db.from('ledger_income').select('*').order('occurred_on')
    headers = ['Fecha', 'Categoría', 'Concepto', 'Registro', 'Base', 'IVA', 'Total', 'Tratamiento IVA']
    rows = (data ?? []).filter(item => within(item.occurred_on, from, to)).map(item => [item.occurred_on, item.category, item.description, item.source_mode, item.net_cents, item.tax_cents, item.total_cents, item.tax_mode])
  } else {
    const { data } = await db.from('ledger_expenses').select('*').order('occurred_on')
    headers = ['Fecha', 'Proveedor', 'NIF/CIF', 'Nº factura', 'Categoría', 'Base', 'IVA', 'IVA deducible', 'Total', 'Método', 'Notas']
    rows = (data ?? []).filter(item => within(item.occurred_on, from, to)).map(item => [item.occurred_on, item.supplier_name, item.supplier_tax_id, item.invoice_reference, item.category, item.net_cents, item.tax_cents, item.deductible_tax_cents, item.total_cents, item.payment_method, item.notes])
  }
  const filename = `wf-${dataset}-${from}-${to}.csv`
  return new Response(createSpanishCsv(headers, rows), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}"`, 'Cache-Control': 'private, no-store' } })
}
