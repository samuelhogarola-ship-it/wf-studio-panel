import Link from 'next/link'
import { Suspense } from 'react'

import { AnalyticsSkeleton } from '@/components/admin/analytics-skeleton'
import { AdvancedProjectAnalyticsPanel } from '@/components/admin/advanced-project-analytics-panel'
import { PanelAnalyticsSection } from '@/components/admin/panel-analytics-section'
import { updateTodoPlasticoCompanyAction, updateTodoPlasticoListingAction } from '@/lib/actions/todoplastico'
import { requireAdmin } from '@/lib/auth'
import { getCachedTodoPlasticoData } from '@/lib/data/todoplastico'
import { getLocale } from '@/lib/locale'
import { AdminShell } from '@/components/layout/app-shell'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'

export const dynamic = 'force-dynamic'

const dateFormatter = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

type PageParams = {
  q?: string
  view?: string
  status?: string
  page?: string
}

export default async function TodoPlasticoPage({ searchParams }: { searchParams: Promise<PageParams> }) {
  const identity = await requireAdmin()
  const locale = await getLocale()
  const params = await searchParams
  const view = params.view === 'anuncios' ? 'anuncios' : 'empresas'
  const status = params.status ?? 'all'
  const q = params.q ?? ''
  const page = Number(params.page ?? 1) || 1
  const externalAdminUrl = process.env.TODO_PLASTICO_ADMIN_URL ?? 'https://todo-plastico.com/ingresar?next=/admin'

  let data: Awaited<ReturnType<typeof getCachedTodoPlasticoData>> | null = null
  let error: string | null = null

  try {
    data = await getCachedTodoPlasticoData({ q, view, status, page })
  } catch (cause) {
    error = cause instanceof Error ? cause.message : 'No se pudo conectar con Agama Marketplace.'
  }

  return (
    <AdminShell
      title="Agama Marketplace"
      description="Empresas, usuarios y anuncios de la plataforma"
      currentPath="/paneladmin/todoplastico"
      userEmail={identity.email}
      locale={locale}
    >
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted">Operación de Agama</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-foreground">Control del marketplace</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Gestiona empresas y revisa anuncios desde el panel de WF Studio.
          </p>
        </div>
        <a
          href={externalAdminUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
        >
          Abrir panel admin
        </a>
      </div>

      <Suspense fallback={<AnalyticsSkeleton />}>
        <PanelAnalyticsSection panelKey="todoplastico" />
      </Suspense>
      <AdvancedProjectAnalyticsPanel projectKey="agama" projectLabel="TodoPlástico" domain="todo-plastico.com" />

      {error ? (
        <Card className="border-amber-200 bg-amber-50 p-5">
          <p className="font-semibold text-amber-900">Conexión pendiente</p>
          <p className="mt-1 text-sm text-amber-800">
            Configura <code>TODO_PLASTICO_URL</code> y <code>TODO_PLASTICO_SERVICE_KEY</code> en Coolify.
          </p>
          <p className="mt-2 text-xs text-amber-700">{error}</p>
        </Card>
      ) : null}

      {data ? (
        <>
          <section className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            {[
              ['Empresas', data.stats.companies],
              ['Activas', data.stats.activeCompanies],
              ['Verificadas', data.stats.verifiedCompanies],
              ['Anuncios', data.stats.listings],
              ['En revisión', data.stats.pendingListings],
              ['Publicados', data.stats.publishedListings],
            ].map(([label, value]) => (
              <Card key={String(label)} className="p-5">
                <p className="text-sm text-muted">{label}</p>
                <p className="mt-3 text-3xl font-black tracking-tight text-foreground">{value}</p>
              </Card>
            ))}
          </section>

          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <nav className="flex gap-2" aria-label="Gestión Agama Marketplace">
              <Link href="/paneladmin/todoplastico?view=empresas" className={`rounded-lg px-4 py-2 text-sm font-semibold ${view === 'empresas' ? 'bg-brand text-white' : 'bg-slate-100 text-slate-700'}`}>
                Empresas
              </Link>
              <Link href="/paneladmin/todoplastico?view=anuncios" className={`rounded-lg px-4 py-2 text-sm font-semibold ${view === 'anuncios' ? 'bg-brand text-white' : 'bg-slate-100 text-slate-700'}`}>
                Anuncios <span className="ml-1 opacity-70">{data.stats.pendingListings} pendientes</span>
              </Link>
            </nav>
            <form className="flex gap-2">
              <input name="view" type="hidden" value={view} />
              <input name="status" type="hidden" value={status} />
              <input
                name="q"
                defaultValue={q}
                placeholder={view === 'empresas' ? 'Buscar empresa o ubicación' : 'Buscar anuncio'}
                className="w-64 rounded-lg border border-line bg-background px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
              />
              <button className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Buscar
              </button>
            </form>
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                  <tr>
                    {view === 'empresas' ? (
                      <>
                        <th className="px-6 py-4">Empresa</th>
                        <th className="px-6 py-4">Ubicación</th>
                        <th className="px-6 py-4">Estado</th>
                        <th className="px-6 py-4">Alta</th>
                        <th className="px-6 py-4">Acciones</th>
                      </>
                    ) : (
                      <>
                        <th className="px-6 py-4">Anuncio</th>
                        <th className="px-6 py-4">Categoría</th>
                        <th className="px-6 py-4">Estado</th>
                        <th className="px-6 py-4">Alta</th>
                        <th className="px-6 py-4">Acciones</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {view === 'empresas'
                    ? data.companies.map((company) => (
                        <tr key={company.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4">
                            <p className="font-semibold text-foreground">{company.name}</p>
                            <p className="text-xs text-muted">{company.slug}</p>
                          </td>
                          <td className="px-6 py-4 text-slate-600">{company.location ?? '-'}</td>
                          <td className="px-6 py-4">
                            <Badge className={company.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}>
                              {company.status === 'active' ? 'Activa' : 'Bloqueada'}
                              {company.is_verified ? ' · Verificada' : ''}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-slate-500">{dateFormatter.format(new Date(company.created_at))}</td>
                          <td className="px-6 py-4">
                            <form action={updateTodoPlasticoCompanyAction} className="flex gap-2">
                              <input type="hidden" name="id" value={company.id} />
                              {!company.is_verified ? <button name="action" value="verify" className="text-xs font-semibold text-brand">Verificar</button> : null}
                              {company.status === 'active' ? (
                                <button name="action" value="block" className="text-xs font-semibold text-rose-600">Bloquear</button>
                              ) : (
                                <button name="action" value="activate" className="text-xs font-semibold text-emerald-700">Activar</button>
                              )}
                            </form>
                          </td>
                        </tr>
                      ))
                    : data.listings.map((listing) => (
                        <tr key={listing.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4">
                            <p className="font-semibold text-foreground">{listing.title}</p>
                            <p className="text-xs text-muted">{listing.company?.name ?? 'Empresa no disponible'} · {listing.location ?? 'Sin ubicación'}</p>
                          </td>
                          <td className="px-6 py-4 text-slate-600">{listing.category}</td>
                          <td className="px-6 py-4">
                            <Badge className={listing.status === 'published' ? 'bg-emerald-50 text-emerald-700' : listing.status === 'pending_review' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}>
                              {listing.status}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-slate-500">{dateFormatter.format(new Date(listing.created_at))}</td>
                          <td className="px-6 py-4">
                            {listing.status === 'pending_review' ? (
                              <form action={updateTodoPlasticoListingAction} className="flex gap-2">
                                <input type="hidden" name="id" value={listing.id} />
                                <button name="action" value="approve" className="text-xs font-semibold text-emerald-700">Aprobar</button>
                                <button name="action" value="reject" className="text-xs font-semibold text-rose-600">Rechazar</button>
                              </form>
                            ) : (
                              <span className="text-xs text-muted">Sin acciones</span>
                            )}
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
              {(view === 'empresas' ? data.companies : data.listings).length === 0 ? (
                <p className="px-6 py-10 text-sm text-muted">No hay registros para esta vista.</p>
              ) : null}
            </div>
          </Card>

          <div className="mt-5 flex items-center justify-between text-sm text-muted">
            <span>
              Mostrando {data.totalRows === 0 ? 0 : (data.page - 1) * data.pageSize + 1}-{Math.min(data.page * data.pageSize, data.totalRows)} de {data.totalRows}
            </span>
            <div className="flex gap-2">
              {data.page > 1 ? (
                <Link href={`/paneladmin/todoplastico?view=${view}&status=${status}&q=${encodeURIComponent(q)}&page=${data.page - 1}`} className="rounded-lg border border-line px-3 py-2 font-semibold text-slate-700">
                  Anterior
                </Link>
              ) : null}
              {data.page * data.pageSize < data.totalRows ? (
                <Link href={`/paneladmin/todoplastico?view=${view}&status=${status}&q=${encodeURIComponent(q)}&page=${data.page + 1}`} className="rounded-lg border border-line px-3 py-2 font-semibold text-slate-700">
                  Siguiente
                </Link>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </AdminShell>
  )
}
