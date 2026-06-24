import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'

import '@/app/globals.css'
import { LocaleToggle } from '@/components/layout/locale-toggle'
import { getLocale } from '@/lib/locale'
import { t } from '@/lib/i18n'

export const metadata: Metadata = {
  title: 'Panel de control · WF-Studio',
  description: 'Panel de control para WF-Studio.',
  openGraph: {
    title: 'Panel de control · WF-Studio',
    description: 'Panel de control para WF-Studio.',
    images: [{ url: '/icon.png', width: 512, height: 512 }],
  },
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale()

  return (
    <html lang={locale}>
      <body>
        <div className="min-h-screen">
          <div className="border-b border-line bg-white">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 lg:px-8">
              <Link href="/" className="text-sm font-bold tracking-[0.14em] text-brand uppercase">
                {t(locale, 'nav.brand')}
              </Link>
              <div className="flex items-center gap-3 text-sm text-muted">
                <LocaleToggle locale={locale} />
              </div>
            </div>
          </div>
          {children}
        </div>
      </body>
    </html>
  )
}
