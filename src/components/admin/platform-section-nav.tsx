import Link from 'next/link'

import type { PlatformRequestCounts } from '@/lib/platform-requests/admin'

type PlatformSection = 'vivir' | 'conoce'

export function PlatformSectionNav({ section, currentPath, counts }: {
  section: PlatformSection
  currentPath: string
  counts: PlatformRequestCounts
}) {
  const base = section === 'vivir' ? '/paneladmin/vivir-en-fuengirola' : '/paneladmin/conoce-fuengirola'
  const requestCount = section === 'vivir'
    ? counts['vivir-fuengirola'] + counts['vivir-fuengirola-negocios']
    : counts['conoce-fuengirola']
  const links = section === 'vivir'
    ? [
        ['Resumen', base],
        ['Clientes', `${base}/clientes`],
        ['Suscripciones', `${base}/suscripciones`],
        ['Negocios', `${base}/negocios`],
        ['Solicitudes', `${base}/solicitudes?scope=clients`],
      ]
    : [
        ['Resumen', base],
        ['Clientes', `${base}/clientes`],
        ['Suscripciones', `${base}/suscripciones`],
        ['Solicitudes', `${base}/solicitudes`],
      ]

  return (
    <nav aria-label={`Secciones de ${section === 'vivir' ? 'Vivir en Fuengirola' : 'Conoce Fuengirola'}`} className="mb-6 flex flex-wrap gap-2 rounded-2xl border border-line bg-white p-2 shadow-sm">
      {links.map(([label, href]) => {
        const pathname = href.split('?')[0]
        const selected = currentPath === pathname
        return (
          <Link
            key={href}
            href={href}
            aria-current={selected ? 'page' : undefined}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${selected ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            {label}
            {label === 'Solicitudes' && requestCount > 0 ? (
              <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${selected ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'}`}>{requestCount}</span>
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}
