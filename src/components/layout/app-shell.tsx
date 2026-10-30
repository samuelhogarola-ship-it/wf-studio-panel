import Link from 'next/link'
import { type ReactNode } from 'react'

import { type Locale, t } from '@/lib/i18n'
import { isNavigationItemActive } from '@/lib/data/superentrenador-navigation.mjs'
import { cn } from '@/lib/utils'

type NavItem = { href: string; label: string; icon: ReactNode; activePrefix?: string }
type NavGroup = { label: string; items: NavItem[] }

export function AdminShell({
  title,
  description,
  currentPath,
  userEmail,
  locale,
  header,
  children,
}: {
  title: string
  description: string
  currentPath: string
  userEmail: string
  locale: Locale
  header?: ReactNode
  children: ReactNode
}) {
  const panelIcon = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  )
  const navGroups: NavGroup[] = [
    {
      label: 'General',
      items: [
        {
          href: '/paneladmin/inicio',
          label: 'Inicio',
          icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          ),
        },
        {
          href: '/paneladmin/proyectos',
          label: 'Proyectos',
          icon: panelIcon,
        },
        {
          href: '/paneladmin/fichero',
          label: 'Fichero',
          icon: panelIcon,
          activePrefix: '/paneladmin/fichero',
        },
      ],
    },
    {
      label: 'CRM',
      items: [
        {
          href: '/paneladmin/dashboard',
          label: t(locale, 'shell.nav.dashboard'),
          icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
            </svg>
          ),
        },
        {
          href: '/paneladmin/clientes',
          label: t(locale, 'shell.nav.clients'),
          icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          ),
        },
        {
          href: '/paneladmin/mensajes',
          label: 'Mensajes',
          icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
            </svg>
          ),
        },
        {
          href: '/paneladmin/bonos',
          label: 'Bonos',
          icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
          ),
        },
        {
          href: '/paneladmin/actividades',
          label: t(locale, 'shell.nav.activities'),
          icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          ),
        },
        {
          href: '/paneladmin/servicios',
          label: 'Servicios',
          icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
            </svg>
          ),
        },
        {
          href: '/paneladmin/informes',
          label: 'Informes',
          icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="12" y1="17" x2="8" y2="17" />
            </svg>
          ),
        },
      ],
    },
    {
      label: 'Bill-in',
      items: [
        {
          href: '/paneladmin/billin',
          label: 'Resumen',
          icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
            </svg>
          ),
        },
        {
          href: '/paneladmin/billin/trimestres',
          label: 'Trimestres',
          icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="17" rx="2" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          ),
        },
        {
          href: '/paneladmin/billin/cuentas',
          label: 'Cuentas',
          icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="5" width="20" height="14" rx="2" /><path d="M16 12h4" /><path d="M2 9h20" />
            </svg>
          ),
        },
        {
          href: '/paneladmin/facturas',
          label: t(locale, 'shell.nav.invoices'),
          icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          ),
        },
        {
          href: '/paneladmin/gastos',
          label: 'Gastos',
          icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1v22" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          ),
        },
      ],
    },
    {
      label: 'Otros paneles',
      items: [
        {
          href: '/paneladmin/vivir-en-fuengirola',
          label: 'Vivir en Fuengirola',
          icon: panelIcon,
        },
        {
          href: '/paneladmin/conoce-fuengirola',
          label: 'Conoce Fuengirola',
          icon: panelIcon,
        },
        {
          href: '/paneladmin/samuel-coach',
          label: 'Samuel Coach',
          icon: panelIcon,
        },
        {
          href: '/paneladmin/vokabel-world',
          label: 'Vokabel-World',
          icon: panelIcon,
        },
        {
          href: '/paneladmin/superentrenador/estadisticas',
          label: 'Superentrenador',
          icon: panelIcon,
          activePrefix: '/paneladmin/superentrenador',
        },
        {
          href: '/paneladmin/todoplastico',
          label: 'TodoPlástico · Agama Marketplace',
          icon: panelIcon,
        },
      ],
    },
  ]

  return (
    <div className="min-h-screen h-screen overflow-hidden bg-background flex">
      {/* Sidebar */}
      <aside className="hidden lg:flex h-screen w-56 flex-col border-r border-line bg-white">
        <div className="shrink-0 px-5 py-6 border-b border-line">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">{t(locale, 'shell.brand')}</p>
        </div>
        <nav aria-label={t(locale, 'shell.navigation')} className="min-h-0 flex-1 px-3 py-4 flex flex-col gap-0 overflow-y-auto">
          {navGroups.map((group) => (
            <div key={group.label} className="mb-3">
              <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">{group.label}</p>
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isNavigationItemActive(currentPath, item.href, item.activePrefix) ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
                    isNavigationItemActive(currentPath, item.href, item.activePrefix)
                      ? 'bg-brand text-white'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700',
                  )}
                >
                  {item.icon}
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="shrink-0 px-3 py-4 border-t border-line flex flex-col gap-2">
          <div className="px-3 py-2 text-xs text-muted truncate">{userEmail}</div>
          <form action="/auth/sign-out" method="post">
            <input type="hidden" name="redirect" value="admin" />
            <button className="w-full rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 text-left transition hover:bg-slate-100">
              {t(locale, 'shell.signOut')}
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="flex h-screen flex-col flex-1 min-w-0 overflow-hidden">
        <header className="shrink-0 lg:hidden border-b border-line bg-white px-4 py-4 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">{t(locale, 'shell.brand')}</p>
          <div className="flex items-center gap-2">
            <div className="text-xs text-muted">{userEmail}</div>
            <form action="/auth/sign-out" method="post">
              <input type="hidden" name="redirect" value="admin" />
              <button className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
                {t(locale, 'shell.signOut')}
              </button>
            </form>
          </div>
        </header>
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:shadow">
          {t(locale, 'accessibility.skipToContent')}
        </a>
        {/* Mobile nav */}
        <nav aria-label={t(locale, 'shell.navigation')} className="shrink-0 lg:hidden space-y-3 border-b border-line bg-white px-4 py-3">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">{group.label}</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isNavigationItemActive(currentPath, item.href, item.activePrefix) ? 'page' : undefined}
                    className={cn(
                      'whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
                      isNavigationItemActive(currentPath, item.href, item.activePrefix)
                        ? 'bg-brand text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Page header */}
        {header ?? (
          <div className="shrink-0 border-b border-line bg-white px-6 py-5">
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">{title}</h1>
            <p className="mt-1 text-sm text-muted">{description}</p>
          </div>
        )}

        <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto px-6 py-8">{children}</main>
      </div>
    </div>
  )
}
