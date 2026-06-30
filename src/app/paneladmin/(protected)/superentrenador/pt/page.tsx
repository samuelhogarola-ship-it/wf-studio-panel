import { AdminShell } from '@/components/layout/app-shell'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { TrainerActions } from '@/components/superentrenador/trainer-actions'
import { requireAdmin } from '@/lib/auth'
import { getSuperEntrenadorPTData } from '@/lib/data/superentrenador'
import { getLocale } from '@/lib/locale'

export const dynamic = 'force-dynamic'

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  approved: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-rose-50 text-rose-700',
}
const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente',
  approved: 'Aprobado',
  rejected: 'Rechazado',
}

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const identity = await requireAdmin()
  const locale = await getLocale()
  const { q } = await searchParams
  const { trainers, stats } = await getSuperEntrenadorPTData(q ?? '')

  return (
    <AdminShell
      title="Entrenadores (PT)"
      description="Gestión y revisión de perfiles de entrenadores"
      currentPath="/paneladmin/superentrenador/pt"
      userEmail={identity.email}
      locale={locale}
    >
      <section className="grid gap-4 md:grid-cols-4 mb-8">
        <Card className="p-5">
          <p className="text-sm text-muted">Total</p>
          <p className="mt-3 text-3xl font-black tracking-tight text-foreground">{stats.total}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted">Pendientes</p>
          <p className="mt-3 text-3xl font-black tracking-tight text-amber-600">{stats.pending}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted">Publicados</p>
          <p className="mt-3 text-3xl font-black tracking-tight text-emerald-600">{stats.published}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted">Rechazados</p>
          <p className="mt-3 text-3xl font-black tracking-tight text-rose-600">{stats.rejected}</p>
        </Card>
      </section>

      <form className="mb-6">
        <input
          name="q"
          defaultValue={q ?? ''}
          placeholder="Buscar entrenador…"
          className="w-full max-w-sm rounded-lg border border-line bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
      </form>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-6 py-4">Entrenador</th>
                <th className="px-6 py-4">Ciudad</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4">Valoración</th>
                <th className="px-6 py-4">Precio desde</th>
                <th className="px-6 py-4">Registrado</th>
                <th className="px-6 py-4">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {trainers.map((t) => {
                const status = t.review_status ?? 'pending'
                return (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {t.photo_url ? (
                          <img src={t.photo_url} alt="" className="h-8 w-8 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-slate-200 flex-shrink-0" />
                        )}
                        <div>
                          <p className="font-medium text-foreground">{t.display_name}</p>
                          {t.headline && <p className="text-xs text-muted truncate max-w-[200px]">{t.headline}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{t.city_slug ?? '—'}</td>
                    <td className="px-6 py-4">
                      <Badge className={STATUS_BADGE[status] ?? 'bg-slate-100 text-slate-600'}>
                        {STATUS_LABEL[status] ?? status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {t.rating !== null ? `${t.rating} ⭐ (${t.reviews_count ?? 0})` : '—'}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {t.price_from !== null ? `${t.price_from} €` : '—'}
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {new Date(t.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4">
                      <TrainerActions id={t.id} reviewStatus={t.review_status} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {trainers.length === 0 && (
            <p className="px-6 py-10 text-sm text-muted">No hay entrenadores registrados.</p>
          )}
        </div>
      </Card>
    </AdminShell>
  )
}
