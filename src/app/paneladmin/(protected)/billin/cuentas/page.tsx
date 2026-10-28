import { BillingAccountForm } from '@/components/admin/billing-account-form'
import { AdminShell } from '@/components/layout/app-shell'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { requireAdmin } from '@/lib/auth'
import { getBillingAccounts } from '@/lib/data/billin'
import { getLocale } from '@/lib/locale'

export const dynamic = 'force-dynamic'

const typeLabels: Record<string, string> = { bank: 'Banco', stripe: 'Stripe', cash: 'Efectivo', other: 'Otra' }

export default async function BillinAccountsPage() {
  const identity = await requireAdmin()
  const [locale, accounts] = await Promise.all([getLocale(), getBillingAccounts()])
  return <AdminShell title="Bill-in · Cuentas" description="Define dónde cobras ingresos y desde qué cuenta pagas gastos." currentPath="/paneladmin/billin/cuentas" userEmail={identity.email} locale={locale}>
    <Card className="p-5"><h2 className="mb-4 text-lg font-bold text-foreground">Añadir cuenta de Bill-in</h2><BillingAccountForm /></Card>
    <Card className="mt-4 overflow-hidden"><div className="border-b border-line px-5 py-4"><h2 className="text-lg font-bold text-foreground">Cuentas de Bill-in</h2><p className="text-sm text-muted">Se conservan en Supabase y se relacionan con cada movimiento.</p></div><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.12em] text-slate-500"><tr><th className="px-5 py-3">Cuenta</th><th className="px-5 py-3">Tipo</th><th className="px-5 py-3">Referencia</th><th className="px-5 py-3">Estado</th></tr></thead><tbody className="divide-y divide-line">{accounts.map((account) => <tr key={account.id}><td className="px-5 py-3 font-semibold">{account.name}</td><td className="px-5 py-3">{typeLabels[account.account_type] ?? account.account_type}</td><td className="px-5 py-3 text-muted">{account.details ?? '—'}</td><td className="px-5 py-3"><Badge>{account.status === 'active' ? 'Activa' : 'Inactiva'}</Badge></td></tr>)}</tbody></table>{accounts.length === 0 ? <p className="px-5 py-6 text-sm text-muted">Añade tu primera cuenta para asignarla a facturas y gastos.</p> : null}</div></Card>
  </AdminShell>
}

