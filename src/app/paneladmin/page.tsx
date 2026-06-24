import { redirect } from 'next/navigation'

import { AdminLoginForm } from '@/components/auth/admin-login-form'
import { getOptionalIdentity } from '@/lib/auth'
import { getLocale } from '@/lib/locale'
import { t } from '@/lib/i18n'

export default async function AdminLoginPage() {
  const identity = await getOptionalIdentity()

  if (identity?.role === 'admin') {
    redirect('/paneladmin/dashboard')
  }

  const locale = await getLocale()

  return (
    <div className="relative min-h-dvh flex items-center justify-center overflow-auto bg-black px-4">
      {/* Mesh background */}
      <div className="pointer-events-none fixed inset-0 z-0 select-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(0,0,0,0))]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_80%_80%,rgba(20,100,60,0.08),rgba(0,0,0,0))]" />
      </div>

      <main className="relative z-10 w-full max-w-md py-12">
        {/* Logo + heading */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm">
            <svg width="28" height="28" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <text x="4" y="30" fontSize="26" fontWeight="800" fill="white" fontFamily="system-ui, sans-serif">W</text>
            </svg>
          </div>
          <h1 className="text-[28px] font-semibold leading-[34px] tracking-tight text-white">
            {t(locale, 'adminLogin.headline')}
          </h1>
        </div>

        <AdminLoginForm locale={locale} />

        <p className="mt-6 text-center text-xs text-white/30">
          {t(locale, 'adminLogin.roleNote')} <span className="text-white/50 font-semibold">{t(locale, 'adminLogin.roleNoteRole')}</span> {t(locale, 'adminLogin.roleNoteSuffix')}
        </p>
      </main>
    </div>
  )
}
