import Link from 'next/link'

import { AdminShell } from '@/components/layout/app-shell'
import { requireAdmin } from '@/lib/auth'
import { getLocale } from '@/lib/locale'

export const dynamic = 'force-dynamic'

const REPORTS_URL = 'https://www.samuelcoachdealeman.com/informes-profesor/'

export default async function SamuelCoachInformesPage() {
  const identity = await requireAdmin()
  const locale = await getLocale()

  return (
    <AdminShell
      title="Informes de alumnos"
      description="Mini classroom de Samuel Coach de Alemán"
      currentPath="/paneladmin/samuel-coach/informes"
      userEmail={identity.email}
      locale={locale}
    >
      <section className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/paneladmin/samuel-coach" className="text-sm font-semibold text-brand hover:underline">
          Volver a Samuel Coach
        </Link>
        <a
          href={REPORTS_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex w-fit items-center rounded px-4 py-2 text-sm font-bold text-white bg-brand transition hover:bg-brand-dark"
        >
          Abrir en nueva pestaña
        </a>
      </section>

      <section className="overflow-hidden rounded-lg border border-line bg-white shadow-sm">
        <iframe
          title="Informes de alumnos Samuel Coach"
          src={REPORTS_URL}
          className="h-[calc(100vh-230px)] min-h-[720px] w-full bg-white"
          sandbox="allow-scripts allow-forms allow-same-origin allow-modals allow-popups allow-downloads allow-clipboard-write"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </section>
    </AdminShell>
  )
}
