import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import '@/app/globals.css'
import { getLocale } from '@/lib/locale'

const metadataBase = new URL(
  process.env.APP_URL ?? 'https://admin.webfuengirola.com',
)

export const metadata: Metadata = {
  metadataBase,
  title: 'Panel de control · WF-Studio',
  description: 'Panel de control para WF-Studio.',
  openGraph: {
    title: 'Panel de control · WF-Studio',
    description: 'Panel de control para WF-Studio.',
    images: [{ url: '/icon.png', width: 512, height: 512 }],
  },
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale()

  return (
    <html lang={locale}>
      <body>
        <div className="min-h-screen">{children}</div>
      </body>
    </html>
  )
}
