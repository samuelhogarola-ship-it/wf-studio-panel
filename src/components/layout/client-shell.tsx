'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { type ReactNode } from 'react'

import { signOutAction } from '@/lib/actions/auth'
import { type Locale, t } from '@/lib/i18n'
import { LocaleToggle } from '@/components/layout/locale-toggle'
import { cn } from '@/lib/utils'

function getNavItems(locale: Locale) {
  return [
    {
      href: '/cliente/dashboard',
      label: t(locale, 'clientNav.dashboard'),
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
        </svg>
      ),
    },
    {
      href: '/cliente/servicios',
      label: t(locale, 'clientNav.servicios'),
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
        </svg>
      ),
    },
    {
      href: '/cliente/bonos',
      label: t(locale, 'clientNav.bonos'),
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
        </svg>
      ),
    },
    {
      href: '/cliente/packs',
      label: t(locale, 'clientNav.packs'),
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        </svg>
      ),
    },
    {
      href: '/cliente/facturas',
      label: t(locale, 'clientNav.facturas'),
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      ),
    },
    {
      href: '/cliente/historial',
      label: t(locale, 'clientNav.historial'),
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      ),
    },
    {
      href: '/cliente/mensajeria',
      label: t(locale, 'clientNav.mensajeria'),
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ),
    },
  ]
}

export function ClientShell({
  clientName,
  clientEmail,
  locale = 'es',
  children,
}: {
  clientName: string
  clientEmail: string
  locale?: Locale
  children: ReactNode
}) {
  const pathname = usePathname()
  const navItems = getNavItems(locale)

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex w-56 flex-col border-r border-line bg-white">
        <div className="px-5 py-6 border-b border-line">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">WF-STUDIO</p>
          <p className="mt-1 text-sm font-bold text-foreground truncate">{clientName}</p>
        </div>
        <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition',
                pathname === item.href
                  ? 'bg-brand text-white'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700',
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-line flex flex-col gap-1">
          <div className="px-3 flex items-center justify-between mb-1">
            <p className="text-xs text-muted truncate">{clientEmail}</p>
            <LocaleToggle locale={locale} />
          </div>
          <form action={signOutAction}>
            <button className="w-full rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 text-left transition hover:bg-slate-100">
              {t(locale, 'clientNav.signOut')}
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden border-b border-line bg-white px-4 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">WF-STUDIO</p>
            <p className="text-sm font-bold text-foreground">{clientName}</p>
          </div>
          <div className="flex items-center gap-2">
            <LocaleToggle locale={locale} />
            <form action={signOutAction}>
              <button className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
                {t(locale, 'clientNav.signOutShort')}
              </button>
            </form>
          </div>
        </header>

        {/* Mobile nav */}
        <div className="lg:hidden flex gap-1.5 overflow-x-auto px-4 py-3 border-b border-line bg-white">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition',
                pathname === item.href ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>

        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  )
}
