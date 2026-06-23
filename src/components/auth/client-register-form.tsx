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

  if (state.success) {
    return (
      <Card className="p-6 lg:p-8">
        <p className="text-sm font-semibold text-emerald-700">{state.success}</p>
      </Card>
    )
  }

  return (
    <Card className="p-6 lg:p-8">
      <form action={action} className="grid gap-5">
        <div>
          <Label htmlFor="name">{t(locale, 'clientRegisterForm.name')}</Label>
          <Input id="name" name="name" type="text" placeholder={t(locale, 'clientRegisterForm.namePlaceholder')} required />
        </div>
        <div>
          <Label htmlFor="email">{t(locale, 'clientRegisterForm.email')}</Label>
          <Input id="email" name="email" type="email" placeholder={t(locale, 'clientRegisterForm.emailPlaceholder')} required />
        </div>
        <div>
          <Label htmlFor="password">{t(locale, 'clientRegisterForm.password')}</Label>
          <Input id="password" name="password" type="password" placeholder={t(locale, 'clientRegisterForm.passwordPlaceholder')} required minLength={6} />
        </div>
        <FormMessage error={state.error} />
        <Button type="submit" fullWidth disabled={pending}>
          {pending ? t(locale, 'clientRegisterForm.submitting') : t(locale, 'clientRegisterForm.submit')}
        </Button>
      </form>
    </Card>
  )
}
