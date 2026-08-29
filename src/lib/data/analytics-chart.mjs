export function buildChartPoints(series, width, height, maxValue) {
  if (!series.length) return []
  const max = Math.max(maxValue ?? Math.max(...series.map((item) => item.y)), 1)
  const denominator = Math.max(series.length - 1, 1)
  return series.map((item, index) => ({
    x: Math.round((index / denominator) * width * 100) / 100,
    y: Math.round((height - (item.y / max) * height) * 100) / 100,
  }))
}
