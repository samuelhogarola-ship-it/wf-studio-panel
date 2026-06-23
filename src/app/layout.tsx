import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'

import '@/app/globals.css'

export const metadata: Metadata = {
  title: 'Panel de control · WF-Studio',
  description: 'Panel de control para WF-Studio.',
  openGraph: {
    title: 'Panel de control · WF-Studio',
    description: 'Panel de control para WF-Studio.',
    images: [{ url: '/icon.png', width: 512, height: 512 }],
  },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>
        <div className="min-h-screen">
          <div className="border-b border-line bg-white">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 lg:px-8">
              <Link href="/" className="text-sm font-bold tracking-[0.14em] text-brand uppercase">
                WF-Studio
              </Link>
              <div className="flex items-center gap-3 text-sm text-muted">
                <Link href="/paneladmin">Admin</Link>
                <span className="text-slate-300">/</span>
                <Link href="/cliente">Cliente</Link>
              </div>
            </div>
          </div>
          {children}
        </div>
      </body>
    </html>
  )
}
