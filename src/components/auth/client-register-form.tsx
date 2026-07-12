'use client'

import { useActionState } from 'react'

import { clientRegisterAction, type AuthFormState } from '@/lib/actions/auth'
import { type Locale, t } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FormMessage } from '@/components/ui/form-message'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const initialState: AuthFormState = {}

export function ClientRegisterForm({ locale }: { locale: Locale }) {
  const [state, action, pending] = useActionState(clientRegisterAction, initialState)
  const inputClass =
    'h-12 w-full rounded-2xl border border-white/15 bg-white/10 px-4 text-white placeholder-white/45 outline-none transition-all focus:border-white/40 focus:bg-white/12 focus:ring-2 focus:ring-white/20 [color-scheme:dark]'
  const labelClass = 'text-sm text-white/80'

  if (state.success) {
    return (
      <Card className="border border-emerald-500/20 bg-emerald-500/10 p-6 text-emerald-300 backdrop-blur-sm lg:p-8">
        <p className="text-sm font-semibold">{state.success}</p>
      </Card>
    )
  }

  return (
    <Card className="border border-white/10 bg-white/5 p-6 backdrop-blur-sm lg:p-8">
      <form action={action} className="grid gap-5">
        <div>
          <Label htmlFor="name" className={labelClass}>{t(locale, 'clientRegisterForm.name')}</Label>
          <Input id="name" name="name" type="text" placeholder={t(locale, 'clientRegisterForm.namePlaceholder')} required className={inputClass} />
        </div>
        <div>
          <Label htmlFor="email" className={labelClass}>{t(locale, 'clientRegisterForm.email')}</Label>
          <Input id="email" name="email" type="email" placeholder={t(locale, 'clientRegisterForm.emailPlaceholder')} required className={inputClass} />
        </div>
        <div>
          <Label htmlFor="password" className={labelClass}>{t(locale, 'clientRegisterForm.password')}</Label>
          <Input id="password" name="password" type="password" placeholder={t(locale, 'clientRegisterForm.passwordPlaceholder')} required minLength={6} className={inputClass} />
        </div>
        <FormMessage error={state.error} />
        <Button type="submit" fullWidth disabled={pending} className="border border-white/15 bg-gradient-to-br from-white/10 to-white/20 text-white hover:border-white/40 hover:bg-white hover:text-black">
          {pending ? t(locale, 'clientRegisterForm.submitting') : t(locale, 'clientRegisterForm.submit')}
        </Button>
      </form>
    </Card>
  )
}
