import { requireAdmin } from '@/lib/auth'
import { createSpanishCsv } from '@/lib/billing/csv'
import { collectAllRows } from '@/lib/supabase/pagination'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const datasets = ['documents', 'payments', 'income', 'expenses'] as const
type Dataset = typeof datasets[number]

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
    const data = await collectAllRows((start, end) => db.from('billing_documents').select('*')
      .gte('document_date', from).lte('document_date', to)
      .order('document_date').order('id').range(start, end))
    headers = ['Número', 'Fecha', 'Tipo', 'Estado', 'Cliente', 'Concepto', 'Base', 'IVA', 'Total', 'Desglose fiscal pendiente de revisar']
    rows = data.map(item => [item.number, item.document_date, item.document_type, item.status, item.recipient_name, item.title, item.net_cents, item.tax_cents, item.total_cents, item.tax_breakdown_review_required ? 'Sí' : 'No'])
  } else if (dataset === 'payments') {
    const data = await collectAllRows((start, end) => db.from('billing_payments').select('*')
      .is('reversed_at', null).gte('paid_on', from).lte('paid_on', to)
      .order('paid_on').order('id').range(start, end))
    const documentNumbers = new Map<string, string>()
    const documentIds = [...new Set(data.map(payment => payment.document_id))]
    for (let start = 0; start < documentIds.length; start += 200) {
      const { data: documents, error } = await db.from('billing_documents').select('id, number, title').in('id', documentIds.slice(start, start + 200))
      if (error) throw error
      for (const document of documents ?? []) documentNumbers.set(document.id, document.number ?? document.title)
    }
    headers = ['Fecha', 'Documento', 'Método', 'Importe', 'Nota']
    rows = data.map(item => [item.paid_on, documentNumbers.get(item.document_id) ?? item.document_id, item.method, item.amount_cents, item.note])
  } else if (dataset === 'income') {
    const data = await collectAllRows((start, end) => db.from('ledger_income').select('*')
      .gte('occurred_on', from).lte('occurred_on', to)
      .order('occurred_on').order('id').range(start, end))
    headers = ['Fecha', 'Categoría', 'Concepto', 'Registro', 'Base', 'IVA', 'Total', 'Tratamiento IVA']
    rows = data.map(item => [item.occurred_on, item.category, item.description, item.source_mode, item.net_cents, item.tax_cents, item.total_cents, item.tax_mode])
  } else {
    const data = await collectAllRows((start, end) => db.from('ledger_expenses').select('*')
      .gte('occurred_on', from).lte('occurred_on', to)
      .order('occurred_on').order('id').range(start, end))
    headers = ['Fecha', 'Proveedor', 'NIF/CIF', 'Nº factura', 'Categoría', 'Base', 'IVA', 'IVA deducible', 'Total', 'Método', 'Notas']
    rows = data.map(item => [item.occurred_on, item.supplier_name, item.supplier_tax_id, item.invoice_reference, item.category, item.net_cents, item.tax_cents, item.deductible_tax_cents, item.total_cents, item.payment_method, item.notes])
  }
  const filename = `wf-${dataset}-${from}-${to}.csv`
  return new Response(createSpanishCsv(headers, rows), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}"`, 'Cache-Control': 'private, no-store' } })
}
