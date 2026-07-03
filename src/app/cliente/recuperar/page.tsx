import Link from 'next/link'

import { ResetPasswordForm } from '@/components/auth/reset-password-form'
import { getLocale } from '@/lib/locale'
import { t } from '@/lib/i18n'

export default async function ResetPasswordPage() {
  const locale = await getLocale()

  return (
    <div className="relative min-h-dvh flex items-center justify-center overflow-auto bg-black px-4">
      <div className="pointer-events-none fixed inset-0 z-0 select-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.12),rgba(0,0,0,0))]" />
      </div>

      <main className="relative z-10 w-full max-w-md py-12">
        <div className="mb-8 text-center">
          <h1 className="text-[28px] font-semibold leading-[34px] tracking-tight text-white">
            {t(locale, 'resetPassword.headline')}
          </h1>
          <p className="mt-2 text-sm text-white/50">
            {t(locale, 'resetPassword.subheadline')}
          </p>
        </div>

        <ResetPasswordForm locale={locale} />

        <p className="mt-6 text-center text-xs text-white/30">
          <Link href="/cliente" className="text-white/50 font-semibold hover:text-white transition-colors underline underline-offset-2">
            {t(locale, 'resetPassword.backToLogin')}
          </Link>
        </p>
      </main>
    </div>
  )
}
