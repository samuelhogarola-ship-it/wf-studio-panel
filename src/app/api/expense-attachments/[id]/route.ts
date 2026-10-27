import { requireAdmin } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response('No disponible', { status: 404 })
  const db = await createSupabaseServerClient()
  const { data, error } = await db.from('ledger_expense_attachments').select('*').eq('id', id).maybeSingle()
  if (error || !data || !data.storage_path.startsWith('receipts/')) return new Response('No disponible', { status: 404 })
  const { data: file, error: downloadError } = await db.storage.from('expense-attachments').download(data.storage_path)
  if (downloadError || !file) return new Response('No disponible', { status: 404 })
  const disposition = new URL(request.url).searchParams.has('download') ? 'attachment' : 'inline'
  const safeName = data.original_name.replace(/["\r\n]/g, '_')
  return new Response(file, { headers: { 'Content-Type': data.content_type, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': `${disposition}; filename="${safeName}"` } })
}
