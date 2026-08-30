import fs from 'node:fs/promises'
import path from 'node:path'

import Link from 'next/link'

import { AdminShell } from '@/components/layout/app-shell'
import { Card } from '@/components/ui/card'
import { requireAdmin } from '@/lib/auth'
import { createMonthlyStatReportRepository } from '@/lib/data/monthly-stat-reports.mjs'
import { getLocale } from '@/lib/locale'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

async function getLegacyStatReports() {
  const storageDir = process.env.STAT_REPORT_STORAGE_DIR || path.join(process.cwd(), 'storage', 'stat-reports')

  try {
    const entries = await fs.readdir(storageDir, { withFileTypes: true })
    return Promise.all(entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
      .map(async (entry) => {
        const monthKey = entry.name.replace(/\.md$/, '')
        const markdown = await fs.readFile(path.join(storageDir, entry.name), 'utf8')
        return { month_key: monthKey, label: monthKey, markdown, generated_at: '' }
      }))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}

export default async function AdminInformesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const identity = await requireAdmin()
  const locale = await getLocale()
  const supabase = await createSupabaseServerClient()
  const [databaseReports, legacyReports] = await Promise.all([
    createMonthlyStatReportRepository(supabase).list(),
    getLegacyStatReports(),
  ])
  const reportsByMonth = new Map(legacyReports.map((report) => [report.month_key, report]))
  databaseReports.forEach((report) => reportsByMonth.set(report.month_key, report))
  const statReports = [...reportsByMonth.values()].sort((a, b) => b.month_key.localeCompare(a.month_key))
  const { month } = await searchParams
  const selectedStatReport = statReports.find((report) => report.month_key === month) ?? statReports[0]

  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, email, status')
    .order('name')

  const activeClients = (clients ?? []).filter((c) => c.status === 'active')
  const inactiveClients = (clients ?? []).filter((c) => c.status !== 'active')

  return (
    <AdminShell
      title="Informes"
      description="Informes de servicios e historial por cliente. Se generan automáticamente."
      currentPath="/paneladmin/informes"
      userEmail={identity.email}
      locale={locale}
    >
      <Card className="mb-6 overflow-hidden">
        <div className="border-b border-line px-6 py-5">
          <h2 className="text-xl font-bold text-foreground">Informes estadísticos</h2>
          <p className="mt-1 text-sm text-muted">Resumen mensual automático de Umami para las webs gestionadas.</p>
        </div>
        {statReports.length > 0 ? (
          <div className="grid gap-0 lg:grid-cols-[240px_1fr]">
            <div className="border-b border-line lg:border-b-0 lg:border-r">
              {statReports.map((report) => (
                <Link
                  key={report.month_key}
                  href={`/paneladmin/informes?month=${encodeURIComponent(report.month_key)}`}
                  className={`block border-b border-line px-6 py-4 transition-colors last:border-b-0 ${
                    selectedStatReport?.month_key === report.month_key ? 'bg-slate-100' : 'hover:bg-slate-50'
                  }`}
                >
                  <p className="font-semibold text-foreground">{report.label}</p>
                  <p className="mt-1 text-xs text-muted">{report.month_key}</p>
                </Link>
              ))}
            </div>
            <pre className="max-h-[560px] overflow-auto whitespace-pre-wrap bg-slate-950 px-6 py-5 text-xs leading-6 text-slate-100">
              {selectedStatReport?.markdown}
            </pre>
          </div>
        ) : (
          <p className="px-6 py-8 text-sm text-muted">Todavía no hay informes estadísticos generados.</p>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-line px-6 py-5">
          <h2 className="text-xl font-bold text-foreground">Clientes activos</h2>
        </div>
        <div className="divide-y divide-line">
          {activeClients.map((client) => (
            <div key={client.id} className="flex items-center justify-between px-6 py-4">
              <div>
                <p className="font-semibold text-foreground">{client.name}</p>
                <p className="text-xs text-muted">{client.email}</p>
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/paneladmin/clientes/${client.id}/print/servicios`}
                  target="_blank"
                  className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
                >
                  Servicios →
                </Link>
                <Link
                  href={`/paneladmin/clientes/${client.id}/print/historial`}
                  target="_blank"
                  className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
                >
                  Historial →
                </Link>
              </div>
            </div>
          ))}
          {activeClients.length === 0 && (
            <p className="px-6 py-8 text-sm text-muted">No hay clientes activos.</p>
          )}
        </div>
      </Card>

      {inactiveClients.length > 0 && (
        <Card className="mt-6 overflow-hidden opacity-60">
          <div className="border-b border-line px-6 py-5">
            <h2 className="text-xl font-bold text-foreground">Inactivos ({inactiveClients.length})</h2>
          </div>
          <div className="divide-y divide-line">
            {inactiveClients.map((client) => (
              <div key={client.id} className="flex items-center justify-between px-6 py-4">
                <div>
                  <p className="font-semibold text-foreground">{client.name}</p>
                  <p className="text-xs text-muted">{client.email}</p>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/paneladmin/clientes/${client.id}/print/servicios`}
                    target="_blank"
                    className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
                  >
                    Servicios →
                  </Link>
                  <Link
                    href={`/paneladmin/clientes/${client.id}/print/historial`}
                    target="_blank"
                    className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
                  >
                    Historial →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </AdminShell>
  )
}
