'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { type ReactNode } from 'react'

import { supportPreviewTranslations, type Locale, t } from '@/lib/i18n'
import type { PortalNavigationItem } from '@/lib/projects/portal-navigation.mjs'
import { LocaleToggle } from '@/components/layout/locale-toggle'
import { SupportPreviewBanner } from '@/components/client/support-preview-banner'
import { endSupportPreviewAction } from '@/lib/actions/support-preview'
import { cn } from '@/lib/utils'

export function ClientShell({
  clientName, clientEmail, navigation, supportPreview, locale = 'es', children,
}: {
  clientName: string
  clientEmail: string
  navigation: readonly PortalNavigationItem[]
  supportPreview?: { expiresAt: string; returnPath: string }
  locale?: Locale
  children: ReactNode
}) {
  const pathname = usePathname()
  const supportCopy = supportPreviewTranslations[locale]
  // Fragment destinations represent sections, not the current page.
  const isCurrent = (href: string) => href.startsWith('/') && !href.includes('#') &&
    (pathname === href || pathname.startsWith(href + '/'))

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="hidden lg:flex w-56 flex-col border-r border-line bg-white">
        <div className="px-5 py-6 border-b border-line">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">WF-STUDIO</p>
          <p className="mt-1 text-sm font-bold text-foreground truncate">{clientName}</p>
        </div>
        <nav aria-label={t(locale, 'clientNav.navigation')} className="flex-1 px-3 py-4 flex flex-col gap-0.5">
          {navigation.map(item => (
            <Link
              key={item.id}
              href={item.href}
              aria-current={isCurrent(item.href) ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
                isCurrent(item.href) ? 'bg-brand text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-line flex flex-col gap-1">
          <div className="px-3 flex items-center justify-between mb-1">
            <p className="text-xs text-muted truncate">{clientEmail}</p>
            <LocaleToggle locale={locale} />
          </div>
          {supportPreview ? (
            <form action={endSupportPreviewAction}>
              <button className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-amber-800 transition hover:bg-amber-50">
                {supportCopy.exit}
              </button>
            </form>
          ) : (
            <form action="/auth/sign-out" method="post">
              <input type="hidden" name="redirect" value="client" />
              <button className="w-full rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 text-left transition hover:bg-slate-100 hover:text-slate-900">
                {t(locale, 'clientNav.signOut')}
              </button>
            </form>
          )}
        </div>
      </aside>

      <div className="flex flex-col flex-1 min-w-0">
        <header className="lg:hidden border-b border-line bg-white px-4 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">WF-STUDIO</p>
            <p className="text-sm font-bold text-foreground">{clientName}</p>
          </div>
          <div className="flex items-center gap-2">
            <LocaleToggle locale={locale} />
            {supportPreview ? (
              <form action={endSupportPreviewAction}>
                <button className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 transition hover:bg-amber-100">
                  {supportCopy.exit}
                </button>
              </form>
            ) : (
              <form action="/auth/sign-out" method="post">
                <input type="hidden" name="redirect" value="client" />
                <button className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
                  {t(locale, 'clientNav.signOutShort')}
                </button>
              </form>
            )}
          </div>
        </header>

        {supportPreview ? <SupportPreviewBanner clientName={clientName} expiresAt={supportPreview.expiresAt} locale={locale} /> : null}

        <nav aria-label={t(locale, 'clientNav.navigation')} className="lg:hidden flex gap-1.5 overflow-x-auto px-4 py-3 border-b border-line bg-white">
          {navigation.map(item => (
            <Link
              key={item.id}
              href={item.href}
              aria-current={isCurrent(item.href) ? 'page' : undefined}
              className={cn(
                'whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
                isCurrent(item.href) ? 'bg-brand text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  )
}
