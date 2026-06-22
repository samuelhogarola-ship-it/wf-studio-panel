import { redirect } from 'next/navigation'

import { ClientMagicLinkForm } from '@/components/auth/client-magic-link-form'
import { Card } from '@/components/ui/card'
import { getOptionalIdentity } from '@/lib/auth'

export default async function ClientLoginPage() {
  const identity = await getOptionalIdentity()

  if (identity?.role === 'client') {
    redirect('/cliente/dashboard')
  }

  return (
    <main className="mx-auto grid min-h-[calc(100vh-73px)] max-w-6xl gap-6 px-4 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
      <div className="self-center">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand">Portal cliente</p>
        <h1 className="mt-4 text-4xl font-black tracking-tight text-foreground">Consulta tus horas y el historial de trabajo.</h1>
        <p className="mt-5 max-w-xl text-lg text-muted">
          Introduce tu email y te enviaremos un enlace mágico para entrar sin contraseña.
        </p>
      </div>
      <div className="self-center">
        <ClientMagicLinkForm />
        <Card className="mt-4 p-5 text-sm text-muted">
          El acceso solo se concede si tu cuenta está activa y el email coincide con tu ficha de cliente.
        </Card>
      </div>
    </main>
  )
}
