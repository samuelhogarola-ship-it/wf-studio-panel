declare module '@/lib/data/analytics-chart.mjs' {
  export function buildChartPoints(
    series: { x: string; y: number }[],
    width: number,
    height: number,
    maxValue?: number,
  ): { x: number; y: number }[]
}
