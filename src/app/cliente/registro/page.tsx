import Link from 'next/link'

import { ClientRegisterForm } from '@/components/auth/client-register-form'
import { Card } from '@/components/ui/card'
import { getLocale } from '@/lib/locale'
import { t } from '@/lib/i18n'

export default async function ClientRegisterPage() {
  const locale = await getLocale()

  return (
    <div className="relative min-h-dvh overflow-auto bg-black px-4">
      <div className="pointer-events-none fixed inset-0 z-0 select-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.12),rgba(0,0,0,0))]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_20%_90%,rgba(20,80,100,0.08),rgba(0,0,0,0))]" />
      </div>

      <main className="relative z-10 mx-auto grid min-h-dvh max-w-6xl gap-8 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:px-8">
        <div className="self-center">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-white/70">{t(locale, 'clientRegister.eyebrow')}</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-white">{t(locale, 'clientRegister.headline')}</h1>
          <p className="mt-5 max-w-xl text-lg text-white/70">
            {t(locale, 'clientRegister.subheadline')}
          </p>
        </div>
        <div className="self-center space-y-4">
          <ClientRegisterForm locale={locale} />
          <Card className="border border-white/10 bg-white/5 p-5 text-sm text-white/65 backdrop-blur-sm">
            {t(locale, 'clientRegister.hasAccount')}{' '}
            <Link href="/cliente" className="font-semibold text-white underline underline-offset-2">
              {t(locale, 'clientRegister.login')}
            </Link>
          </Card>
        </div>
      </main>
    </div>
  )
}
