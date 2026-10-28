type AccountingPeriod = {
  key: string
  label: string
  start?: string
  end?: string
}

type PreservedParams = Record<string, string | string[] | undefined>

type BillinPeriodFilterProps = {
  action: string
  period: AccountingPeriod
  preservedParams?: PreservedParams
}

const ignoredParams = new Set(['page', 'period', 'month', 'from', 'to'])

function inclusiveEnd(exclusiveEnd?: string) {
  if (!exclusiveEnd) return ''
  const date = new Date(`${exclusiveEnd}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() - 1)
  return date.toISOString().slice(0, 10)
}

function entries(params: PreservedParams) {
  return Object.entries(params).flatMap(([name, value]) => {
    if (ignoredParams.has(name) || value === undefined || value === '') return []
    return (Array.isArray(value) ? value : [value]).map((item) => [name, item] as const)
  })
}

export function BillinPeriodFilter({ action, period, preservedParams = {} }: BillinPeriodFilterProps) {
  const preservedEntries = entries(preservedParams)
  const clearParams = new URLSearchParams()
  for (const [name, value] of preservedEntries) clearParams.append(name, value)
  clearParams.set('period', 'all')

  return (
    <form action={action} method="get" className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      {preservedEntries.map(([name, value], index) => (
        <input key={`${name}-${index}`} type="hidden" name={name} value={value} />
      ))}
      <label className="min-w-48 flex-1 text-sm font-medium text-slate-700">
        Periodo
        <select
          name="period"
          defaultValue={period.key}
          className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
        >
          <option value="all">Todo el histórico</option>
          <option value="this-month">Mes actual</option>
          <option value="previous-month">Mes anterior</option>
          <option value="this-quarter">Trimestre actual</option>
          <option value="previous-quarter">Trimestre anterior</option>
          <option value="this-year">Año actual</option>
          <option value="custom">Personalizado</option>
        </select>
      </label>
      <label className="text-sm font-medium text-slate-700">
        Desde
        <input
          name="from"
          type="date"
          defaultValue={period.start ?? ''}
          className="mt-1 block rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
        />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Hasta
        <input
          name="to"
          type="date"
          defaultValue={inclusiveEnd(period.end)}
          className="mt-1 block rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
        />
      </label>
      <button type="submit" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
        Aplicar
      </button>
      <a href={`${action}?${clearParams.toString()}`} className="px-2 py-2 text-sm font-medium text-slate-600 hover:text-slate-900">
        Ver todo
      </a>
    </form>
  )
}
