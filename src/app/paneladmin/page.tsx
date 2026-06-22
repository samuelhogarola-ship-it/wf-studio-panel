import { redirect } from 'next/navigation'

import { AdminLoginForm } from '@/components/auth/admin-login-form'
import { Card } from '@/components/ui/card'
import { getOptionalIdentity } from '@/lib/auth'

export default async function AdminLoginPage() {
  const identity = await getOptionalIdentity()

  if (identity?.role === 'admin') {
    redirect('/paneladmin/dashboard')
  }

  return (
    <main className="mx-auto grid min-h-[calc(100vh-73px)] max-w-6xl gap-6 px-4 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
      <div className="self-center">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand">Panel administrador</p>
        <h1 className="mt-4 text-4xl font-black tracking-tight text-foreground">Clientes, bonos y horas en un solo sitio.</h1>
        <p className="mt-5 max-w-xl text-lg text-muted">
          Accede con Supabase Auth para gestionar packs, actividades y el seguimiento del trabajo de cada cliente.
        </p>
      </div>
      <div className="self-center">
        <AdminLoginForm />
        <Card className="mt-4 p-5 text-sm text-muted">
          Solo los usuarios con <strong className="text-foreground">role = admin</strong> pueden entrar en el panel de gestión.
        </Card>
      </div>
    </main>
  )
}
