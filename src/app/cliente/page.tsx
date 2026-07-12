import Link from 'next/link'
import { redirect } from 'next/navigation'

import { ClientLoginForm } from '@/components/auth/client-login-form'
import { FormMessage } from '@/components/ui/form-message'
import { getOptionalIdentity } from '@/lib/auth'
import { getLocale } from '@/lib/locale'
import { t } from '@/lib/i18n'

type ClientLoginPageProps = {
  searchParams?: Promise<{
    error?: string
    redirectedFrom?: string
  }>
}

function getLoginErrorMessage(error?: string, redirectedFrom?: string) {
  if (error === 'inactive') {
    return 'Tu cuenta no esta activa para este portal. Contacta con WF-Studio.'
  }

  if (error === 'callback_exchange_failed') {
    return 'El enlace de acceso no es valido o ha expirado. Solicita uno nuevo.'
  }

  if (redirectedFrom) {
    return 'Tu sesion ha expirado o necesitas iniciar sesion para continuar.'
  }

  return undefined
}

export default async function ClientLoginPage({ searchParams }: ClientLoginPageProps) {
  const identity = await getOptionalIdentity()

  if (identity?.role === 'admin') {
    redirect('/paneladmin/inicio')
  }

  if (identity?.role === 'client') {
    redirect('/cliente/dashboard')
  }

  const locale = await getLocale()
  const params = searchParams ? await searchParams : undefined
  const loginError = getLoginErrorMessage(params?.error, params?.redirectedFrom)

  return (
    <div className="relative min-h-dvh flex items-center justify-center overflow-auto bg-black px-4">
      {/* Mesh background */}
      <div className="pointer-events-none fixed inset-0 z-0 select-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.12),rgba(0,0,0,0))]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_20%_90%,rgba(20,80,100,0.08),rgba(0,0,0,0))]" />
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
            {t(locale, 'clientLogin.headline')}
          </h1>
          <p className="mt-2 text-sm text-white/70">
            {t(locale, 'clientLogin.subheadline')}
          </p>
        </div>

        <ClientLoginForm locale={locale} />

        {loginError ? (
          <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4">
            <FormMessage error={loginError} />
          </div>
        ) : null}

        <p className="mt-6 text-center text-xs text-white/55">
          {t(locale, 'clientLogin.noAccount')}{' '}
          <Link href="/cliente/registro" className="font-semibold text-white/80 transition-colors underline underline-offset-2 hover:text-white">
            {t(locale, 'clientLogin.requestAccess')}
          </Link>
        </p>
      </main>
    </div>
  )
}
