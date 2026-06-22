'use client'

import { useActionState } from 'react'

import { clientMagicLinkAction, type AuthFormState } from '@/lib/actions/auth'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FormMessage } from '@/components/ui/form-message'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const initialState: AuthFormState = {}

export function ClientMagicLinkForm() {
  const [state, action, pending] = useActionState(clientMagicLinkAction, initialState)

  return (
    <Card className="p-6 lg:p-8">
      <form action={action} className="grid gap-5">
        <div>
          <Label htmlFor="email">Email del cliente</Label>
          <Input id="email" name="email" type="email" placeholder="cliente@empresa.com" required />
        </div>
        <FormMessage error={state.error} success={state.success} />
        <Button type="submit" fullWidth disabled={pending}>
          {pending ? 'Enviando...' : 'Recibir enlace mágico'}
        </Button>
      </form>
    </Card>
  )
}
