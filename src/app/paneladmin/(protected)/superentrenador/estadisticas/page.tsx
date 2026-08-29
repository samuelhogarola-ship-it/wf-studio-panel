import Link from 'next/link'

import { AdminShell } from '@/components/layout/app-shell'
import { AnalyticsChart } from '@/components/superentrenador/analytics-chart'
import { SuperEntrenadorNav } from '@/components/superentrenador/superentrenador-nav'
import { Card } from '@/components/ui/card'
import { requireAdmin } from '@/lib/auth'
import { parseAnalyticsDays, type DashboardMetric, type UmamiDashboard } from '@/lib/data/umami-core.mjs'
import { getSuperEntrenadorAnalytics } from '@/lib/data/umami'
import { getLocale } from '@/lib/locale'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const FUNNEL_LABELS: Record<string, string> = {
  'contacto-iniciar-sesion': 'Intentos de contacto (login)',
  'contacto-crear-cuenta': 'Intentos de crear cuenta',
  'mensaje-enviado': 'Mensajes enviados',
  'entrenador-publicar-anuncio': 'Intención de publicar',
  'premium-cta': 'Interés en Premium',
}

export default async function Page({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const identity = await requireAdmin()
  const locale = await getLocale()
  const { days: rawDays } = await searchParams
  const days = parseAnalyticsDays(rawDays)
  const result = await getSuperEntrenadorAnalytics(days)

  return (
    <AdminShell
      title="Estadísticas de Superentrenador"
      description="Tráfico, adquisición y conversiones del marketplace"
      currentPath="/paneladmin/superentrenador/estadisticas"
      userEmail={identity.email}
      locale={locale}
    >
      <SuperEntrenadorNav currentPath="/paneladmin/superentrenador/estadisticas" />

      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-foreground">Rendimiento del marketplace</p>
          <p className="mt-1 text-sm text-muted">Compara automáticamente con el periodo anterior.</p>
        </div>
        <nav aria-label="Periodo de estadísticas" className="flex rounded-lg bg-slate-100 p-1">
          {[7, 30, 90].map((period) => (
            <Link
              key={period}
              href={`/paneladmin/superentrenador/estadisticas?days=${period}`}
              aria-current={days === period ? 'page' : undefined}
              className={cn(
                'rounded-md px-3 py-2 text-xs font-semibold transition',
                days === period ? 'bg-white text-foreground shadow-sm' : 'text-muted hover:text-foreground',
              )}
            >
              {period} días
            </Link>
          ))}
        </nav>
      </div>

      {result.status === 'not-configured' ? (
        <Card className="border-amber-200 bg-amber-50 p-6">
          <p className="font-semibold text-amber-900">Umami todavía no está conectado</p>
          <p className="mt-2 text-sm leading-6 text-amber-800">Añade estas variables de servidor en Coolify y vuelve a desplegar:</p>
          <code className="mt-3 block text-xs text-amber-900">{result.missing.join(', ')}</code>
        </Card>
      ) : result.status === 'error' ? (
        <Card className="border-rose-200 bg-rose-50 p-6">
          <p className="font-semibold text-rose-900">No se pudieron cargar las estadísticas</p>
          <p className="mt-2 text-sm text-rose-800">{result.message} Recarga la página para reintentar.</p>
        </Card>
      ) : (
        <Dashboard data={result.data} />
      )}
    </AdminShell>
  )
}

function Dashboard({ data }: { data: UmamiDashboard }) {
  const cards: { label: string; metric: DashboardMetric; suffix?: string; format?: (value: number) => string }[] = [
    { label: 'Visitantes', metric: data.summary.visitors },
    { label: 'Visitas', metric: data.summary.visits },
    { label: 'Páginas vistas', metric: data.summary.pageviews },
    { label: 'Tasa de rebote', metric: data.summary.bounceRate, suffix: '%' },
    { label: 'Tiempo medio', metric: data.summary.averageVisitSeconds, format: formatDuration },
  ]

  return (
    <>
      <section aria-label="Métricas principales" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map(({ label, metric, suffix, format }) => (
          <Card key={label} className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">{label}</p>
            <p className="mt-3 text-3xl font-black tracking-tight text-foreground">{format ? format(metric.value) : metric.value.toLocaleString('es-ES')}{suffix}</p>
            <p className={cn('mt-2 text-xs font-semibold', metric.trend.startsWith('+') || metric.trend === 'Nuevo' ? 'text-emerald-600' : metric.trend.startsWith('-') ? 'text-rose-600' : 'text-muted')}>
              {metric.trend} <span className="font-normal text-muted">vs. periodo anterior</span>
            </p>
          </Card>
        ))}
      </section>

      <Card className="mt-6 p-5 sm:p-6">
        <h2 className="font-bold text-foreground">Evolución diaria</h2>
        <p className="mt-1 text-sm text-muted">Páginas vistas y visitas durante los últimos {data.days} días.</p>
        <div className="mt-6"><AnalyticsChart pageviews={data.series.pageviews} visits={data.series.visits} /></div>
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <MetricList title="Conversiones" items={Object.entries(FUNNEL_LABELS).map(([key, label]) => ({ x: label, y: data.funnel[key] ?? 0 }))} empty="No se han registrado conversiones." />
        <MetricList title="Páginas principales" items={data.topPages} empty="No hay páginas registradas." />
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-3">
        <MetricList title="Fuentes de tráfico" items={data.referrers} empty="Sin fuentes de tráfico." fallbackLabel="Directo" />
        <MetricList title="Países" items={data.countries} empty="Sin países registrados." fallbackLabel="Desconocido" />
        <DeviceList items={data.devices} />
      </div>

      <p className="mt-6 text-xs text-muted">Datos de Umami sin cookies · Actualizado {new Date(data.generatedAt).toLocaleString('es-ES')}</p>
    </>
  )
}

function MetricList({ title, items, empty, fallbackLabel = 'Sin identificar' }: { title: string; items: { x: string; y: number }[]; empty: string; fallbackLabel?: string }) {
  return (
    <Card className="p-5">
      <h2 className="font-bold text-foreground">{title}</h2>
      {items.length ? (
        <ol className="mt-4 divide-y divide-line">
          {items.map((item) => (
            <li key={`${item.x}-${item.y}`} className="flex items-center justify-between gap-4 py-2.5 text-sm">
              <span className="min-w-0 truncate text-slate-600">{item.x || fallbackLabel}</span>
              <span className="font-bold text-foreground">{item.y.toLocaleString('es-ES')}</span>
            </li>
          ))}
        </ol>
      ) : <p className="mt-4 text-sm text-muted">{empty}</p>}
    </Card>
  )
}

function DeviceList({ items }: { items: { x: string; y: number }[] }) {
  const total = items.reduce((sum, item) => sum + item.y, 0)
  return (
    <Card className="p-5">
      <h2 className="font-bold text-foreground">Dispositivos</h2>
      {items.length ? <div className="mt-4 space-y-4">{items.map((item) => {
        const percent = total ? Math.round((item.y / total) * 100) : 0
        return <div key={item.x || 'unknown'}>
          <div className="flex justify-between gap-3 text-sm"><span className="capitalize text-slate-600">{item.x || 'Otro'}</span><strong>{percent}%</strong></div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand" style={{ width: `${percent}%` }} /></div>
        </div>
      })}</div> : <p className="mt-4 text-sm text-muted">Sin dispositivos registrados.</p>}
    </Card>
  )
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}
