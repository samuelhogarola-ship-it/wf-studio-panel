'use client'

import { useMemo, useState } from 'react'

import type {
  UmamiSiteReport,
  UmamiSourceKey,
} from '@/lib/analytics/umami-core.mjs'
import {
  buildUmamiAnalyticsView,
  type AnalyticsMetricSet,
} from '@/lib/analytics/umami-view-model.mjs'

type Props = {
  reports: UmamiSiteReport[]
  sourceUrls: Record<UmamiSourceKey, string>
}

type MetricKey = keyof AnalyticsMetricSet

const numberFormatter = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 })
const decimalFormatter = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 })

function formatDuration(seconds: number) {
  const rounded = Math.max(0, Math.round(seconds))
  const minutes = Math.floor(rounded / 60)
  const rest = rounded % 60
  return minutes > 0 ? `${minutes} min ${rest.toString().padStart(2, '0')} s` : `${rest} s`
}

function formatMetric(key: MetricKey, value: number) {
  if (key === 'bounceRate') return `${decimalFormatter.format(value)} %`
  if (key === 'averageDuration') return formatDuration(value)
  return numberFormatter.format(value)
}

function formatChange(value: number | null, inverse = false) {
  if (value === null) return { label: 'Nuevo', className: 'text-emerald-700' }
  const positive = inverse ? value <= 0 : value >= 0
  const sign = value > 0 ? '+' : ''
  return {
    label: `${sign}${decimalFormatter.format(value)} %`,
    className: positive ? 'text-emerald-700' : 'text-rose-700',
  }
}

function Chart({ series }: { series: Array<{ x: string; y: number }> }) {
  if (series.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-black/15 bg-white/45 px-6 text-center text-sm text-black/50">
        La serie diaria aparecerá cuando Umami registre las primeras páginas vistas.
      </div>
    )
  }

  const width = 760
  const height = 240
  const paddingX = 20
  const paddingY = 22
  const max = Math.max(...series.map((point) => point.y), 1)
  const plotWidth = width - paddingX * 2
  const plotHeight = height - paddingY * 2
  const points = series.map((point, index) => {
    const x = paddingX + (series.length === 1 ? plotWidth / 2 : (index / (series.length - 1)) * plotWidth)
    const y = height - paddingY - (point.y / max) * plotHeight
    return { ...point, plotX: x, plotY: y }
  })
  const line = points.map((point) => `${point.plotX},${point.plotY}`).join(' ')
  const area = `M ${points[0].plotX} ${height - paddingY} L ${points
    .map((point) => `${point.plotX} ${point.plotY}`)
    .join(' L ')} L ${points.at(-1)?.plotX ?? width - paddingX} ${height - paddingY} Z`
  const labelIndexes = [...new Set([0, Math.floor((series.length - 1) / 2), series.length - 1])]

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-64 w-full overflow-visible"
        role="img"
        aria-label="Serie diaria de páginas vistas"
        preserveAspectRatio="none"
      >
        <title>Páginas vistas por día durante los últimos 30 días</title>
        {[0.25, 0.5, 0.75, 1].map((ratio) => (
          <line
            key={ratio}
            x1={paddingX}
            y1={paddingY + plotHeight * ratio}
            x2={width - paddingX}
            y2={paddingY + plotHeight * ratio}
            stroke="rgba(17, 17, 15, 0.09)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <path d={area} fill="url(#analytics-area)" />
        <polyline
          points={line}
          fill="none"
          stroke="#0f766e"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <defs>
          <linearGradient id="analytics-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0f766e" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#0f766e" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
      <div className="mt-2 grid grid-cols-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-black/40">
        {labelIndexes.map((index, position) => (
          <span key={series[index].x} className={position === 1 ? 'text-center' : position === 2 ? 'text-right' : ''}>
            {new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(new Date(series[index].x))}
          </span>
        ))}
      </div>
    </div>
  )
}

function RankedList({ title, rows, emptyLabel }: {
  title: string
  rows: Array<{ x: string; y: number }>
  emptyLabel: string
}) {
  const max = Math.max(...rows.map((row) => row.y), 1)

  return (
    <div>
      <h3 className="font-serif text-2xl text-[#171713]">{title}</h3>
      <div className="mt-5 divide-y divide-black/10 border-y border-black/10">
        {rows.map((row, index) => (
          <div key={`${row.x}-${index}`} className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 py-3.5">
            <span className="text-xs font-bold tabular-nums text-black/35">{String(index + 1).padStart(2, '0')}</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#171713]" title={row.x}>{row.x || '(directo)'}</p>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-black/5">
                <div className="h-full rounded-full bg-emerald-700" style={{ width: `${(row.y / max) * 100}%` }} />
              </div>
            </div>
            <span className="text-sm font-bold tabular-nums text-[#171713]">{numberFormatter.format(row.y)}</span>
          </div>
        ))}
        {rows.length === 0 ? <p className="py-8 text-sm text-black/45">{emptyLabel}</p> : null}
      </div>
    </div>
  )
}

export function UmamiAnalyticsPanel({ reports, sourceUrls }: Props) {
  const [selectedSite, setSelectedSite] = useState('all')
  const selectedReports = useMemo(
    () => selectedSite === 'all' ? reports : reports.filter((report) => report.site.key === selectedSite),
    [reports, selectedSite],
  )
  const view = useMemo(() => buildUmamiAnalyticsView(selectedReports), [selectedReports])
  const activeReport = selectedReports.find((report) => report.status === 'ok') || selectedReports[0] || reports[0]
  const sourceUrl = activeReport ? sourceUrls[activeReport.site.source] : undefined
  const sourceHref = activeReport?.site.websiteId && sourceUrl
    ? `${sourceUrl.replace(/\/$/, '')}/websites/${activeReport.site.websiteId}`
    : sourceUrl

  const tabs = reports.length > 1
    ? [{ key: 'all', label: 'Todos' }, ...reports.map((report) => ({ key: report.site.key, label: report.site.label }))]
    : []

  return (
    <section id="estadisticas" className="my-8 scroll-mt-6 overflow-hidden rounded-[28px] border border-black/10 bg-[#f3f0e8] text-[#171713] shadow-[0_18px_50px_rgba(20,20,16,0.08)]">
      <div className="border-b border-black/10 px-6 py-7 sm:px-8 lg:px-10 lg:py-9">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-emerald-800">Audiencia · últimos 30 días</p>
            <h2 className="mt-3 font-serif text-4xl leading-none tracking-[-0.03em] sm:text-5xl">Pulso digital</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-black/55">
              Lectura editorial del tráfico real, comparada con los 30 días anteriores.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/55 px-3 py-2 text-xs font-semibold text-black/60">
              <span className={`h-2 w-2 rounded-full ${view.status === 'ok' ? 'bg-emerald-600' : 'bg-amber-500'}`} />
              {view.status === 'ok' ? `${view.availableSites} ${view.availableSites === 1 ? 'sitio conectado' : 'sitios conectados'}` : 'Conexión pendiente'}
            </span>
            {sourceHref ? (
              <a href={sourceHref} target="_blank" rel="noreferrer" className="rounded-full bg-[#171713] px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-800">
                Abrir Umami ↗
              </a>
            ) : null}
          </div>
        </div>

        {tabs.length > 0 ? (
          <div role="tablist" aria-label="Seleccionar sitio de analítica" className="mt-7 flex gap-2 overflow-x-auto pb-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={selectedSite === tab.key}
                onClick={() => setSelectedSite(tab.key)}
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition ${selectedSite === tab.key ? 'bg-emerald-800 text-white' : 'border border-black/10 bg-white/45 text-black/60 hover:bg-white'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {view.status === 'unavailable' ? (
        <div className="px-6 py-10 sm:px-8 lg:px-10">
          <div className="rounded-2xl border border-amber-900/15 bg-amber-50/70 p-6">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-800">Datos no disponibles</p>
            <h3 className="mt-2 font-serif text-2xl text-amber-950">Umami todavía no puede responder.</h3>
            <p className="mt-2 text-sm leading-6 text-amber-900/70">
              El resto del panel sigue operativo. Revisa la conexión o el website ID en Coolify.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-amber-950/70">
              {view.unavailableSites.map((failure) => (
                <li key={failure.site.key}><strong>{failure.site.label}:</strong> {failure.message}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-px bg-black/10 sm:grid-cols-2 xl:grid-cols-5">
            {([
              ['visitors', 'Visitantes'],
              ['visits', 'Visitas'],
              ['pageviews', 'Páginas vistas'],
              ['bounceRate', 'Tasa de rebote'],
              ['averageDuration', 'Duración media'],
            ] as Array<[MetricKey, string]>).map(([key, label]) => {
              const change = formatChange(view.comparisons[key], key === 'bounceRate')
              return (
                <div key={key} className="bg-white/55 px-6 py-6">
                  <p className="text-[11px] font-black uppercase tracking-[0.17em] text-black/45">{label}</p>
                  <p className="mt-3 text-3xl font-black tracking-[-0.04em] tabular-nums">{formatMetric(key, view.current[key])}</p>
                  <p className={`mt-2 text-xs font-bold tabular-nums ${change.className}`}>{change.label} <span className="font-medium text-black/35">vs. anterior</span></p>
                </div>
              )
            })}
          </div>

          <div className="grid gap-8 px-6 py-8 sm:px-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,0.5fr)] lg:px-10 lg:py-10">
            <div>
              <div className="mb-6 flex items-end justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-black/40">Ritmo diario</p>
                  <h3 className="mt-2 font-serif text-3xl">Páginas vistas</h3>
                </div>
                <p className="text-right text-xs text-black/40">Actualización cada 5 min</p>
              </div>
              <Chart series={view.series} />
            </div>
            <div className="rounded-2xl bg-[#171713] p-6 text-white sm:p-7">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-300">Lectura rápida</p>
              <p className="mt-4 font-serif text-3xl leading-tight">
                {numberFormatter.format(view.current.visitors)} personas generaron {numberFormatter.format(view.current.pageviews)} páginas vistas.
              </p>
              <div className="mt-8 border-t border-white/15 pt-5 text-sm leading-6 text-white/60">
                {view.unavailableSites.length > 0
                  ? `${view.unavailableSites.length} sitio no está disponible y no entra en este total.`
                  : 'Todos los sitios seleccionados están respondiendo correctamente.'}
              </div>
            </div>
          </div>

          <div className="grid gap-8 border-t border-black/10 px-6 py-8 sm:px-8 lg:grid-cols-2 lg:px-10 lg:py-10">
            <RankedList title="Páginas principales" rows={view.topPages} emptyLabel="Aún no hay páginas clasificadas." />
            <RankedList title="Referidos principales" rows={view.topReferrers} emptyLabel="Aún no hay referidos clasificados." />
          </div>
        </>
      )}
    </section>
  )
}
