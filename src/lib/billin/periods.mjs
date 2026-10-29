const monthNames = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

const dateKey = (date) => date.toISOString().slice(0, 10)

const shortMonthNames = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
]

const validDateKey = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) || dateKey(date) !== value ? null : date
}

const namedMonthPeriod = (key, year, month) => {
  const bounds = monthBounds(`${year}-${String(month).padStart(2, '0')}`)
  return { key, start: bounds.start, end: bounds.end, label: bounds.label }
}

const namedQuarterPeriod = (key, year, quarter) => {
  const bounds = quarterBounds(year, quarter)
  return { key, start: bounds.start, end: bounds.end, label: bounds.label }
}

export function monthBounds(value, now = new Date()) {
  const match = typeof value === 'string' ? /^(\d{4})-(\d{2})$/.exec(value) : null
  const candidateYear = Number(match?.[1])
  const candidateMonth = Number(match?.[2])
  const valid = candidateYear >= 2000 && candidateYear <= 2100 && candidateMonth >= 1 && candidateMonth <= 12
  const year = valid ? candidateYear : now.getUTCFullYear()
  const month = valid ? candidateMonth : now.getUTCMonth() + 1
  const start = new Date(Date.UTC(year, month - 1, 1))
  const end = new Date(Date.UTC(year, month, 1))
  return {
    key: `${year}-${String(month).padStart(2, '0')}`,
    start: dateKey(start),
    end: dateKey(end),
    label: `${monthNames[month - 1]} de ${year}`,
  }
}
export function quarterBounds(yearValue, quarterValue, now = new Date()) {
  const candidateYear = Number(yearValue)
  const candidateQuarter = Number(quarterValue)
  const valid = Number.isInteger(candidateYear) && candidateYear >= 2000 && candidateYear <= 2100
    && Number.isInteger(candidateQuarter) && candidateQuarter >= 1 && candidateQuarter <= 4
  const year = valid ? candidateYear : now.getUTCFullYear()
  const quarter = valid ? candidateQuarter : Math.floor(now.getUTCMonth() / 3) + 1
  const startMonth = (quarter - 1) * 3
  const start = new Date(Date.UTC(year, startMonth, 1))
  const end = new Date(Date.UTC(year, startMonth + 3, 1))
  return { year, quarter, start: dateKey(start), end: dateKey(end), label: `${quarter}.º trimestre de ${year}` }
}

export function resolveAccountingPeriod(input = {}, now = new Date()) {
  const currentYear = now.getUTCFullYear()
  const currentMonth = now.getUTCMonth() + 1
  const currentQuarter = Math.floor(now.getUTCMonth() / 3) + 1

  if (!input.period && typeof input.month === 'string' && /^\d{4}-\d{2}$/.test(input.month)) {
    const bounds = monthBounds(input.month, now)
    if (bounds.key === input.month) {
      return { key: 'custom', start: bounds.start, end: bounds.end, label: bounds.label }
    }
  }

  switch (input.period) {
    case 'all':
      return { key: 'all', label: 'todo el histórico' }
    case 'previous-month': {
      const date = new Date(Date.UTC(currentYear, currentMonth - 2, 1))
      return namedMonthPeriod('previous-month', date.getUTCFullYear(), date.getUTCMonth() + 1)
    }
    case 'this-quarter':
      return namedQuarterPeriod('this-quarter', currentYear, currentQuarter)
    case 'previous-quarter': {
      const date = new Date(Date.UTC(currentYear, (currentQuarter - 1) * 3 - 3, 1))
      return namedQuarterPeriod(
        'previous-quarter',
        date.getUTCFullYear(),
        Math.floor(date.getUTCMonth() / 3) + 1,
      )
    }
    case 'this-year':
      return {
        key: 'this-year',
        start: `${currentYear}-01-01`,
        end: `${currentYear + 1}-01-01`,
        label: `año ${currentYear}`,
      }
    case 'custom': {
      const startDate = validDateKey(input.from)
      const finalDate = validDateKey(input.to)
      if (startDate && finalDate && startDate <= finalDate) {
        const exclusiveEnd = new Date(finalDate)
        exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1)
        return {
          key: 'custom',
          start: dateKey(startDate),
          end: dateKey(exclusiveEnd),
          label: `${startDate.getUTCDate()} ${shortMonthNames[startDate.getUTCMonth()]} ${startDate.getUTCFullYear()} – ${finalDate.getUTCDate()} ${shortMonthNames[finalDate.getUTCMonth()]} ${finalDate.getUTCFullYear()}`,
        }
      }
      break
    }
    case 'this-month':
    default:
      break
  }

  return namedMonthPeriod('this-month', currentYear, currentMonth)
}
