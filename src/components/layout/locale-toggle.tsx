'use client'

import { useRouter } from 'next/navigation'

export function LocaleToggle({ locale }: { locale: string }) {
  const router = useRouter()

  function toggle() {
    const next = locale === 'es' ? 'en' : 'es'
    document.cookie = `locale=${next}; path=/; max-age=31536000`
    router.refresh()
  }

  return (
    <button
      onClick={toggle}
      className="rounded-full border border-line px-3 py-1.5 text-xs font-bold tracking-[0.1em] text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
    >
      {locale === 'es' ? 'EN' : 'ES'}
    </button>
  )
}
