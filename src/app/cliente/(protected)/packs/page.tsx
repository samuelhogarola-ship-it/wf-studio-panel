import { requireClientCapability } from '@/lib/projects/client-access'
import { getClientServicesData } from '@/lib/data/client'
import { getLocale } from '@/lib/locale'
import { clientPortalTranslations } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

export default async function ClientPage() {
  const identity = await requireClientCapability('bonuses_reports')
  const [locale, data] = await Promise.all([getLocale(), getClientServicesData(identity.client.id)])
  const text = clientPortalTranslations[locale]
  const packs = data.packs.filter(pack => pack.pack_type === 'tasks')

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-black tracking-tight text-foreground">Packs</h1>
        <p className="mt-1 text-slate-500">{text.closedPacks} · {text.aggregated}</p>
      </div>
      {packs.length === 0 ? <p className="rounded-2xl border border-dashed border-line bg-white p-8 text-muted">{text.noPacks}</p> : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {packs.map(pack => <li key={pack.id} className="rounded-2xl border border-line bg-white p-6">
            <h2 className="font-bold">{pack.name}</h2>
            {pack.notes ? <p className="mt-2 text-sm text-muted">{pack.notes}</p> : null}
            {pack.renewal_date ? <p className="mt-2 text-sm text-muted">{text.renewal} <time dateTime={pack.renewal_date}>{new Date(pack.renewal_date).toLocaleDateString(locale === 'en' ? 'en-GB' : 'es-ES', { timeZone: 'UTC' })}</time></p> : null}
          </li>)}
        </ul>
      )}
    </>
  )
}
