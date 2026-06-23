'use client'

import { useActionState } from 'react'

import { clientRegisterAction, type AuthFormState } from '@/lib/actions/auth'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FormMessage } from '@/components/ui/form-message'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const initialState: AuthFormState = {}

export function ClientRegisterForm() {
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
          <Label htmlFor="name">Nombre</Label>
          <Input id="name" name="name" type="text" placeholder="Tu nombre" required />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" placeholder="tu@email.com" required />
        </div>
        <div>
          <Label htmlFor="password">Contraseña</Label>
          <Input id="password" name="password" type="password" placeholder="Mínimo 6 caracteres" required minLength={6} />
        </div>
        <FormMessage error={state.error} />
        <Button type="submit" fullWidth disabled={pending}>
          {pending ? 'Enviando...' : 'Solicitar acceso'}
        </Button>
      </form>
    </Card>
  )
}
