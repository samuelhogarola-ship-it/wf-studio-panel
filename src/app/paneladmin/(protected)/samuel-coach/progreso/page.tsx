import { AdminShell } from '@/components/layout/app-shell'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { requireAdmin } from '@/lib/auth'
import { getProgresoData } from '@/lib/data/samuel-coach'
import { getLocale } from '@/lib/locale'

export const dynamic = 'force-dynamic'

const NIVEL_LABELS: Record<string, string> = { a1: 'A1', a2: 'A2', b1: 'B1', b2: 'B2', c1: 'C1' }
const TYPE_LABELS: Record<string, string> = {
  lueckentext: 'Lückentext',
  leseverstehen: 'Leseverstehen',
  hoerverstehen: 'Hörverstehen',
  schreiben: 'Schreiben',
  sprachbausteine: 'Sprachbausteine',
}

export default async function Page() {
  const identity = await requireAdmin()
  const locale = await getLocale()
  const data = await getProgresoData()

  return (
    <AdminShell
      title="Progreso alumnos"
      description="Actividad y puntuaciones de los alumnos"
      currentPath="/paneladmin/samuel-coach/progreso"
      userEmail={identity.email}
      locale={locale}
    >
      <section className="grid gap-4 md:grid-cols-3 mb-8">
        <Card className="p-5">
          <p className="text-sm text-muted">Ejercicios completados</p>
          <p className="mt-3 text-3xl font-black tracking-tight text-foreground">{data.stats.totalAttempts}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted">Nota media global</p>
          <p className="mt-3 text-3xl font-black tracking-tight text-foreground">
            {data.stats.avgScore !== null ? `${data.stats.avgScore}%` : '—'}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted">Alumnos activos</p>
          <p className="mt-3 text-3xl font-black tracking-tight text-foreground">{data.stats.activeUsers}</p>
        </Card>
      </section>

      <h2 className="mb-4 text-base font-bold text-foreground">Progreso por nivel y tipo</h2>
      <Card className="overflow-hidden mb-8">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-6 py-4">Nivel</th>
                <th className="px-6 py-4">Tipo</th>
                <th className="px-6 py-4">Alumnos</th>
                <th className="px-6 py-4">Completados</th>
                <th className="px-6 py-4">Nota media</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.progress.map((row, i) => {
                const pct = row.average_score !== null ? Math.round(row.average_score) : null
                return (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                        {NIVEL_LABELS[row.nivel] ?? row.nivel}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{TYPE_LABELS[row.exercise_type] ?? row.exercise_type}</td>
                    <td className="px-6 py-4 text-slate-600">{row.user_count}</td>
                    <td className="px-6 py-4 text-slate-600">{row.completed_activities}</td>
                    <td className="px-6 py-4">
                      {pct !== null ? (
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 rounded-full bg-slate-200 overflow-hidden">
                            <div className="h-full rounded-full bg-teal-500 transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs font-semibold text-slate-700">{pct}%</span>
                        </div>
                      ) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {data.progress.length === 0 && (
            <p className="px-6 py-10 text-sm text-muted">Todavía no hay datos de progreso.</p>
          )}
        </div>
      </Card>

      <h2 className="mb-4 text-base font-bold text-foreground">Últimos ejercicios</h2>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-6 py-4">Alumno</th>
                <th className="px-6 py-4">Tipo</th>
                <th className="px-6 py-4">Puntuación</th>
                <th className="px-6 py-4">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.recentAttempts.map((attempt, i) => {
                const pct = attempt.max_score > 0 ? Math.round((attempt.score / attempt.max_score) * 100) : null
                return (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-slate-500 text-xs">{attempt.user_id.slice(0, 8)}…</td>
                    <td className="px-6 py-4 text-slate-600">{TYPE_LABELS[attempt.exercise_type] ?? attempt.exercise_type ?? '—'}</td>
                    <td className="px-6 py-4">
                      {pct !== null ? (
                        <Badge className={pct >= 70 ? 'bg-emerald-50 text-emerald-700' : pct >= 50 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}>
                          {attempt.score}/{attempt.max_score} ({pct}%)
                        </Badge>
                      ) : '—'}
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {new Date(attempt.completed_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {data.recentAttempts.length === 0 && (
            <p className="px-6 py-10 text-sm text-muted">Todavía no hay ejercicios completados.</p>
          )}
        </div>
      </Card>
    </AdminShell>
  )
}
