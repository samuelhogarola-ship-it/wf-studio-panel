import type { ClientLanguageTraffic } from '@/lib/analytics/client-summary'

type LanguageTrafficChartProps = {
  languages: readonly ClientLanguageTraffic[]
}

export function LanguageTrafficChart({ languages }: LanguageTrafficChartProps) {
  if (languages.length === 0) {
    return (
      <div className="mt-5 border-t border-slate-100 pt-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Tráfico por idioma</p>
        <p className="mt-2 text-xs text-slate-500">Todavía no hay tráfico por idioma.</p>
      </div>
    )
  }

  const total = languages.reduce((sum, language) => sum + language.value, 0)

  return (
    <div className="mt-5 border-t border-slate-100 pt-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Tráfico por idioma</p>
      <div
        role="img"
        aria-label={languages.map((language) => `${language.label}: ${language.value}`).join(', ')}
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
          return (
            <li key={language.code} className="min-w-0 text-xs text-slate-500">
              <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: language.color }} />
                <span className="truncate">{language.label}</span>
              </span>
              <span className="mt-0.5 block pl-3.5 tabular-nums">{language.value.toLocaleString('es-ES')} · {percentage}%</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
