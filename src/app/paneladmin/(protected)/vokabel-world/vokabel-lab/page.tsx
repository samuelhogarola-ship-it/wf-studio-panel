import { AdminShell } from '@/components/layout/app-shell'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { requireAdmin } from '@/lib/auth'
import { getVokabelLabData } from '@/lib/data/imkontext'
import { getLocale } from '@/lib/locale'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const identity = await requireAdmin()
  const locale = await getLocale()
  const data = await getVokabelLabData()

  return (
    <AdminShell
      title="Vokabel-Lab"
      description="Catálogo de apps y vocabulario"
      currentPath="/paneladmin/vokabel-world/vokabel-lab"
      userEmail={identity.email}
      locale={locale}
    >
      {/* Stats */}
      <section className="grid gap-4 md:grid-cols-2 mb-8">
        <Card className="p-5">
          <p className="text-sm text-muted">Lemas en vocabulario</p>
          <p className="mt-3 text-3xl font-black tracking-tight text-foreground">{data.lemmasTotal.toLocaleString()}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted">Entradas de vocabulario</p>
          <p className="mt-3 text-3xl font-black tracking-tight text-foreground">{data.vocabTotal.toLocaleString()}</p>
        </Card>
      </section>

      {/* Apps catalog */}
      <section>
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted mb-3">Apps públicas</h2>
        <Card className="overflow-hidden">
          <div className="divide-y divide-line">
            {data.catalog.map((app) => (
              <div key={app.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{app.name}</p>
                  <a
                    href={app.launch_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-brand hover:underline truncate block"
                  >
                    {app.launch_url}
                  </a>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge className={app.visibility === 'public' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-slate-100 text-slate-500 border-slate-200'}>
                    {app.visibility}
                  </Badge>
                  <Badge className={app.status === 'active' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-slate-100 text-slate-500 border-slate-200'}>
                    {app.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </AdminShell>
  )
}
