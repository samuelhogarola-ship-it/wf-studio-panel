'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { createRequestCoordinator, mergeSummaryRefresh } from '@/lib/analytics/umami-dashboard.mjs'
import type {
  AnalyticsConfigurationError,
  AnalyticsBreakdownRow,
  AnalyticsDashboard,
  AnalyticsEventOption,
  AnalyticsMarket,
  AnalyticsOption,
  AnalyticsPeriod,
  MetricRow,
  MetricValue,
  SessionRow,
  TimeSeriesRow,
} from '@/lib/analytics/umami-dashboard.mjs'

type DashboardResponse = AnalyticsDashboard | AnalyticsConfigurationError
type AnalyticsTab = 'content' | 'acquisition' | 'audience' | 'technology' | 'events' | 'sessions'

const HISTORY_PERIODS: Array<{ key: AnalyticsPeriod; label: string }> = [
  { key: '7d', label: '7 días' },
  { key: '30d', label: '30 días' },
  { key: '90d', label: '90 días' },
  { key: '6m', label: '6 meses' },
  { key: '12m', label: '1 año' },
]

const TAB_LABELS: Array<{ key: AnalyticsTab; label: string }> = [
  { key: 'content', label: 'Contenido' },
  { key: 'acquisition', label: 'Adquisición' },
  { key: 'audience', label: 'Audiencia' },
  { key: 'technology', label: 'Tecnología' },
  { key: 'events', label: 'Eventos' },
  { key: 'sessions', label: 'Sesiones' },
]

const METRIC_GROUPS: Record<AnalyticsTab, Array<{ key: string; label: string }>> = {
  content: [
    { key: 'pages', label: 'Páginas principales' },
    { key: 'entries', label: 'Páginas de entrada' },
    { key: 'exits', label: 'Páginas de salida' },
    { key: 'titles', label: 'Títulos de página' },
    { key: 'queries', label: 'Consultas de URL' },
  ],
  acquisition: [
    { key: 'referrers', label: 'Referencias' },
    { key: 'channels', label: 'Canales' },
    { key: 'domains', label: 'Dominios de origen' },
    { key: 'hostnames', label: 'Hosts registrados' },
  ],
  audience: [
    { key: 'countries', label: 'Países' },
    { key: 'regions', label: 'Regiones' },
    { key: 'cities', label: 'Ciudades' },
    { key: 'languages', label: 'Idioma del navegador' },
  ],
  technology: [
    { key: 'devices', label: 'Dispositivos' },
    { key: 'browsers', label: 'Navegadores' },
    { key: 'operatingSystems', label: 'Sistemas operativos' },
    { key: 'screens', label: 'Resoluciones de pantalla' },
  ],
  events: [
    { key: 'events', label: 'Eventos registrados' },
  ],
  sessions: [],
}

export function ProjectAnalyticsPanel({
  projectKey,
  projectLabel,
  domain,
  marketOptions = [],
  sectionId = 'estadisticas',
}: {
  projectKey: string
  projectLabel: string
  domain: string
  marketOptions?: ReadonlyArray<AnalyticsMarket>
  sectionId?: string
}) {
  const [period, setPeriod] = useState<AnalyticsPeriod>('live')
  const [historyPeriod, setHistoryPeriod] = useState<AnalyticsPeriod>('30d')
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('content')
  const [market, setMarket] = useState<AnalyticsMarket['key']>(marketOptions[0]?.key || 'all')
  const [section, setSection] = useState('')
  const [contentLanguage, setContentLanguage] = useState('')
  const [device, setDevice] = useState('')
  const [source, setSource] = useState('')
  const [event, setEvent] = useState('')
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const coordinatorRef = useRef<ReturnType<typeof createRequestCoordinator> | null>(null)
  if (!coordinatorRef.current) coordinatorRef.current = createRequestCoordinator()

  const loadDashboard = useCallback(async (
    selectedPeriod: AnalyticsPeriod,
    { summaryOnly = false }: { summaryOnly?: boolean } = {},
  ) => {
    const request = coordinatorRef.current!.next()
    if (!summaryOnly) setLoading(true)
    setError(null)
    try {
      const query = new URLSearchParams({ period: selectedPeriod })
      if (summaryOnly) query.set('summary', '1')
      if (marketOptions.length) query.set('market', market)
      if (section) query.set('section', section)
      if (contentLanguage) query.set('language', contentLanguage)
      if (device) query.set('device', device)
      if (source) query.set('source', source)
      if (event) query.set('event', event)
      const response = await fetch(`/api/analytics/${projectKey}?${query}`, {
        credentials: 'same-origin',
        cache: 'no-store',
        signal: request.signal,
      })
      const payload = await response.json() as DashboardResponse & { message?: string }
      if (!response.ok) throw new Error(payload.message || `Error ${response.status}`)
      if (!request.isLatest()) return
      setDashboard((current) => {
        if (summaryOnly && current?.status === 'ok' && payload.status === 'ok') {
          return mergeSummaryRefresh(current, payload)
        }
        return payload
      })
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return
      if (request.isLatest()) {
        setError(cause instanceof Error ? cause.message : 'No se pudieron cargar las estadísticas.')
      }
    } finally {
      if (request.isLatest() && !summaryOnly) setLoading(false)
    }
  }, [contentLanguage, device, event, market, marketOptions.length, projectKey, section, source])

  useEffect(() => {
    void loadDashboard(period)
    return () => coordinatorRef.current?.abort()
  }, [loadDashboard, period])

  useEffect(() => {
    if (period !== 'live') return
    const interval = window.setInterval(() => void loadDashboard('live', { summaryOnly: true }), 60_000)
    return () => window.clearInterval(interval)
  }, [loadDashboard, period])

  const selectLive = () => setPeriod('live')
  const selectHistory = () => setPeriod(historyPeriod)
  const selectHistoryPeriod = (next: AnalyticsPeriod) => {
    setHistoryPeriod(next)
    setPeriod(next)
  }

  const okDashboard = dashboard?.status === 'ok' ? dashboard : null
  const dimensions = okDashboard?.dimensions
  const sourceOptions = Array.from(new Set([
    ...(source ? [source] : []),
    ...(okDashboard?.metrics.referrers || [])
      .map(row => row.x || '')
      .filter(value => /^[a-z0-9](?:[a-z0-9.-]{0,118}[a-z0-9])?$/i.test(value)),
  ])).slice(0, 25)
  const activeFilters: Array<{ key: string; label: string }> = []
  const pushOption = (key: string, prefix: string, value: string, options: ReadonlyArray<AnalyticsOption> = []) => {
    const option = options.find(item => item.key === value)
    if (option) activeFilters.push({ key, label: `${prefix}: ${option.label}` })
  }
  if (market !== 'all') pushOption('market', 'Mercado', market, marketOptions)
  pushOption('section', 'Sección', section, dimensions?.sections)
  pushOption('language', 'Idioma del contenido', contentLanguage, dimensions?.contentLanguages)
  pushOption('device', 'Dispositivo', device, dimensions?.devices)
  if (source) activeFilters.push({ key: 'source', label: `Fuente: ${source}` })
  pushOption('event', 'Evento', event, dimensions?.events)
  const resetFilters = () => {
    setMarket(marketOptions[0]?.key || 'all')
    setSection('')
    setContentLanguage('')
    setDevice('')
    setSource('')
    setEvent('')
  }

  return (
    <section id={sectionId} className="mb-10 scroll-mt-6" aria-labelledby={`${projectKey}-analytics-title`}>
      <div className="border-y border-line bg-white">
        <div className="flex flex-col gap-4 border-b border-line px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 id={`${projectKey}-analytics-title`} className="text-xl font-extrabold text-foreground">
                Estadísticas de {projectLabel}
              </h2>
              {okDashboard?.activeVisitors !== null && okDashboard ? (
                <span className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
                  {okDashboard.activeVisitors} ahora
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-muted">{domain} · datos de tráfico</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-md border border-line bg-slate-50 p-1" aria-label="Modo de estadísticas">
              <button
                type="button"
                onClick={selectLive}
                className={`rounded px-3 py-2 text-xs font-bold ${period === 'live' ? 'bg-white text-foreground shadow-sm' : 'text-muted'}`}
              >
                En vivo
              </button>
              <button
                type="button"
                onClick={selectHistory}
                className={`rounded px-3 py-2 text-xs font-bold ${period !== 'live' ? 'bg-white text-foreground shadow-sm' : 'text-muted'}`}
              >
                Histórico
              </button>
            </div>
            <button
              type="button"
              onClick={() => void loadDashboard(period)}
              disabled={loading}
              className="rounded-md border border-line bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {loading ? 'Actualizando…' : 'Actualizar'}
            </button>
          </div>
        </div>

        {marketOptions.length ? (
          <div className="border-b border-line px-5 py-4">
            <p className="mb-2 text-[11px] font-black uppercase tracking-[0.16em] text-muted">Mercado por ruta</p>
            <div className="flex gap-2 overflow-x-auto" role="group" aria-label="Filtrar estadísticas por mercado">
              {marketOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  aria-pressed={market === option.key}
                  onClick={() => setMarket(option.key)}
                  className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold transition ${market === option.key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">
              Un único total de Umami, desglosado por las rutas publicadas para cada mercado.
            </p>
          </div>
        ) : null}

        {dimensions ? (
          <div className="border-b border-line bg-slate-50/60 px-5 py-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-foreground">Explorador SEO y de calidad</h3>
                <p className="mt-1 text-xs text-muted">Combina dimensiones aprobadas; todos los filtros se aplican a la vez.</p>
              </div>
              {activeFilters.length ? (
                <button type="button" onClick={resetFilters} className="text-xs font-bold text-brand hover:underline">
                  Limpiar filtros
                </button>
              ) : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <AnalyticsSelect label="Sección" value={section} onChange={setSection} options={dimensions.sections} />
              <AnalyticsSelect label="Idioma del contenido" value={contentLanguage} onChange={setContentLanguage} options={dimensions.contentLanguages} />
              <AnalyticsSelect label="Dispositivo" value={device} onChange={setDevice} options={dimensions.devices} />
              <label className="text-xs font-bold text-slate-700">
                Fuente / referencia
                <select value={source} onChange={e => setSource(e.target.value)} className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 font-medium">
                  <option value="">Todas</option>
                  {sourceOptions.map(value => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              <label className="text-xs font-bold text-slate-700">
                Evento
                <select value={event} onChange={e => setEvent(e.target.value)} className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 font-medium">
                  <option value="">Todos</option>
                  <optgroup label="Eventos comerciales">
                    {dimensions.events.filter(option => option.category !== 'engagement').map(option => (
                      <option key={option.key} value={option.key}>{option.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Hitos de permanencia">
                    {dimensions.events.filter(option => option.category === 'engagement').map(option => (
                      <option key={option.key} value={option.key}>{option.label}</option>
                    ))}
                  </optgroup>
                </select>
              </label>
            </div>
            {activeFilters.length ? (
              <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="Filtros activos">
                <span className="text-[11px] font-black uppercase tracking-wider text-muted">Filtros activos</span>
                {activeFilters.map(filter => (
                  <span key={filter.key} className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-bold text-white">{filter.label}</span>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {period !== 'live' ? (
          <div className="flex gap-1 overflow-x-auto border-b border-line px-5 py-3" aria-label="Rango histórico">
            {HISTORY_PERIODS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => selectHistoryPeriod(item.key)}
                className={`whitespace-nowrap rounded-md px-3 py-2 text-xs font-semibold ${period === item.key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        ) : null}

        {error ? <StatusMessage title="No se pudieron cargar las estadísticas" message={error} /> : null}
        {dashboard?.status === 'configuration_error' ? (
          <StatusMessage title="Estadísticas pendientes de configuración" message={dashboard.message} />
        ) : null}

        {okDashboard ? (
          <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'} aria-busy={loading}>
            <div className="grid border-b border-line sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
              <SummaryCell label="Páginas vistas" metric={okDashboard.summary.pageviews} />
              <SummaryCell label="Visitantes" metric={okDashboard.summary.visitors} />
              <SummaryCell label="Visitas" metric={okDashboard.summary.visits} />
              <SummaryCell label="Páginas / visita" metric={okDashboard.summary.pagesPerVisit} decimals={2} />
              <SummaryCell label="Rebote" metric={okDashboard.summary.bounceRate} suffix="%" decimals={1} inverse />
              <SummaryCell label="Tiempo / visita" metric={okDashboard.summary.averageVisitSeconds} format="duration" />
              <SummaryCell label="Eventos / conversiones" metric={okDashboard.summary.events} />
              <SummaryCell label="Tiempo total" metric={okDashboard.summary.totalTime} format="duration" />
            </div>

            {(okDashboard.breakdowns?.sections.length || okDashboard.breakdowns?.contentLanguages.length) ? (
              <div className="grid border-b border-line xl:grid-cols-2">
                <BreakdownTable title="Resumen por sección" rows={okDashboard.breakdowns.sections} />
                <BreakdownTable title="Idioma del contenido" rows={okDashboard.breakdowns.contentLanguages} />
              </div>
            ) : null}

            <div className="border-b border-line px-5 py-6">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-foreground">Evolución de tráfico</h3>
                  <p className="text-xs text-muted">{okDashboard.range.label}</p>
                </div>
                <div className="flex gap-4 text-xs text-muted">
                  <span className="flex items-center gap-2"><span className="h-0.5 w-5 bg-blue-600" />Páginas vistas</span>
                  <span className="flex items-center gap-2"><span className="h-0.5 w-5 bg-emerald-600" />Visitantes</span>
                </div>
              </div>
              <TrendChart pageviews={okDashboard.series.pageviews} visitors={okDashboard.series.visitors} />
            </div>

            <div className="border-b border-line px-5 pt-4">
              <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Desglose estadístico">
                {TAB_LABELS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`whitespace-nowrap border-b-2 px-3 py-3 text-xs font-bold ${activeTab === tab.key ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-foreground'}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {activeTab === 'sessions' ? (
              <SessionTable rows={okDashboard.sessions || []} available={okDashboard.sessionsAvailable} />
            ) : activeTab === 'events' ? (
              <EventQualityView rows={okDashboard.metrics.events || []} options={okDashboard.dimensions.events || []} />
            ) : (
              <div className="grid gap-px bg-line md:grid-cols-2 xl:grid-cols-3">
                {METRIC_GROUPS[activeTab].map((group) => (
                  <MetricList
                    key={group.key}
                    title={group.label}
                    rows={okDashboard.metrics[group.key] || []}
                    expandable={group.key === 'pages'}
                    showPercentage={['pages', 'referrers', 'channels', 'devices'].includes(group.key)}
                  />
                ))}
              </div>
            )}

            <div className="border-t border-line px-5 py-3 text-right text-[11px] text-muted">
              Actualizado {new Date(okDashboard.generatedAt).toLocaleString('es-ES')}
            </div>
          </div>
        ) : null}

        {!dashboard && !error ? (
          <div className="px-5 py-14 text-center text-sm text-muted">Cargando estadísticas…</div>
        ) : null}
      </div>
    </section>
  )
}

function AnalyticsSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: ReadonlyArray<AnalyticsOption>
}) {
  return (
    <label className="text-xs font-bold text-slate-700">
      {label}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 font-medium"
      >
        <option value="">Todos</option>
        {options.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
      </select>
    </label>
  )
}

function BreakdownTable({ title, rows }: { title: string; rows: AnalyticsBreakdownRow[] }) {
  const totalPageviews = rows.reduce((total, row) => total + (row.status === 'ok' ? row.pageviews || 0 : 0), 0)
  return (
    <div className="min-w-0 border-b border-line bg-white px-5 py-5 xl:border-b-0 xl:border-r">
      <h3 className="text-sm font-black text-foreground">{title}</h3>
      <p className="mt-1 text-[11px] text-muted">Páginas vistas · % del total · calidad de visita</p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-xs">
          <thead className="border-b border-line text-muted">
            <tr>
              <th className="py-2 pr-3 font-bold">Dimensión</th>
              <th className="px-3 py-2 text-right font-bold">Páginas vistas</th>
              <th className="px-3 py-2 text-right font-bold">Visitantes</th>
              <th className="px-3 py-2 text-right font-bold">Páginas / visita</th>
              <th className="pl-3 py-2 text-right font-bold">Tiempo / visita</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map(row => (
              <tr key={row.key}>
                <th scope="row" className="py-3 pr-3 font-bold text-foreground">{row.label}</th>
                {row.status === 'unavailable' ? (
                  <td colSpan={4} className="px-3 py-3 text-right font-semibold text-amber-700">No disponible</td>
                ) : (
                  <>
                    <td className="px-3 py-3 text-right font-bold text-foreground">
                      {formatNumber(row.pageviews || 0)} · {formatNumber(totalPageviews ? (row.pageviews || 0) / totalPageviews * 100 : 0, 1)}%
                    </td>
                    <td className="px-3 py-3 text-right text-slate-700">{formatNumber(row.visitors || 0)}</td>
                    <td className="px-3 py-3 text-right text-slate-700">{formatNumber(row.pagesPerVisit || 0, 2)}</td>
                    <td className="pl-3 py-3 text-right text-slate-700">{formatDuration(row.averageVisitSeconds || 0)}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function EventQualityView({ rows, options }: { rows: MetricRow[]; options: ReadonlyArray<AnalyticsEventOption> }) {
  const eventRows = (category: string) => {
    const labels = new Map(options
      .filter(option => category === 'engagement' ? option.category === 'engagement' : option.category !== 'engagement')
      .map(option => [option.key, option.label]))
    return rows
      .filter(row => row.x && labels.has(row.x))
      .map(row => ({ ...row, x: labels.get(row.x!) || row.x }))
  }
  return (
    <div className="grid gap-px bg-line md:grid-cols-2">
      <MetricList title="Eventos comerciales" rows={eventRows('commercial')} showPercentage />
      <div className="bg-white">
        <MetricList title="Hitos de permanencia alcanzados" rows={eventRows('engagement')} showPercentage />
        <p className="px-5 pb-5 text-[11px] leading-5 text-muted">
          Cada hito indica que la visita alcanzó al menos ese umbral; no representa el momento exacto de salida.
        </p>
      </div>
    </div>
  )
}

function SummaryCell({
  label,
  metric,
  suffix = '',
  decimals = 0,
  format = 'number',
  inverse = false,
}: {
  label: string
  metric: MetricValue
  suffix?: string
  decimals?: number
  format?: 'number' | 'duration'
  inverse?: boolean
}) {
  const value = format === 'duration' ? formatDuration(metric.value) : formatNumber(metric.value, decimals) + suffix
  const change = metric.changePercent
  const positive = change !== null && (inverse ? change < 0 : change > 0)
  const negative = change !== null && (inverse ? change > 0 : change < 0)

  return (
    <div className="min-w-0 border-b border-r border-line px-4 py-5 sm:[&:nth-last-child(-n+2)]:border-b-0 xl:border-b-0">
      <p className="truncate text-xs font-semibold text-muted" title={label}>{label}</p>
      <p className="mt-2 text-2xl font-black text-foreground">{value}</p>
      <p className={`mt-1 text-[11px] font-semibold ${positive ? 'text-emerald-700' : negative ? 'text-rose-700' : 'text-muted'}`}>
        {change === null ? 'Sin comparativa' : `${change > 0 ? '+' : ''}${formatNumber(change, 1)}% anterior`}
      </p>
    </div>
  )
}

function TrendChart({ pageviews, visitors }: { pageviews: TimeSeriesRow[]; visitors: TimeSeriesRow[] }) {
  const width = 760
  const height = 230
  const padding = 28
  const maxValue = Math.max(1, ...pageviews.map((row) => row.y), ...visitors.map((row) => row.y))
  const pointCount = Math.max(pageviews.length, visitors.length, 2)
  const points = (rows: TimeSeriesRow[]) => rows.map((row, index) => {
    const x = padding + index * ((width - padding * 2) / (pointCount - 1))
    const y = height - padding - (row.y / maxValue) * (height - padding * 2)
    return `${x},${y}`
  }).join(' ')

  const labelRows = pageviews.length ? pageviews : visitors
  const labels = labelRows.length
    ? [labelRows[0], labelRows[Math.floor((labelRows.length - 1) / 2)], labelRows[labelRows.length - 1]]
    : []

  if (!pageviews.length && !visitors.length) {
    return <div className="flex h-52 items-center justify-center border border-dashed border-line text-sm text-muted">Aún no hay tráfico en este rango.</div>
  }

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-56 min-w-[620px] w-full" role="img" aria-label="Evolución de páginas vistas y visitantes">
        {[0, 0.25, 0.5, 0.75, 1].map((step) => {
          const y = padding + step * (height - padding * 2)
          return <line key={step} x1={padding} y1={y} x2={width - padding} y2={y} stroke="#e2e8f0" strokeWidth="1" />
        })}
        <polyline points={points(pageviews)} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        <polyline points={points(visitors)} fill="none" stroke="#059669" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        {labels.map((row, index) => (
          <text key={`${row.x}-${index}`} x={padding + index * ((width - padding * 2) / 2)} y={height - 5} textAnchor={index === 0 ? 'start' : index === 2 ? 'end' : 'middle'} fontSize="10" fill="#64748b">
            {formatChartDate(row.x)}
          </text>
        ))}
      </svg>
    </div>
  )
}

function MetricList({
  title,
  rows,
  expandable = false,
  showPercentage = false,
}: {
  title: string
  rows: MetricRow[]
  expandable?: boolean
  showPercentage?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const max = Math.max(1, ...rows.map((row) => row.y))
  const total = rows.reduce((sum, row) => sum + row.y, 0)
  const visibleRows = expandable && expanded ? rows : rows.slice(0, 10)
  return (
    <div className="min-w-0 bg-white px-5 py-5">
      <h3 className="mb-4 text-sm font-bold text-foreground">{title}</h3>
      {showPercentage && rows.length ? (
        <p className="-mt-3 mb-4 text-[11px] text-muted">Recuento · % del total</p>
      ) : null}
      {rows.length ? (
        <>
          <ol className="space-y-3">
            {visibleRows.map((row, index) => (
              <li key={`${row.x ?? 'sin-dato'}-${index}`} className="min-w-0">
                <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                  <span className="truncate text-slate-700" title={row.x || '(sin dato)'}>{row.x || '(sin dato)'}</span>
                  <span className="shrink-0 font-bold text-foreground">
                    {formatNumber(row.y)}
                    {showPercentage && total > 0 ? ` · ${formatNumber(row.y / total * 100, 1)}%` : ''}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden bg-slate-100">
                  <div className="h-full bg-brand" style={{ width: `${Math.max(2, row.y / max * 100)}%` }} />
                </div>
              </li>
            ))}
          </ol>
          {expandable && rows.length > 10 ? (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="mt-5 text-xs font-bold text-brand hover:underline"
            >
              {expanded ? 'Ver las 10 primeras' : <>Ver todas ({formatNumber(rows.length)})</>}
            </button>
          ) : null}
        </>
      ) : <p className="text-xs text-muted">Sin datos o no disponible en esta versión de Umami.</p>}
    </div>
  )
}

function SessionTable({ rows, available }: { rows: SessionRow[]; available: boolean }) {
  if (!available) {
    return <p className="px-5 py-8 text-sm text-muted">El detalle de sesiones no está disponible en esta versión de Umami.</p>
  }
  if (!rows.length) {
    return <p className="px-5 py-8 text-sm text-muted">Todavía no hay sesiones disponibles para este periodo.</p>
  }

  return (
    <div className="overflow-x-auto bg-white">
      <table className="w-full min-w-[900px] text-left text-xs">
        <thead className="border-b border-line bg-slate-50 text-muted">
          <tr>
            <th className="px-4 py-3 font-bold">Última actividad</th>
            <th className="px-4 py-3 font-bold">Lugar</th>
            <th className="px-4 py-3 font-bold">Dispositivo</th>
            <th className="px-4 py-3 font-bold">Navegador y sistema</th>
            <th className="px-4 py-3 text-right font-bold">Páginas</th>
            <th className="px-4 py-3 text-right font-bold">Visitas</th>
            <th className="px-4 py-3 text-right font-bold">Permanencia</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row, index) => (
            <tr key={`${row.lastAt || 'sin-fecha'}-${index}`}>
              <td className="whitespace-nowrap px-4 py-3 font-semibold text-foreground">{formatSessionDate(row.lastAt)}</td>
              <td className="px-4 py-3 text-slate-700">{[row.city, row.region, row.country].filter(Boolean).join(' · ') || 'Sin ubicación'}</td>
              <td className="px-4 py-3 text-slate-700">{[row.device, row.screen].filter(Boolean).join(' · ') || 'Sin dato'}</td>
              <td className="px-4 py-3 text-slate-700">{[row.browser, row.operatingSystem].filter(Boolean).join(' · ') || 'Sin dato'}</td>
              <td className="px-4 py-3 text-right font-bold text-foreground">{formatNumber(row.views)}</td>
              <td className="px-4 py-3 text-right font-bold text-foreground">{formatNumber(row.visits)}</td>
              <td className="px-4 py-3 text-right font-bold text-foreground">{formatDuration(row.durationSeconds)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-line px-5 py-3 text-[11px] text-muted">
        Sesiones anónimas: no se muestran identificadores, direcciones IP ni datos personales.
      </p>
    </div>
  )
}

function StatusMessage({ title, message }: { title: string; message: string }) {
  return (
    <div className="border-b border-amber-200 bg-amber-50 px-5 py-5">
      <p className="font-bold text-amber-900">{title}</p>
      <p className="mt-1 text-sm text-amber-800">{message}</p>
    </div>
  )
}

function formatNumber(value: number, decimals = 0) {
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: decimals, minimumFractionDigits: decimals }).format(value)
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${Math.round(seconds)} s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ${Math.round(seconds % 60)} s`
  return `${Math.floor(seconds / 3600)} h ${Math.round(seconds % 3600 / 60)} min`
}

function formatChartDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short' }).format(date)
}

function formatSessionDate(value: string | null) {
  if (!value) return 'Sin fecha'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(date)
}
