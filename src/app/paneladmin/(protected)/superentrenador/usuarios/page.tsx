import { AdminShell } from '@/components/layout/app-shell'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { requireAdmin } from '@/lib/auth'
import { getSuperEntrenadorUsuariosData } from '@/lib/data/superentrenador'
import { getLocale } from '@/lib/locale'

export const dynamic = 'force-dynamic'

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const identity = await requireAdmin()
  const locale = await getLocale()
  const { q } = await searchParams
  const { users, stats } = await getSuperEntrenadorUsuariosData(q ?? '')

  return (
    <AdminShell
      title="Usuarios"
      description="Usuarios registrados en Superentrenador"
      currentPath="/paneladmin/superentrenador/usuarios"
      userEmail={identity.email}
      locale={locale}
    >
      <section className="grid gap-4 md:grid-cols-3 mb-8">
        <Card className="p-5">
          <p className="text-sm text-muted">Total registrados</p>
          <p className="mt-3 text-3xl font-black tracking-tight text-foreground">{stats.total}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted">Email confirmado</p>
          <p className="mt-3 text-3xl font-black tracking-tight text-emerald-600">{stats.confirmed}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted">Sin confirmar</p>
          <p className="mt-3 text-3xl font-black tracking-tight text-amber-600">{stats.unconfirmed}</p>
        </Card>
      </section>

      <form className="mb-6">
        <input
          name="q"
          defaultValue={q ?? ''}
          placeholder="Buscar por email o nombre…"
          className="w-full max-w-sm rounded-lg border border-line bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
      </form>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-6 py-4">Usuario</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4">Último acceso</th>
                <th className="px-6 py-4">Registrado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {users.map((u) => {
                const name = (u.user_metadata?.full_name as string | undefined) ?? null
                const isConfirmed = !!u.confirmed_at
                return (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-foreground">{name ?? <span className="text-muted italic">Sin nombre</span>}</p>
                        <p className="text-xs text-muted">{u.id.slice(0, 8)}…</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{u.email ?? '—'}</td>
                    <td className="px-6 py-4">
                      <Badge className={isConfirmed ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}>
                        {isConfirmed ? 'Confirmado' : 'Pendiente'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {u.last_sign_in_at
                        ? new Date(u.last_sign_in_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
                        : '—'}
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {new Date(u.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {users.length === 0 && (
            <p className="px-6 py-10 text-sm text-muted">No hay usuarios registrados.</p>
          )}
        </div>
      </Card>
    </AdminShell>
  )
}
