import Link from 'next/link'

import { getSuperEntrenadorNavigation } from '@/lib/data/superentrenador-navigation.mjs'
import { cn } from '@/lib/utils'

export function SuperEntrenadorNav({ currentPath }: { currentPath: string }) {
  return (
    <nav aria-label="Secciones de Superentrenador" className="mb-8 flex gap-2 overflow-x-auto border-b border-line pb-3">
      {getSuperEntrenadorNavigation(currentPath).map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? 'page' : undefined}
          className={cn(
            'whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition',
            item.active ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800',
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
