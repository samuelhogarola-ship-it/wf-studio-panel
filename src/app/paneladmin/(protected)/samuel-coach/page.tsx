import Link from 'next/link'

import { ProjectAnalyticsPanel } from '@/components/analytics/project-analytics-panel'
import { AdminShell } from '@/components/layout/app-shell'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { requireAdmin } from '@/lib/auth'
import { getSamuelCoachData } from '@/lib/data/samuel-coach'
import { togglePublishAction } from '@/lib/actions/samuel-coach'
import { getLocale } from '@/lib/locale'

export const dynamic = 'force-dynamic'

const NIVEL_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1']
const TYPE_LABELS: Record<string, string> = {
  lueckentext_type1: 'Typ 1',
  lueckentext_type2: 'Typ 2',
}

export default async function SamuelCoachAdminPage() {
  const identity = await requireAdmin()
  const locale = await getLocale()
  const data = await getSamuelCoachData()

  return (
    <AdminShell
      title="Prüfungsvorbereitung"
      description="Gestión de textos y ejercicios para el examen"
      currentPath="/paneladmin/samuel-coach"
      userEmail={identity.email}
      locale={locale}
    >
      {/* Stats */}
      <section className="grid gap-4 md:grid-cols-4 mb-8">
        {[
          { label: 'Textos publicados', value: data.published },
          { label: 'Textos totales', value: data.total },
          { label: 'Typ 1 (selección)', value: data.byType['lueckentext_type1'] ?? 0 },
          { label: 'Typ 2 (libre)', value: data.byType['lueckentext_type2'] ?? 0 },
        ].map((s) => (
          <Card key={s.label} className="p-6">
            <p className="text-sm text-muted">{s.label}</p>
            <p className="mt-4 text-3xl font-black tracking-tight text-foreground">{s.value}</p>
          </Card>
        ))}
      </section>

      <ProjectAnalyticsPanel
        projectKey="samuelcoachdealeman"
        projectLabel="Samuel Coach de Alemán"
        domain="samuelcoachdealeman.com"
      />

      <section className="mb-8">
        <Link
          href="/paneladmin/samuel-coach/informes"
          className="block rounded-lg border border-line bg-white p-6 transition hover:border-brand/40 hover:shadow-sm"
        >
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-brand">Mini classroom</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-foreground">Informes de alumnos</h2>
              <p className="mt-2 max-w-2xl text-sm text-muted">
                Acceso rápido al generador de informes con alumnos, borradores y seguimiento guardado.
              </p>
            </div>
            <span className="inline-flex w-fit items-center rounded px-4 py-2 text-sm font-bold text-white bg-brand">
              Abrir en el panel
            </span>
          </div>
        </Link>
      </section>

      {/* By nivel */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted mb-3">Por nivel</h2>
        <div className="flex gap-3 flex-wrap">
          {NIVEL_ORDER.filter((n) => data.byNivel[n]).map((n) => (
            <div key={n} className="flex items-center gap-2 rounded-full bg-brand/10 px-4 py-2">
              <span className="font-black text-brand">{n}</span>
              <span className="text-sm text-muted">{data.byNivel[n]} ejercicios</span>
            </div>
          ))}
        </div>
      </section>

      {/* Text list */}
      <section>
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-6 py-5">
            <div>
              <h2 className="text-xl font-bold text-foreground">Todos los textos</h2>
              <p className="text-sm text-muted">{data.total} textos · clic en el toggle para publicar/ocultar</p>
            </div>
          </div>
          <div className="divide-y divide-line">
            {data.rows.map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-4 px-6 py-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs font-bold w-7 text-center rounded bg-slate-100 py-1 text-slate-500 shrink-0">{row.nivel}</span>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">{row.titulo}</p>
                    <p className="text-xs text-muted truncate">{row.descripcion}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="hidden sm:inline text-xs text-muted">
                    {row.exercise
                      ? `${TYPE_LABELS[row.exercise.exercise_type] ?? row.exercise.exercise_type}${row.exercise.gap_count > 0 ? ` · ${row.exercise.gap_count} huecos` : ''}`
                      : '—'}
                    {row.questionCount > 0 ? ` · ${row.questionCount} preguntas` : ''}
                  </span>
                  <Badge className={row.is_published ? 'bg-green-100 text-green-700 border-green-200' : 'bg-slate-100 text-slate-500 border-slate-200'}>
                    {row.is_published ? 'Publicado' : 'Borrador'}
                  </Badge>
                  <form action={togglePublishAction}>
                    <input type="hidden" name="textId" value={row.id} />
                    <input type="hidden" name="current" value={String(row.is_published ?? false)} />
                    <button
                      type="submit"
                      className="rounded px-3 py-1.5 text-xs font-semibold border border-line text-slate-600 hover:bg-slate-100 transition"
                    >
                      {row.is_published ? 'Ocultar' : 'Publicar'}
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </AdminShell>
  )
}
