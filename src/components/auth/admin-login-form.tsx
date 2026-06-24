'use client'

import { useActionState } from 'react'

import { adminLoginAction, type AuthFormState } from '@/lib/actions/auth'
import { type Locale, t } from '@/lib/i18n'
import { FormMessage } from '@/components/ui/form-message'

const initialState: AuthFormState = {}

export function AdminLoginForm({ locale }: { locale: Locale }) {
  const [state, action, pending] = useActionState(adminLoginAction, initialState)

  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-1.5">
        <label htmlFor="email" className="text-sm text-white/60">
          {t(locale, 'adminLoginForm.email')}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          placeholder="admin@webfuengirola.com"
          required
          autoComplete="email"
          className="h-12 w-full rounded-2xl border-2 border-white/5 bg-white/[0.07] px-4 text-white placeholder-white/20 outline-none transition-all focus:border-white/20 [color-scheme:dark]"
        />
      </div>

      <div className="grid gap-1.5">
        <label htmlFor="password" className="text-sm text-white/60">
          {t(locale, 'adminLoginForm.password')}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          placeholder="••••••••"
          required
          autoComplete="current-password"
          className="h-12 w-full rounded-2xl border-2 border-white/5 bg-white/[0.07] px-4 text-white placeholder-white/20 outline-none transition-all focus:border-white/20 [color-scheme:dark]"
        />
      </div>

      {(state.error || state.success) && (
        <FormMessage error={state.error} success={state.success} />
      )}

      <button
        type="submit"
        disabled={pending}
        className="relative mt-1 h-12 w-full cursor-pointer rounded-2xl border-2 border-white/5 bg-gradient-to-br from-white/5 to-white/10 px-5 text-sm font-semibold text-white backdrop-blur-[25px] shadow-sm transition-all duration-200 hover:bg-white hover:text-black hover:border-transparent disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {pending ? t(locale, 'adminLoginForm.submitting') : t(locale, 'adminLoginForm.submit')}
      </button>
    </form>
  )
}
