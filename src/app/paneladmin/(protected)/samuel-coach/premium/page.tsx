import Link from 'next/link'

import { ConnectionIssueCard } from '@/components/admin/connection-issue-card'
import { PremiumCodeCancelForm } from '@/components/admin/premium-code-cancel-form'
import { AdminShell } from '@/components/layout/app-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { generatePremiumCodeAction } from '@/lib/actions/premium-codes'
import { requireAdmin } from '@/lib/auth'
import { getLocale } from '@/lib/locale'
import { createAppsUsersAdminClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

type PremiumCode = {
  code: string
  customer_email: string | null
  duration_days: number
  status: string
  created_at: string
  redeemed_at: string | null
  redeemed_by: string | null
}

const STATUS_OPTIONS = [
  ['active', 'Activos'],
  ['used', 'Usados'],
  ['cancelled', 'Cancelados'],
  ['all', 'Todos'],
] as const

function codeStatus(code: PremiumCode) {
  if (code.redeemed_at) return 'Usado'
  if (code.status === 'active') return 'Activo'
  if (code.status === 'cancelled') return 'Cancelado'
  return code.status
}

function codeStatusClass(code: PremiumCode) {
  if (code.redeemed_at) return 'bg-blue-50 text-blue-700'
  if (code.status === 'active') return 'bg-emerald-50 text-emerald-700'
  if (code.status === 'cancelled') return 'bg-rose-50 text-rose-700'
  return 'bg-slate-100 text-slate-600'
}

async function getPremiumCodes(status: string) {
  const db = createAppsUsersAdminClient()
  const { data, error } = await db.rpc('list_premium_codes', {
    p_status: status === 'all' ? null : status,
  })
  if (error) throw error
  return (data ?? []) as PremiumCode[]
}

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const identity = await requireAdmin()
  const locale = await getLocale()
  const params = await searchParams
  const status = STATUS_OPTIONS.some(([value]) => value === params.status) ? params.status ?? 'active' : 'active'
  let codes: PremiumCode[] = []
  let error: string | null = null

  try {
    codes = await getPremiumCodes(status)
  } catch (cause) {
    error = cause instanceof Error ? cause.message : 'No se pudieron cargar los códigos premium.'
  }

  return (
    <AdminShell
      title="Premium educativo"
      description="Códigos compartidos del ecosistema educativo"
      currentPath="/paneladmin/samuel-coach/premium"
      userEmail={identity.email}
      locale={locale}
    >
      {error ? (
        <div className="mb-8">
          <ConnectionIssueCard
            message="Revisa APPS_USERS_URL, APPS_USERS_SERVICE_KEY y las RPC de premium."
            detail={error}
          />
        </div>
      ) : null}

      <Card className="mb-8 p-6">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Ecosistema educativo</p>
          <h2 className="mt-2 text-xl font-bold text-foreground">Generar código premium</h2>
        </div>
        <form action={generatePremiumCodeAction} className="grid gap-4 md:grid-cols-[1fr_180px_180px_auto] md:items-end">
          <div>
            <Label htmlFor="customer_email">Email del alumno</Label>
            <Input id="customer_email" name="customer_email" type="email" placeholder="alumno@example.com" required />
          </div>
          <div>
            <Label htmlFor="duration_days">Duración</Label>
            <Select id="duration_days" name="duration_days" defaultValue="30">
              <option value="30">1 mes</option>
              <option value="90">3 meses</option>
              <option value="180">6 meses</option>
              <option value="365">1 año</option>
              <option value="999">Ilimitado</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="created_by_type">Origen</Label>
            <Select id="created_by_type" name="created_by_type" defaultValue="studio-panel">
              <option value="studio-panel">Studio Panel</option>
              <option value="manual">Manual</option>
            </Select>
          </div>
          <Button type="submit">Generar</Button>
        </form>
      </Card>

      <div className="mb-6 flex flex-wrap gap-2">
        {STATUS_OPTIONS.map(([value, label]) => (
          <Link
            key={value}
            href={`/paneladmin/samuel-coach/premium?status=${value}`}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${status === value ? 'bg-brand text-white' : 'bg-slate-100 text-slate-700'}`}
          >
            {label}
          </Link>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-6 py-4">Código</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Duración</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4">Creado</th>
                <th className="px-6 py-4">Usado</th>
                <th className="px-6 py-4">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {codes.map((code) => (
                <tr key={code.code} className="transition-colors hover:bg-slate-50">
                  <td className="px-6 py-4 font-mono text-sm font-semibold text-foreground">{code.code}</td>
                  <td className="px-6 py-4 text-slate-600">{code.customer_email ?? '-'}</td>
                  <td className="px-6 py-4 text-slate-600">{code.duration_days} días</td>
                  <td className="px-6 py-4">
                    <Badge className={codeStatusClass(code)}>{codeStatus(code)}</Badge>
                  </td>
                  <td className="px-6 py-4 text-slate-500">{formatDate(code.created_at)}</td>
                  <td className="px-6 py-4 text-slate-500">{code.redeemed_at ? formatDate(code.redeemed_at) : '-'}</td>
                  <td className="px-6 py-4">
                    {!code.redeemed_at && code.status === 'active' ? (
                      <PremiumCodeCancelForm code={code.code} />
                    ) : (
                      <span className="text-xs text-muted">Sin acciones</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {codes.length === 0 ? (
            <p className="px-6 py-10 text-sm text-muted">No hay códigos en esta categoría.</p>
          ) : null}
        </div>
      </Card>
    </AdminShell>
  )
}
