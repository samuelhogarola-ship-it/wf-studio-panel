'use client'

import { useActionState } from 'react'

import { updatePasswordAction, type AuthFormState } from '@/lib/actions/auth'
import { type Locale, t } from '@/lib/i18n'
import { FormMessage } from '@/components/ui/form-message'

const initialState: AuthFormState = {}

export function UpdatePasswordForm({ locale }: { locale: Locale }) {
  const [state, action, pending] = useActionState(updatePasswordAction, initialState)

  const inputClass =
    'h-12 w-full rounded-2xl border-2 border-white/5 bg-white/[0.07] px-4 text-white placeholder-white/20 outline-none transition-all focus:border-white/20 [color-scheme:dark]'

  const btnClass =
    'relative mt-1 h-12 w-full cursor-pointer rounded-2xl border-2 border-white/5 bg-gradient-to-br from-white/5 to-white/10 px-5 text-sm font-semibold text-white backdrop-blur-[25px] shadow-sm transition-all duration-200 hover:bg-white hover:text-black hover:border-transparent disabled:opacity-40 disabled:cursor-not-allowed'

  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-1.5">
        <label htmlFor="password" className="text-sm text-white/60">
          {t(locale, 'updatePasswordForm.password')}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          placeholder="••••••••"
          required
          minLength={6}
          autoComplete="new-password"
          className={inputClass}
        />
      </div>
      <div className="grid gap-1.5">
        <label htmlFor="confirm" className="text-sm text-white/60">
          {t(locale, 'updatePasswordForm.confirm')}
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          placeholder="••••••••"
          required
          minLength={6}
          autoComplete="new-password"
          className={inputClass}
        />
      </div>
      {state.error && <FormMessage error={state.error} />}
      <button type="submit" disabled={pending} className={btnClass}>
        {pending ? t(locale, 'updatePasswordForm.submitting') : t(locale, 'updatePasswordForm.submit')}
      </button>
    </form>
  )
}
