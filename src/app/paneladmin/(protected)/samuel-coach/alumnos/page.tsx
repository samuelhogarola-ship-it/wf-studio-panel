import { AdminShell } from '@/components/layout/app-shell'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { requireAdmin } from '@/lib/auth'
import { getAlumnosData } from '@/lib/data/samuel-coach'
import { getLocale } from '@/lib/locale'
import { formatDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const BASE = '/paneladmin/samuel-coach/alumnos'

const APP_LABELS: Record<string, string> = {
  samuel_coach: 'Samuel Coach',
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const identity = await requireAdmin()
  const params = await searchParams
  const locale = await getLocale()
  const data = await getAlumnosData(params.q ?? '')

  return (
    <AdminShell
      title="Alumnos"
      description="Usuarios registrados en Samuel Coach de Alemán"
      currentPath="/paneladmin/samuel-coach/alumnos"
      userEmail={identity.email}
      locale={locale}
    >
      <section className="grid gap-4 md:grid-cols-2 mb-8">
        <Card className="p-5">
          <p className="text-sm text-muted">Total alumnos</p>
          <p className="mt-3 text-3xl font-black tracking-tight text-foreground">{data.total}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted">Con membresía activa</p>
          <p className="mt-3 text-3xl font-black tracking-tight text-foreground">{data.active}</p>
        </Card>
      </section>

      <div className="mb-6">
        <form action={BASE}>
          <input
            type="search"
            name="q"
            defaultValue={params.q ?? ''}
            placeholder="Buscar por nombre o email…"
            className="h-8 rounded-full border border-line bg-white px-3 text-xs text-foreground outline-none focus:border-brand"
          />
        </form>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-6 py-4">Alumno</th>
                <th className="px-6 py-4">Idioma</th>
                <th className="px-6 py-4">Membresías</th>
                <th className="px-6 py-4">Alta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.alumnos.map((alumno) => (
                <tr key={alumno.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-semibold text-foreground">{alumno.full_name || '—'}</p>
                    <p className="text-xs text-slate-400">{alumno.email}</p>
                  </td>
                  <td className="px-6 py-4 text-slate-500 uppercase text-xs">{alumno.locale || '—'}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {alumno.memberships.length === 0 ? (
                        <span className="text-xs text-muted">Ninguna</span>
                      ) : (
                        alumno.memberships.map((m, i) => (
                          <Badge
                            key={i}
                            className={m.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}
                          >
                            {APP_LABELS[m.app_key] ?? m.app_key}
                          </Badge>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-500">{formatDate(alumno.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.alumnos.length === 0 && (
            <p className="px-6 py-10 text-sm text-muted">
              {params.q ? 'No hay resultados para esta búsqueda.' : 'Todavía no hay alumnos registrados.'}
            </p>
          )}
        </div>
      </Card>
    </AdminShell>
  )
}
