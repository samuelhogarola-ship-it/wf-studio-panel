import Link from 'next/link'

import { PackForm } from '@/components/admin/pack-form'
import { AdminShell } from '@/components/layout/app-shell'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { requireAdmin } from '@/lib/auth'
import { getAdminPacksPageData } from '@/lib/data/admin'
import { getLocale } from '@/lib/locale'
import { t } from '@/lib/i18n'
import { formatDate, formatDuration } from '@/lib/utils'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

function getPackStatusMeta(status: string, packType: string, remaining: number) {
  if (status === 'active') {
    return { label: 'Activo', className: 'bg-emerald-50 text-emerald-700' }
  }
  if (status === 'completed' || (status === 'inactive' && packType === 'hours' && remaining <= 0)) {
    return { label: 'Completado', className: 'bg-blue-50 text-blue-700' }
  }
  return { label: 'Inactivo', className: 'bg-slate-100 text-slate-500' }
}

const TYPE_LABELS: Record<string, string> = {
  hours: 'Horas',
  tasks: 'Tareas',
  domain: 'Dominio',
  hosting: 'Hosting',
  service: 'Servicio',
  subscription: 'Suscripción',
  membership: 'Membresía',
}

export default async function AdminPacksPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; tab?: string; new?: string }>
}) {
  const identity = await requireAdmin()
  const params = await searchParams
  const tab = ['dominios', 'hosting', 'packs'].includes(params.tab ?? '') ? params.tab! : 'horas'
  const showNew = params.new === '1' || !!params.edit

  const typeFilter = tab === 'horas' ? 'hours' : tab === 'dominios' ? 'domain' : tab === 'hosting' ? 'hosting' : undefined
  const data = await getAdminPacksPageData(params.edit, typeFilter)

  const packs = tab === 'packs'
    ? data.packs.filter((p) => !['hours', 'domain', 'hosting'].includes(p.pack_type))
    : data.packs

  const summaryMap = new Map(data.packSummaries.map((item) => [item.pack_id, item]))
  const locale = await getLocale()

  const tabParam = tab === 'horas' ? '' : `&tab=${tab}`
  const tabQuery = tab === 'horas' ? '' : `?tab=${tab}`
  const newLabel = tab === 'horas' ? 'Nuevo bono' : tab === 'dominios' ? 'Nuevo dominio' : tab === 'hosting' ? 'Nuevo hosting' : 'Nuevo pack'
  const formTitle = params.edit ? 'Editar' : tab === 'horas' ? 'Nuevo bono de horas' : tab === 'dominios' ? 'Nuevo dominio' : tab === 'hosting' ? 'Nuevo hosting' : 'Nuevo pack o servicio'
  const defaultPackType = tab === 'dominios' ? 'domain' : tab === 'hosting' ? 'hosting' : tab === 'packs' ? 'tasks' : 'hours'

  return (
    <AdminShell
      title={t(locale, 'packs.title')}
      description={t(locale, 'packs.description')}
      currentPath="/paneladmin/bonos"
      userEmail={identity.email}
      locale={locale}
    >
      {/* Tabs + new button */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex flex-wrap gap-1.5">
          {[
            { key: 'horas', label: 'Bonos de horas', href: '/paneladmin/bonos' },
            { key: 'dominios', label: 'Dominios', href: '/paneladmin/bonos?tab=dominios' },
            { key: 'hosting', label: 'Hosting', href: '/paneladmin/bonos?tab=hosting' },
            { key: 'packs', label: 'Packs y servicios', href: '/paneladmin/bonos?tab=packs' },
          ].map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                'whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-semibold transition',
                tab === item.key ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <Link
          href={`/paneladmin/bonos?new=1${tabParam}`}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-brand px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90 transition"
        >
          <span className="text-base leading-none">+</span> {newLabel}
        </Link>
      </div>

      {/* Form panel */}
      {showNew && (
        <div className="mb-6 rounded-xl border border-line bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground">
              {formTitle}
            </h2>
            <Link
              href={`/paneladmin/bonos${tabQuery}`}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition text-lg leading-none"
            >
              ×
            </Link>
          </div>
          <PackForm clients={data.clients} editingPack={data.editingPack} locale={locale} defaultPackType={defaultPackType} />
        </div>
      )}

      {/* Packs list */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-6 py-4">Pack</th>
                <th className="px-6 py-4">Cliente</th>
                {tab === 'horas' ? (
                  <>
                    <th className="px-6 py-4">Tiempo</th>
                    <th className="px-6 py-4">Restante</th>
                  </>
                ) : (
                  <th className="px-6 py-4">Tipo</th>
                )}
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4">{tab !== 'horas' ? 'Renovación' : 'Compra'}</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {packs.map((pack) => {
                const summary = summaryMap.get(pack.id)
                const remaining = Number(summary?.remaining_minutes ?? 0)
                const total = Number(summary?.minutes_total ?? pack.minutes_total)
                const pct = total > 0 ? Math.min(100, Math.round(((total - remaining) / total) * 100)) : 0
                const statusMeta = getPackStatusMeta(pack.status, pack.pack_type, remaining)

                return (
                  <tr key={pack.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <Link
                        href={`/paneladmin/bonos/${pack.id}`}
                        className="font-semibold text-foreground hover:text-brand hover:underline"
                      >
                        {pack.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {pack.clients?.name ?? '—'}
                    </td>
                    {tab === 'horas' ? (
                      <>
                        <td className="px-6 py-4">
                          <p className="font-medium text-foreground">{formatDuration(total)}</p>
                          <div className="mt-1 h-1.5 w-24 rounded-full bg-slate-100">
                            <div
                              className={`h-1.5 rounded-full ${pct >= 90 ? 'bg-red-400' : pct >= 70 ? 'bg-amber-400' : 'bg-brand'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={remaining <= 0 ? 'font-semibold text-red-600' : 'font-semibold text-foreground'}>
                            {formatDuration(Math.max(0, remaining))}
                          </span>
                        </td>
                      </>
                    ) : (
                      <td className="px-6 py-4">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                          {TYPE_LABELS[pack.pack_type] ?? pack.pack_type}
                        </span>
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <Badge className={statusMeta.className}>
                        {statusMeta.label}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {pack.renewal_date ? formatDate(pack.renewal_date) : formatDate(pack.purchase_date)}
                    </td>
                    <td className="px-6 py-4 flex items-center gap-2">
                      <Link
                        href={`/paneladmin/bonos/${pack.id}`}
                        className="rounded-full bg-brand/10 px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand/20 transition"
                      >
                        Ver
                      </Link>
                      <Link
                        href={`/paneladmin/bonos?edit=${pack.id}${tabParam}`}
                        className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition"
                      >
                        {t(locale, 'packs.list.edit')}
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {packs.length === 0 && (
            <p className="px-6 py-10 text-sm text-muted">
              {tab === 'horas' ? 'No hay bonos de horas.' : tab === 'dominios' ? 'No hay dominios.' : tab === 'hosting' ? 'No hay hosting.' : 'No hay packs o servicios.'}
            </p>
          )}
        </div>
      </Card>
    </AdminShell>
  )
}
