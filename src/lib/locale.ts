import { cookies } from 'next/headers'

import { type Locale, defaultLocale } from './i18n'

export async function getLocale(fallback: Locale = defaultLocale): Promise<Locale> {
  const store = await cookies()
  const val = store.get('locale')?.value
  return val === 'en' || val === 'es' ? val : fallback
}
