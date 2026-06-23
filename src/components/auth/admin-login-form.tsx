'use client'

import { useActionState } from 'react'

import { adminLoginAction, type AuthFormState } from '@/lib/actions/auth'
import { type Locale, t } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FormMessage } from '@/components/ui/form-message'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const initialState: AuthFormState = {}

export function AdminLoginForm({ locale }: { locale: Locale }) {
  const [state, action, pending] = useActionState(adminLoginAction, initialState)

  return (
    <Card className="p-6 lg:p-8">
      <form action={action} className="grid gap-5">
        <div>
          <Label htmlFor="email">{t(locale, 'adminLoginForm.email')}</Label>
          <Input id="email" name="email" type="email" placeholder="admin@webfuengirola.com" required />
        </div>
        <div>
          <Label htmlFor="password">{t(locale, 'adminLoginForm.password')}</Label>
          <Input id="password" name="password" type="password" placeholder="••••••••" required />
        </div>
        <FormMessage error={state.error} success={state.success} />
        <Button type="submit" fullWidth disabled={pending}>
          {pending ? t(locale, 'adminLoginForm.submitting') : t(locale, 'adminLoginForm.submit')}
        </Button>
      </form>
    </Card>
  )
}
