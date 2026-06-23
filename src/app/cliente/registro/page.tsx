import Link from 'next/link'

import { ClientRegisterForm } from '@/components/auth/client-register-form'
import { Card } from '@/components/ui/card'
import { getLocale } from '@/lib/locale'
import { t } from '@/lib/i18n'

export default async function ClientRegisterPage() {
  const locale = await getLocale()

  return (
    <main className="mx-auto grid min-h-[calc(100vh-73px)] max-w-6xl gap-6 px-4 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
      <div className="self-center">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand">{t(locale, 'clientRegister.eyebrow')}</p>
        <h1 className="mt-4 text-4xl font-black tracking-tight text-foreground">{t(locale, 'clientRegister.headline')}</h1>
        <p className="mt-5 max-w-xl text-lg text-muted">
          {t(locale, 'clientRegister.subheadline')}
        </p>
      </div>
      <div className="self-center space-y-4">
        <ClientRegisterForm locale={locale} />
        <Card className="p-5 text-sm text-muted">
          {t(locale, 'clientRegister.hasAccount')}{' '}
          <Link href="/cliente" className="font-semibold text-foreground underline underline-offset-2">
            {t(locale, 'clientRegister.login')}
          </Link>
        </Card>
      </div>
    </main>
  )
}
