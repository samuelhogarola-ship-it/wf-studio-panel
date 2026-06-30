import Link from 'next/link'
import { type ReactNode } from 'react'

import { signOutAction } from '@/lib/actions/auth'
import { type Locale, t } from '@/lib/i18n'
import { cn } from '@/lib/utils'

type NavItem = { href: string; label: string; icon: ReactNode }
type NavGroup = { label: string; items: NavItem[] }

export function AdminShell({
  title,
  description,
  currentPath,
  userEmail,
  locale,
  children,
}: {
  title: string
  description: string
  currentPath: string
  userEmail: string
  locale: Locale
  children: ReactNode
}) {
  const navGroups: NavGroup[] = [
    {
      label: 'WF-Studio',
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
          href: '/paneladmin/bonos',
          label: 'Horas',
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
          href: '/paneladmin/facturas',
          label: t(locale, 'shell.nav.invoices'),
          icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          ),
        },
        {
          href: '/paneladmin/proyectos',
          label: 'Proyectos',
          icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
          ),
        },
        {
          href: '/paneladmin/vivir-en-fuengirola',
          label: 'Vivir en Fuengirola',
          icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          ),
        },
        {
          href: '/paneladmin/conoce-fuengirola',
          label: 'Conoce Fuengirola',
          icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          ),
        },
      ],
    },
    {
      label: 'Samuel Coach',
      items: [
        {
          href: '/paneladmin/samuel-coach',
          label: 'Prüfungsvorbereitung',
          icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
          ),
        },
        {
          href: '/paneladmin/samuel-coach/alumnos',
          label: 'Alumnos',
          icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
            </svg>
          ),
        },
        {
          href: '/paneladmin/samuel-coach/ejercicios',
          label: 'Ejercicios',
          icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          ),
        },
        {
          href: '/paneladmin/samuel-coach/progreso',
          label: 'Progreso',
          icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          ),
        },
      ],
    },
    {
      label: 'Vokabel-World',
      items: [
        {
          href: '/paneladmin/vokabel-world/vokabel-lab',
          label: 'Vokabel-Lab',
          icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" />
            </svg>
          ),
        },
        {
          href: '/paneladmin/vokabel-world/imkontext',
          label: 'imKontext',
          icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" />
            </svg>
          ),
        },
        {
          href: '/paneladmin/vokabel-world/derdiedas',
          label: 'Der Die Das',
          icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" />
            </svg>
          ),
        },
      ],
    },
    {
      label: 'Superentrenador',
      items: [
        {
          href: '/paneladmin/superentrenador/pt',
          label: 'Panel PT',
          icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          ),
        },
        {
          href: '/paneladmin/superentrenador/usuarios',
          label: 'Usuarios',
          icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
            </svg>
          ),
        },
      ],
    },
  ]

  const allItems = navGroups.flatMap((g) => g.items)

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-56 flex-col border-r border-line bg-white">
        <div className="px-5 py-6 border-b border-line">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">{t(locale, 'shell.brand')}</p>
        </div>
        <nav className="flex-1 px-3 py-4 flex flex-col gap-0 overflow-y-auto">
          {navGroups.map((group) => (
            <div key={group.label} className="mb-3">
              <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">{group.label}</p>
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition',
                    currentPath === item.href || currentPath.startsWith(item.href + '/')
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
        <div className="px-3 py-4 border-t border-line flex flex-col gap-2">
          <div className="px-3 py-2 text-xs text-muted truncate">{userEmail}</div>
          <form action={signOutAction}>
            <button className="w-full rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 text-left transition hover:bg-slate-100">
              {t(locale, 'shell.signOut')}
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="flex flex-col flex-1 min-w-0">
        <header className="lg:hidden border-b border-line bg-white px-4 py-4 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">{t(locale, 'shell.brand')}</p>
          <div className="flex items-center gap-2">
            <div className="text-xs text-muted">{userEmail}</div>
            <form action={signOutAction}>
              <button className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
                {t(locale, 'shell.signOut')}
              </button>
            </form>
          </div>
        </header>
        {/* Mobile nav */}
        <div className="lg:hidden flex gap-2 overflow-x-auto px-4 py-3 border-b border-line bg-white">
          {allItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition',
                currentPath === item.href || currentPath.startsWith(item.href + '/')
                  ? 'bg-brand text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>

        {/* Page header */}
        <div className="border-b border-line bg-white px-6 py-5">
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">{title}</h1>
          <p className="mt-1 text-sm text-muted">{description}</p>
        </div>

        <main className="flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  )
}
