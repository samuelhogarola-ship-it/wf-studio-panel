import Link from 'next/link'
import { type ReactNode } from 'react'

import { signOutAction } from '@/lib/actions/auth'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/paneladmin/dashboard', label: 'Dashboard' },
  { href: '/paneladmin/clientes', label: 'Clientes' },
  { href: '/paneladmin/bonos', label: 'Bonos' },
  { href: '/paneladmin/actividades', label: 'Actividades' },
]

export function AdminShell({ title, description, currentPath, userEmail, children }: { title: string; description: string; currentPath: string; userEmail: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">WF-Studio</p>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-foreground">{title}</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-600">{userEmail}</div>
            <form action={signOutAction}>
              <button className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                Cerrar sesión
              </button>
            </form>
          </div>
        </div>
        <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 pb-5 lg:px-8">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'rounded-full px-4 py-2 text-sm font-semibold transition',
                currentPath === item.href ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 lg:px-8">{children}</main>
    </div>
  )
}
