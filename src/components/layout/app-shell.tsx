import Link from 'next/link'
import { type ReactNode } from 'react'

import { signOutAction } from '@/lib/actions/auth'
import { type Locale, t } from '@/lib/i18n'
import { cn } from '@/lib/utils'

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
  const navItems = [
    {
      href: '/paneladmin/dashboard',
      label: t(locale, 'shell.nav.dashboard'),
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
        </svg>
      ),
    },
    {
      href: '/paneladmin/clientes',
      label: t(locale, 'shell.nav.clients'),
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      href: '/paneladmin/bonos',
      label: t(locale, 'shell.nav.packs'),
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        </svg>
      ),
    },
    {
      href: '/paneladmin/actividades',
      label: t(locale, 'shell.nav.activities'),
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      ),
    },
    {
      href: '/paneladmin/facturas',
      label: t(locale, 'shell.nav.invoices'),
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
        </svg>
      ),
    },
  ]

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-56 flex-col border-r border-line bg-white">
        <div className="px-5 py-6 border-b border-line">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">{t(locale, 'shell.brand')}</p>
        </div>
        <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition',
                currentPath === item.href
                  ? 'bg-brand text-white'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700',
              )}
            >
              {item.icon}
              {item.label}
            </Link>
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
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition',
                currentPath === item.href ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
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
