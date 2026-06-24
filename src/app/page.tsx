import Link from 'next/link'

import { Card } from '@/components/ui/card'
import { getLocale } from '@/lib/locale'
import { t } from '@/lib/i18n'

export default async function HomePage() {
  const locale = await getLocale()

  return (
    <main className="mx-auto grid min-h-screen max-w-6xl items-center gap-6 px-4 py-10 lg:grid-cols-2 lg:px-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand">{t(locale, 'home.eyebrow')}</p>
        <h1 className="mt-4 text-4xl font-black tracking-tight text-foreground lg:text-5xl">
          {t(locale, 'home.headline')}
        </h1>
        <p className="mt-5 max-w-xl text-lg text-muted">
          {t(locale, 'home.subheadline')}
        </p>
      </div>
      <div className="grid gap-4">
        <Card className="p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand">{t(locale, 'home.admin.eyebrow')}</p>
          <h2 className="mt-3 text-2xl font-bold text-foreground">{t(locale, 'home.admin.title')}</h2>
          <p className="mt-2 text-sm text-muted">{t(locale, 'home.admin.description')}</p>
          <Link href="/paneladmin" className="mt-6 inline-flex rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white">
            {t(locale, 'home.admin.cta')}
          </Link>
        </Card>
        <Card className="p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand">{t(locale, 'home.client.eyebrow')}</p>
          <h2 className="mt-3 text-2xl font-bold text-foreground">{t(locale, 'home.client.title')}</h2>
          <p className="mt-2 text-sm text-muted">{t(locale, 'home.client.description')}</p>
          <Link href="/cliente" className="mt-6 inline-flex rounded-full bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-700">
            {t(locale, 'home.client.cta')}
          </Link>
        </Card>
      </div>
    </main>
  )
}
