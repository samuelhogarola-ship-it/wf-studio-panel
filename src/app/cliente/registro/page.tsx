import Link from 'next/link'

import { ClientRegisterForm } from '@/components/auth/client-register-form'
import { Card } from '@/components/ui/card'

export default function ClientRegisterPage() {
  return (
    <main className="mx-auto grid min-h-[calc(100vh-73px)] max-w-6xl gap-6 px-4 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
      <div className="self-center">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand">Portal cliente</p>
        <h1 className="mt-4 text-4xl font-black tracking-tight text-foreground">Solicita acceso al portal.</h1>
        <p className="mt-5 max-w-xl text-lg text-muted">
          Crea tu cuenta y el equipo revisará tu solicitud. Te avisaremos cuando tengas acceso.
        </p>
      </div>
      <div className="self-center space-y-4">
        <ClientRegisterForm />
        <Card className="p-5 text-sm text-muted">
          ¿Ya tienes cuenta?{' '}
          <Link href="/cliente" className="font-semibold text-foreground underline underline-offset-2">
            Inicia sesión
          </Link>
        </Card>
      </div>
    </main>
  )
}
