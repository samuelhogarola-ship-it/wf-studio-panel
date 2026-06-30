import Link from 'next/link'

import { AdminShell } from '@/components/layout/app-shell'
import { requireAdmin } from '@/lib/auth'
import { getLocale } from '@/lib/locale'

export const dynamic = 'force-dynamic'

type SubLink = { label: string; href: string }
type Panel = {
  title: string
  description: string
  color: string
  icon: React.ReactNode
  href: string
  links: SubLink[]
}

const PANELS: Panel[] = [
  {
    title: 'WF-Studio',
    description: 'Gestión del estudio: clientes, horas, facturas y servicios.',
    color: 'from-slate-700 to-slate-900',
    href: '/paneladmin/dashboard',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
    links: [
      { label: 'Clientes', href: '/paneladmin/clientes' },
      { label: 'Horas / Bonos', href: '/paneladmin/bonos' },
      { label: 'Facturas', href: '/paneladmin/facturas' },
      { label: 'Servicios', href: '/paneladmin/servicios' },
      { label: 'Actividades', href: '/paneladmin/actividades' },
      { label: 'Informes', href: '/paneladmin/informes' },
    ],
  },
  {
    title: 'Vivir en Fuengirola',
    description: 'Clientes y suscripciones del portal de residentes.',
    color: 'from-sky-600 to-sky-800',
    href: '/paneladmin/vivir-en-fuengirola',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
    links: [
      { label: 'Clientes', href: '/paneladmin/vivir-en-fuengirola/clientes' },
      { label: 'Suscripciones', href: '/paneladmin/vivir-en-fuengirola/suscripciones' },
    ],
  },
  {
    title: 'Conoce Fuengirola',
    description: 'Clientes y suscripciones del portal turístico.',
    color: 'from-teal-600 to-teal-800',
    href: '/paneladmin/conoce-fuengirola',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
    links: [
      { label: 'Clientes', href: '/paneladmin/conoce-fuengirola/clientes' },
      { label: 'Suscripciones', href: '/paneladmin/conoce-fuengirola/suscripciones' },
    ],
  },
  {
    title: 'Samuel Coach de Alemán',
    description: 'Alumnos, ejercicios y progreso de la academia de alemán.',
    color: 'from-violet-600 to-violet-900',
    href: '/paneladmin/samuel-coach',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
    links: [
      { label: 'Alumnos', href: '/paneladmin/samuel-coach/alumnos' },
      { label: 'Ejercicios', href: '/paneladmin/samuel-coach/ejercicios' },
      { label: 'Progreso', href: '/paneladmin/samuel-coach/progreso' },
    ],
  },
  {
    title: 'Vokabel-World',
    description: 'Vocabulario, ejercicios y apps de la plataforma Vokabel.',
    color: 'from-amber-600 to-amber-800',
    href: '/paneladmin/vokabel-world',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 7 4 4 20 4 20 7" /><line x1="9" y1="20" x2="15" y2="20" /><line x1="12" y1="4" x2="12" y2="20" />
      </svg>
    ),
    links: [
      { label: 'Vokabel-Lab', href: '/paneladmin/vokabel-world/vokabel-lab' },
      { label: 'imKontext', href: '/paneladmin/vokabel-world/imkontext' },
      { label: 'Der Die Das', href: '/paneladmin/vokabel-world/derdiedas' },
    ],
  },
  {
    title: 'Superentrenador',
    description: 'Entrenadores personales y usuarios de la plataforma fitness.',
    color: 'from-rose-600 to-rose-900',
    href: '/paneladmin/superentrenador/pt',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" /><path d="M6 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
      </svg>
    ),
    links: [
      { label: 'Panel PT', href: '/paneladmin/superentrenador/pt' },
      { label: 'Usuarios', href: '/paneladmin/superentrenador/usuarios' },
    ],
  },
]

export default async function LauncherPage() {
  const identity = await requireAdmin()
  const locale = await getLocale()

  return (
    <AdminShell
      title="Inicio"
      description="Selecciona un panel para empezar"
      currentPath="/paneladmin/inicio"
      userEmail={identity.email}
      locale={locale}
    >
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {PANELS.map((panel) => (
          <article
            key={panel.title}
            className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-sm hover:shadow-md transition-shadow"
          >
            {/* Header */}
            <div className={`bg-gradient-to-br ${panel.color} px-6 py-5 flex items-center gap-3`}>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-white flex-shrink-0">
                {panel.icon}
              </div>
              <div>
                <h2 className="text-base font-bold text-white leading-tight">{panel.title}</h2>
                <p className="text-xs text-white/70 mt-0.5">{panel.description}</p>
              </div>
            </div>

            {/* Links */}
            <div className="flex-1 px-6 py-4">
              <ul className="space-y-1">
                {panel.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                    >
                      <span className="h-1 w-1 rounded-full bg-slate-300 flex-shrink-0" />
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* CTA */}
            <div className="px-6 pb-5">
              <Link
                href={panel.href}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 transition-colors"
              >
                Entrar
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                </svg>
              </Link>
            </div>
          </article>
        ))}
      </div>
    </AdminShell>
  )
}
