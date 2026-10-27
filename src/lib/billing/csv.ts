const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

function csvCell(value: string | number | null | undefined) {
  let text = typeof value === 'number' ? (value / 100).toFixed(2).replace('.', ',') : String(value ?? '')
  if (typeof value === 'string' && /^[\t ]*[=+\-@]/.test(text)) text = `'${text}`
  return /[;"\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function createSpanishCsv(headers: string[], rows: Array<Array<string | number | null | undefined>>) {
  return `\uFEFF${[headers, ...rows].map(row => row.map(csvCell).join(';')).join('\r\n')}\r\n`
}

type PeriodInput = { mode: 'month' | 'quarter' | 'year'; year: number; month?: number; quarter?: number }

export function resolveAccountingPeriod(input: PeriodInput) {
  const finiteInteger = (value: number | undefined, fallback: number) => Number.isFinite(value) ? Math.trunc(value as number) : fallback
  const year = Math.min(2100, Math.max(2000, finiteInteger(input.year, new Date().getUTCFullYear())))
  if (input.mode === 'year') return { from: `${year}-01-01`, to: `${year}-12-31`, label: `Año ${year}` }
  if (input.mode === 'quarter') {
    const quarter = Math.min(4, Math.max(1, finiteInteger(input.quarter, 1)))
    const startMonth = (quarter - 1) * 3 + 1
    const endMonth = startMonth + 2
    const endDay = new Date(Date.UTC(year, endMonth, 0)).getUTCDate()
    return { from: `${year}-${String(startMonth).padStart(2, '0')}-01`, to: `${year}-${String(endMonth).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`, label: `${quarter}º trimestre ${year}` }
  }
  const month = Math.min(12, Math.max(1, finiteInteger(input.month, 1)))
  const endDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return { from: `${year}-${String(month).padStart(2, '0')}-01`, to: `${year}-${String(month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`, label: `${monthNames[month - 1]} ${year}` }
}
