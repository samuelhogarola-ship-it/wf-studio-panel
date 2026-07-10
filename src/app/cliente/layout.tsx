import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: 'Portal cliente · WF-Studio',
  description: 'Consulta tus horas, servicios y facturas con WF-Studio.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'WF-Studio',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

export default function ClienteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      {children}
    </>
  )
}
