import { getLocale } from '@/lib/locale'
import { t } from '@/lib/i18n'

export default async function AdminLoading() {
  const locale = await getLocale()
  return <div role="status" aria-live="polite" className="p-6 text-sm text-muted">{t(locale, 'boundary.loading')}</div>
}
