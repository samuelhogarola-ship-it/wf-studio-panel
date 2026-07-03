'use client'

import { useActionState } from 'react'

import { resetPasswordAction, type AuthFormState } from '@/lib/actions/auth'
import { type Locale, t } from '@/lib/i18n'
import { FormMessage } from '@/components/ui/form-message'

const initialState: AuthFormState = {}

export function ResetPasswordForm({ locale }: { locale: Locale }) {
  const [state, action, pending] = useActionState(resetPasswordAction, initialState)

  const inputClass =
    'h-12 w-full rounded-2xl border-2 border-white/5 bg-white/[0.07] px-4 text-white placeholder-white/20 outline-none transition-all focus:border-white/20 [color-scheme:dark]'

  const btnClass =
    'relative mt-1 h-12 w-full cursor-pointer rounded-2xl border-2 border-white/5 bg-gradient-to-br from-white/5 to-white/10 px-5 text-sm font-semibold text-white backdrop-blur-[25px] shadow-sm transition-all duration-200 hover:bg-white hover:text-black hover:border-transparent disabled:opacity-40 disabled:cursor-not-allowed'

  if (state.success) {
    return (
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5 text-sm text-emerald-400">
        {state.success}
      </div>
    )
  }

  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-1.5">
        <label htmlFor="email" className="text-sm text-white/60">
          {t(locale, 'resetPasswordForm.email')}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          placeholder="cliente@empresa.com"
          required
          autoComplete="email"
          className={inputClass}
        />
      </div>
      {state.error && <FormMessage error={state.error} />}
      <button type="submit" disabled={pending} className={btnClass}>
        {pending ? t(locale, 'resetPasswordForm.submitting') : t(locale, 'resetPasswordForm.submit')}
      </button>
    </form>
  )
}
