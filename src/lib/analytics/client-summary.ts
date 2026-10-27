import 'server-only'

import { fetchUmamiDashboard } from '@/lib/analytics/umami-dashboard.mjs'
import { getCapabilityConfigurationIssue, type ProjectWithCapabilities } from '@/lib/data/projects'
import { buildProjectTools } from '@/lib/projects/tools.mjs'

export type ClientAnalyticsSummary = {
  projectSlug: string
  projectName: string
  pageviews: number
  visitors: number
  visits: number
  languages: ClientLanguageTraffic[]
  languageTrafficTotal: number
}

export type ClientLanguageTraffic = {
  code: string
  label: string
  value: number
  color: string
}

type SummaryDashboard = Awaited<ReturnType<typeof fetchUmamiDashboard>>
type SummaryFetcher = (options: {
  projectKey: string
  summaryOnly: true
  includeContentLanguages: true
}) => Promise<SummaryDashboard>

type ClientAnalyticsSummaryOptions = {
  fetchDashboard?: SummaryFetcher
}

const publicMetricValue = (value: unknown) => (
  typeof value === 'number' && Number.isFinite(value) ? value : 0
)

const LANGUAGE_COLORS = ['#ef4444', '#22c55e', '#3b82f6'] as const
const LANGUAGE_LABELS: Record<string, string> = {
  da: 'Dansk',
  de: 'Deutsch',
  en: 'English',
  es: 'Español',
  fi: 'Suomi',
  fr: 'Français',
  it: 'Italiano',
  ja: '日本語',
  ko: '한국어',
  nl: 'Nederlands',
  no: 'Norsk',
  pl: 'Polski',
  pt: 'Português',
  ru: 'Русский',
  sv: 'Svenska',
  zh: '中文',
}
const SPORT_LANGUAGE_CODES = ['es', 'en', 'fi'] as const
const CONTENT_LANGUAGE_EVENT_PREFIX = 'page-language:'

function normalizeLanguageCode(value: unknown) {
  if (typeof value !== 'string') return null
  const code = value.trim().toLowerCase().replaceAll('_', '-').split('-')[0]
  return /^[a-z]{2,3}$/.test(code) ? code : null
}

function buildClientLanguageTrafficSummary(
  rows: readonly { x?: unknown; y?: unknown }[],
  fixedCodes?: readonly string[],
) {
  const totals = new Map<string, number>()
  rows.forEach((row) => {
    const code = normalizeLanguageCode(row?.x)
    const value = Number(row?.y)
    if (!code || !Number.isFinite(value) || value <= 0) return
    totals.set(code, (totals.get(code) || 0) + value)
  })

  const codes = fixedCodes
    ? [...fixedCodes]
    : [...totals.entries()]
      .sort(([leftCode, leftValue], [rightCode, rightValue]) => (
        rightValue - leftValue || leftCode.localeCompare(rightCode)
      ))
      .slice(0, 3)
      .map(([code]) => code)

  return {
    languages: codes.map((code, index) => ({
      code,
      label: LANGUAGE_LABELS[code] || code.toUpperCase(),
      value: totals.get(code) || 0,
      color: LANGUAGE_COLORS[index] || LANGUAGE_COLORS[LANGUAGE_COLORS.length - 1],
    })),
    languageTrafficTotal: fixedCodes
      ? fixedCodes.reduce((sum, code) => sum + (totals.get(code) || 0), 0)
      : [...totals.values()].reduce((sum, value) => sum + value, 0),
  }
}

export function buildClientLanguageTraffic(
  rows: readonly { x?: unknown; y?: unknown }[],
  fixedCodes?: readonly string[],
): ClientLanguageTraffic[] {
  return buildClientLanguageTrafficSummary(rows, fixedCodes).languages
}

function contentLanguageRows(rows: readonly { x?: unknown; y?: unknown }[]) {
  return rows.flatMap((row) => (
    typeof row.x === 'string' && row.x.startsWith(CONTENT_LANGUAGE_EVENT_PREFIX)
      ? [{ x: row.x.slice(CONTENT_LANGUAGE_EVENT_PREFIX.length), y: row.y }]
      : []
  ))
}

export async function getClientAnalyticsSummaries(
  projects: readonly ProjectWithCapabilities[],
  { fetchDashboard = fetchUmamiDashboard }: ClientAnalyticsSummaryOptions = {},
): Promise<ClientAnalyticsSummary[]> {
  const eligibleProjects = projects.filter((project) => {
    const configurationIssues = Object.fromEntries(project.capabilities.flatMap((capability) => {
      const issue = getCapabilityConfigurationIssue(project, capability)
      return issue ? [[capability.capability_key, issue]] : []
    }))
    return Boolean(
      project.analytics_registry_key &&
      buildProjectTools({ project, viewer: 'client', configurationIssues })
        .some((tool) => tool.id === 'analytics'),
    )
  })

  const settled = await Promise.allSettled(eligibleProjects.map(async (project) => {
    const dashboard = await fetchDashboard({
      projectKey: project.analytics_registry_key!,
      summaryOnly: true,
      includeContentLanguages: true,
    })
    if (dashboard.status !== 'ok') return null
    const isSportMassage = project.slug === 'sportmassagefuengirola' ||
      project.domain === 'sportmassagefuengirola.com'
    const contentLanguages = buildClientLanguageTrafficSummary(
      contentLanguageRows(Array.isArray(dashboard.metrics?.contentLanguageEvents)
        ? dashboard.metrics.contentLanguageEvents
        : []),
      isSportMassage ? SPORT_LANGUAGE_CODES : undefined,
    )
    return {
      projectSlug: project.slug,
      projectName: project.name,
      pageviews: publicMetricValue(dashboard.summary.pageviews?.value),
      visitors: publicMetricValue(dashboard.summary.visitors?.value),
      visits: publicMetricValue(dashboard.summary.visits?.value),
      ...contentLanguages,
    }
  }))

  return settled.flatMap((result) => (
    result.status === 'fulfilled' && result.value ? [result.value] : []
  ))
}
