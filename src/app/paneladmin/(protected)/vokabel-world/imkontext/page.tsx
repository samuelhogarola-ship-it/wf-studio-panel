import { AdminShell } from '@/components/layout/app-shell'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { requireAdmin } from '@/lib/auth'
import { getImKontextData } from '@/lib/data/imkontext'
import { getLocale } from '@/lib/locale'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const identity = await requireAdmin()
  const locale = await getLocale()
  const data = await getImKontextData()

  return (
    <AdminShell
      title="imKontext"
      description="Estado general de la plataforma imKontext"
      currentPath="/paneladmin/vokabel-world/imkontext"
      userEmail={identity.email}
      locale={locale}
    >
      {/* Stats */}
      <section className="grid gap-4 md:grid-cols-3 mb-8">
        {[
          { label: 'Textos', value: data.stats.totalTexts },
          { label: 'Vocabulario', value: data.stats.totalVocab.toLocaleString() },
          { label: 'Lemas', value: data.stats.totalLemmas.toLocaleString() },
          { label: 'Textos free', value: data.stats.freeTexts },
          { label: 'Textos premium', value: data.stats.premiumTexts },
          { label: 'Usuarios con acceso', value: data.stats.totalUsers },
        ].map((s) => (
          <Card key={s.label} className="p-5">
            <p className="text-sm text-muted">{s.label}</p>
            <p className="mt-3 text-3xl font-black tracking-tight text-foreground">{s.value}</p>
          </Card>
        ))}
      </section>

      {/* Apps */}
      <section className="mb-8">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted mb-3">Apps registradas</h2>
        <Card className="overflow-hidden">
          <div className="divide-y divide-line">
            {data.apps.map((app) => (
              <div key={app.key} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="font-semibold text-foreground">{app.name}</p>
                  <p className="text-xs text-muted font-mono">{app.key}</p>
                </div>
                <Badge className={app.is_active ? 'bg-green-100 text-green-700 border-green-200' : 'bg-slate-100 text-slate-500 border-slate-200'}>
                  {app.is_active ? 'Activa' : 'Inactiva'}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      </section>

      {/* Texts */}
      <section>
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted mb-3">Textos ({data.texts.length})</h2>
        <Card className="overflow-hidden">
          <div className="divide-y divide-line">
            {data.texts.map((text) => (
              <div key={text.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground truncate">{text.title}</p>
                  <p className="text-xs text-muted truncate">{text.topic}</p>
                </div>
                <Badge className={text.access_status === 'free' ? 'bg-blue-100 text-blue-700 border-blue-200 shrink-0' : 'bg-amber-100 text-amber-700 border-amber-200 shrink-0'}>
                  {text.access_status}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </AdminShell>
  )
}
