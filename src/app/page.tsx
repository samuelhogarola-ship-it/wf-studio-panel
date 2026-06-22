import Link from 'next/link'

import { Card } from '@/components/ui/card'

export default function HomePage() {
  return (
    <main className="mx-auto grid min-h-[calc(100vh-73px)] max-w-6xl items-center gap-6 px-4 py-10 lg:grid-cols-2 lg:px-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand">Studio Panel</p>
        <h1 className="mt-4 text-4xl font-black tracking-tight text-foreground lg:text-5xl">
          Gestión limpia de clientes, bonos y actividad.
        </h1>
        <p className="mt-5 max-w-xl text-lg text-muted">
          Subapp independiente para WF-Studio con panel administrador protegido y portal cliente por magic link.
        </p>
      </div>
      <div className="grid gap-4">
        <Card className="p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand">Administrador</p>
          <h2 className="mt-3 text-2xl font-bold text-foreground">Panel de gestión</h2>
          <p className="mt-2 text-sm text-muted">Control de clientes, packs, actividades y notificaciones.</p>
          <Link href="/paneladmin" className="mt-6 inline-flex rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white">
            Entrar al panel
          </Link>
        </Card>
        <Card className="p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand">Cliente</p>
          <h2 className="mt-3 text-2xl font-bold text-foreground">Portal de horas</h2>
          <p className="mt-2 text-sm text-muted">Acceso por email con enlace mágico y seguimiento del consumo de horas.</p>
          <Link href="/cliente" className="mt-6 inline-flex rounded-full bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-700">
            Acceder con magic link
          </Link>
        </Card>
      </div>
    </main>
  )
}
