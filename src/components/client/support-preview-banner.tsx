'use client'

import { useEffect, useState } from 'react'

import { endSupportPreviewAction } from '@/lib/actions/support-preview'
import { supportPreviewTranslations, type Locale } from '@/lib/i18n'

function remainingSeconds(expiresAt: string) {
  const expiry = Date.parse(expiresAt)
  return Number.isFinite(expiry) ? Math.max(0, Math.ceil((expiry - Date.now()) / 1000)) : 0
}

function formatCountdown(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${minutes}:${String(remainder).padStart(2, '0')}`
}

export function SupportPreviewBanner({ clientName, expiresAt, locale = 'es' }: {
  clientName: string
  expiresAt: string
  locale?: Locale
}) {
  const copy = supportPreviewTranslations[locale]
  const [seconds, setSeconds] = useState(() => remainingSeconds(expiresAt))

  useEffect(() => {
    setSeconds(remainingSeconds(expiresAt))
    const timer = window.setInterval(() => setSeconds(remainingSeconds(expiresAt)), 1000)
    return () => window.clearInterval(timer)
  }, [expiresAt])

  return (
    <section
      className="border-b border-amber-300 bg-amber-100 px-4 py-3 text-amber-950 lg:px-8"
      aria-label={copy.mode}
      data-support-preview-banner="responsive"
      data-support-expires-at={expiresAt}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-bold">{copy.mode} · {copy.viewingAs} {clientName} · {copy.readOnly}</p>
          <p className="text-sm">{copy.noChanges}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm font-semibold">
            {copy.remaining}{' '}
            <time dateTime={expiresAt} data-support-countdown suppressHydrationWarning>{formatCountdown(seconds)}</time>
          </p>
          <form action={endSupportPreviewAction}>
            <button className="min-h-10 rounded-full bg-amber-950 px-4 text-sm font-semibold text-white hover:bg-amber-900">
              {copy.returnToAdmin}
            </button>
          </form>
        </div>
      </div>
    </section>
  )
}
