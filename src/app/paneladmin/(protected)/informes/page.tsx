import fs from 'node:fs/promises'
import path from 'node:path'

import Link from 'next/link'

import { AdminShell } from '@/components/layout/app-shell'
import { Card } from '@/components/ui/card'
import { requireAdmin } from '@/lib/auth'
import { getLocale } from '@/lib/locale'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

async function getStatReports() {
  const storageDir = process.env.STAT_REPORT_STORAGE_DIR || path.join(process.cwd(), 'storage', 'stat-reports')

  try {
    const entries = await fs.readdir(storageDir, { withFileTypes: true })
    const reports = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
        .map(async (entry) => {
          const filePath = path.join(storageDir, entry.name)
          const content = await fs.readFile(filePath, 'utf8')
          return {
            month: entry.name.replace(/\.md$/, ''),
            filePath,
            content,
          }
        })
    )
    return reports.sort((a, b) => b.month.localeCompare(a.month))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}

export default async function AdminInformesPage() {
  const identity = await requireAdmin()
  const locale = await getLocale()
  const supabase = await createSupabaseServerClient()
  const statReports = await getStatReports()
  const latestStatReport = statReports[0]

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
                <div key={report.month} className="border-b border-line px-6 py-4 last:border-b-0">
                  <p className="font-semibold text-foreground">{report.month}</p>
                  <p className="mt-1 break-all text-xs text-muted">{report.filePath}</p>
                </div>
              ))}
            </div>
            <pre className="max-h-[560px] overflow-auto whitespace-pre-wrap bg-slate-950 px-6 py-5 text-xs leading-6 text-slate-100">
              {latestStatReport?.content}
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
