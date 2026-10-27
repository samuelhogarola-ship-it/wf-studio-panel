import type { ClientLanguageTraffic } from '@/lib/analytics/client-summary'
import { clientAnalyticsTranslations, type Locale } from '@/lib/i18n'

type LanguageTrafficChartProps = {
  languages: readonly ClientLanguageTraffic[]
  total: number
  locale?: Locale
}

export function LanguageTrafficChart({ languages, total, locale = 'es' }: LanguageTrafficChartProps) {
  const copy = clientAnalyticsTranslations[locale]
  const displayNames = new Intl.DisplayNames([locale], { type: 'language' })
  const numberLocale = locale === 'en' ? 'en-GB' : 'es-ES'
  if (languages.length === 0) {
    return (
      <div className="mt-5 border-t border-slate-100 pt-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{copy.pageLanguage}</p>
        <p className="mt-2 text-xs text-slate-500">{copy.pageLanguageEmpty}</p>
      </div>
    )
  }

  return (
    <div className="mt-5 border-t border-slate-100 pt-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{copy.pageLanguage}</p>
      <div
        role="img"
        aria-label={languages.map((language) => `${displayNames.of(language.code) || language.label}: ${language.value}`).join(', ')}
        className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-slate-100"
      >
        {languages.map((language) => (
          <span
            key={language.code}
            className="h-full"
            style={{
              backgroundColor: language.color,
              width: `${total > 0 ? language.value / total * 100 : 0}%`,
            }}
          />
        ))}
      </div>
      <ul className="mt-3 grid grid-cols-3 gap-2">
        {languages.map((language) => {
          const percentage = total > 0 ? Math.round(language.value / total * 100) : 0
          const label = displayNames.of(language.code) || language.label
          return (
            <li key={language.code} className="min-w-0 text-xs text-slate-500">
              <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: language.color }} />
                <span className="truncate">{label}</span>
              </span>
              <span className="mt-0.5 block pl-3.5 tabular-nums">{language.value.toLocaleString(numberLocale)} · {percentage}%</span>
            </li>
          )
        })}
      </ul>
      <p className="mt-3 text-[11px] leading-relaxed text-slate-400">{copy.pageLanguageNote}</p>
    </div>
  )
}
