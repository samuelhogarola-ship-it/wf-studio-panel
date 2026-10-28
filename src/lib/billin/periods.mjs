const monthNames = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

const dateKey = (date) => date.toISOString().slice(0, 10)

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

