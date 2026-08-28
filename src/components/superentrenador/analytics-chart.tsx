import { buildChartPoints } from '@/lib/data/analytics-chart.mjs'

type SeriesItem = { x: string; y: number }

export function AnalyticsChart({ pageviews, visits }: { pageviews: SeriesItem[]; visits: SeriesItem[] }) {
  if (!pageviews.length && !visits.length) {
    return <p className="py-14 text-center text-sm text-muted">Todavía no hay datos diarios en este periodo.</p>
  }

  const width = 800
  const height = 220
  const max = Math.max(...pageviews.map((item) => item.y), ...visits.map((item) => item.y), 1)
  const pageviewPoints = buildChartPoints(pageviews, width, height, max)
  const visitPoints = buildChartPoints(visits, width, height, max)
  const toPolyline = (points: { x: number; y: number }[]) => points.map((point) => `${point.x},${point.y}`).join(' ')
  const labels = pageviews.length ? pageviews : visits

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-5 text-xs font-semibold text-slate-500">
        <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-teal-600" /> Páginas vistas</span>
        <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-sky-400" /> Visitas</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height + 28}`} role="img" aria-label="Evolución diaria de páginas vistas y visitas" className="h-auto w-full overflow-visible">
        {[0, 0.5, 1].map((ratio) => (
          <line key={ratio} x1="0" x2={width} y1={height * ratio} y2={height * ratio} stroke="#e2e8f0" strokeWidth="1" />
        ))}
        {pageviewPoints.length > 1 ? <polyline points={toPolyline(pageviewPoints)} fill="none" stroke="#0f766e" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" /> : null}
        {visitPoints.length > 1 ? <polyline points={toPolyline(visitPoints)} fill="none" stroke="#38bdf8" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" /> : null}
        {pageviewPoints.map((point, index) => <circle key={`p-${index}`} cx={point.x} cy={point.y} r="3" fill="#0f766e" />)}
        {visitPoints.map((point, index) => <circle key={`v-${index}`} cx={point.x} cy={point.y} r="2.5" fill="#38bdf8" />)}
        <text x="0" y={height + 24} fontSize="12" fill="#64748b">{formatSeriesDate(labels[0]?.x)}</text>
        <text x={width} y={height + 24} textAnchor="end" fontSize="12" fill="#64748b">{formatSeriesDate(labels.at(-1)?.x)}</text>
      </svg>
    </div>
  )
}

function formatSeriesDate(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}
