'use client'

import { useState } from 'react'
import { useActionState } from 'react'

import { clientMagicLinkAction, clientPasswordLoginAction, type AuthFormState } from '@/lib/actions/auth'
import { type Locale, t } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FormMessage } from '@/components/ui/form-message'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const initialState: AuthFormState = {}

export function ClientLoginForm({ locale }: { locale: Locale }) {
  const [tab, setTab] = useState<'magic' | 'password'>('magic')
  const [magicState, magicAction, magicPending] = useActionState(clientMagicLinkAction, initialState)
  const [passState, passAction, passPending] = useActionState(clientPasswordLoginAction, initialState)

  return (
    <Card className="p-6 lg:p-8">
      <div className="mb-6 flex rounded-lg bg-surface-warm p-1">
        <button
          type="button"
          onClick={() => setTab('magic')}
          className={`flex-1 rounded-md py-2 text-sm font-semibold transition-colors ${tab === 'magic' ? 'bg-white text-foreground shadow-sm' : 'text-muted'}`}
        >
          {t(locale, 'clientLoginForm.tabMagic')}
        </button>
        <button
          type="button"
          onClick={() => setTab('password')}
          className={`flex-1 rounded-md py-2 text-sm font-semibold transition-colors ${tab === 'password' ? 'bg-white text-foreground shadow-sm' : 'text-muted'}`}
        >
          {t(locale, 'clientLoginForm.tabPassword')}
        </button>
      </div>

      {tab === 'magic' && (
        <form action={magicAction} className="grid gap-5">
          <div>
            <Label htmlFor="magic-email">{t(locale, 'clientLoginForm.magicEmail')}</Label>
            <Input id="magic-email" name="email" type="email" placeholder="cliente@empresa.com" required />
          </div>
          <FormMessage error={magicState.error} success={magicState.success} />
          <Button type="submit" fullWidth disabled={magicPending}>
            {magicPending ? t(locale, 'clientLoginForm.magicSubmitting') : t(locale, 'clientLoginForm.magicSubmit')}
          </Button>
        </form>
      )}

      {tab === 'password' && (
        <form action={passAction} className="grid gap-5">
          <div>
            <Label htmlFor="pass-email">{t(locale, 'clientLoginForm.passEmail')}</Label>
            <Input id="pass-email" name="email" type="email" placeholder="cliente@empresa.com" required />
          </div>
          <div>
            <Label htmlFor="pass-password">{t(locale, 'clientLoginForm.passPassword')}</Label>
            <Input id="pass-password" name="password" type="password" placeholder="••••••••" required />
          </div>
          <FormMessage error={passState.error} success={passState.success} />
          <Button type="submit" fullWidth disabled={passPending}>
            {passPending ? t(locale, 'clientLoginForm.passSubmitting') : t(locale, 'clientLoginForm.passSubmit')}
          </Button>
        </form>
      )}
    </Card>
  )
}
