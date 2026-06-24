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
    { href: '/paneladmin/dashboard', label: t(locale, 'shell.nav.dashboard') },
    { href: '/paneladmin/clientes', label: t(locale, 'shell.nav.clients') },
    { href: '/paneladmin/bonos', label: t(locale, 'shell.nav.packs') },
    { href: '/paneladmin/actividades', label: t(locale, 'shell.nav.activities') },
    { href: '/paneladmin/facturas', label: t(locale, 'shell.nav.invoices') },
  ]

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-56 flex-col border-r border-line bg-white">
        <div className="px-5 py-6 border-b border-line">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">{t(locale, 'shell.brand')}</p>
        </div>
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'rounded-lg px-3 py-2 text-sm font-semibold transition',
                currentPath === item.href
                  ? 'bg-brand text-white'
                  : 'text-slate-600 hover:bg-slate-100',
              )}
            >
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
