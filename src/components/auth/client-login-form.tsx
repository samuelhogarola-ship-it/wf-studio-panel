'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useActionState } from 'react'

import { clientMagicLinkAction, clientPasswordLoginAction, type AuthFormState } from '@/lib/actions/auth'
import { type Locale, t } from '@/lib/i18n'
import { FormMessage } from '@/components/ui/form-message'

const initialState: AuthFormState = {}

export function ClientLoginForm({ locale }: { locale: Locale }) {
  const [tab, setTab] = useState<'magic' | 'password'>('magic')
  const [magicState, magicAction, magicPending] = useActionState(clientMagicLinkAction, initialState)
  const [passState, passAction, passPending] = useActionState(clientPasswordLoginAction, initialState)

  const inputClass =
    'h-12 w-full rounded-2xl border-2 border-white/5 bg-white/[0.07] px-4 text-white placeholder-white/20 outline-none transition-all focus:border-white/20 [color-scheme:dark]'

  const btnClass =
    'relative mt-1 h-12 w-full cursor-pointer rounded-2xl border-2 border-white/5 bg-gradient-to-br from-white/5 to-white/10 px-5 text-sm font-semibold text-white backdrop-blur-[25px] shadow-sm transition-all duration-200 hover:bg-white hover:text-black hover:border-transparent disabled:opacity-40 disabled:cursor-not-allowed'

  return (
    <div className="grid gap-4">
      {/* Tab switcher */}
      <div className="flex rounded-2xl border border-white/5 bg-white/5 p-1">
        <button
          type="button"
          onClick={() => setTab('magic')}
          className={`flex-1 rounded-xl py-2 text-sm font-semibold transition-all ${
            tab === 'magic'
              ? 'bg-white/10 text-white border border-white/10'
              : 'text-white/40 hover:text-white/60'
          }`}
        >
          {t(locale, 'clientLoginForm.tabMagic')}
        </button>
        <button
          type="button"
          onClick={() => setTab('password')}
          className={`flex-1 rounded-xl py-2 text-sm font-semibold transition-all ${
            tab === 'password'
              ? 'bg-white/10 text-white border border-white/10'
              : 'text-white/40 hover:text-white/60'
          }`}
        >
          {t(locale, 'clientLoginForm.tabPassword')}
        </button>
      </div>

      {tab === 'magic' && (
        <form action={magicAction} className="grid gap-4">
          <div className="grid gap-1.5">
            <label htmlFor="magic-email" className="text-sm text-white/60">
              {t(locale, 'clientLoginForm.magicEmail')}
            </label>
            <input
              id="magic-email"
              name="email"
              type="email"
              placeholder="cliente@empresa.com"
              required
              autoComplete="email"
              className={inputClass}
            />
          </div>
          {(magicState.error || magicState.success) && (
            <FormMessage error={magicState.error} success={magicState.success} />
          )}
          <button type="submit" disabled={magicPending} className={btnClass}>
            {magicPending ? t(locale, 'clientLoginForm.magicSubmitting') : t(locale, 'clientLoginForm.magicSubmit')}
          </button>
        </form>
      )}

      {tab === 'password' && (
        <form action={passAction} className="grid gap-4">
          <div className="grid gap-1.5">
            <label htmlFor="pass-email" className="text-sm text-white/60">
              {t(locale, 'clientLoginForm.passEmail')}
            </label>
            <input
              id="pass-email"
              name="email"
              type="email"
              placeholder="cliente@empresa.com"
              required
              autoComplete="email"
              className={inputClass}
            />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="pass-password" className="text-sm text-white/60">
              {t(locale, 'clientLoginForm.passPassword')}
            </label>
            <input
              id="pass-password"
              name="password"
              type="password"
              placeholder="••••••••"
              required
              autoComplete="current-password"
              className={inputClass}
            />
          </div>
          {(passState.error || passState.success) && (
            <FormMessage error={passState.error} success={passState.success} />
          )}
          <button type="submit" disabled={passPending} className={btnClass}>
            {passPending ? t(locale, 'clientLoginForm.passSubmitting') : t(locale, 'clientLoginForm.passSubmit')}
          </button>
          <p className="text-center text-xs text-white/30">
            <Link href="/cliente/recuperar" className="text-white/50 hover:text-white transition-colors underline underline-offset-2">
              {t(locale, 'clientLoginForm.forgotPassword')}
            </Link>
          </p>
        </form>
      )}
    </div>
  )
}
