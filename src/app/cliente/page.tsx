import Link from 'next/link'
import { redirect } from 'next/navigation'

import { ClientLoginForm } from '@/components/auth/client-login-form'
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
          Accede con magic link o con tu contraseña.
        </p>
      </div>
      <div className="self-center">
        <ClientLoginForm />
        <Card className="mt-4 p-5 text-sm text-muted">
          ¿Primera vez?{' '}
          <Link href="/cliente/registro" className="font-semibold text-foreground underline underline-offset-2">
            Solicita acceso
          </Link>
        </Card>
      </div>
    </main>
  )
}
