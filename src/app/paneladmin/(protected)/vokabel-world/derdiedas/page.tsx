import { AdminShell } from '@/components/layout/app-shell'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { requireAdmin } from '@/lib/auth'
import { getDerDieDasData } from '@/lib/data/imkontext'
import { getLocale } from '@/lib/locale'

export const dynamic = 'force-dynamic'

const ARTICLE_STYLE: Record<string, string> = {
  der: 'bg-blue-100 text-blue-700 border-blue-200',
  die: 'bg-pink-100 text-pink-700 border-pink-200',
  das: 'bg-green-100 text-green-700 border-green-200',
}

export default async function Page() {
  const identity = await requireAdmin()
  const locale = await getLocale()
  const data = await getDerDieDasData()

  return (
    <AdminShell
      title="Der Die Das"
      description="Sustantivos por artículo en el vocabulario"
      currentPath="/paneladmin/vokabel-world/derdiedas"
      userEmail={identity.email}
      locale={locale}
    >
      {/* Stats */}
      <section className="grid gap-4 grid-cols-2 md:grid-cols-4 mb-8">
        <Card className="p-5">
          <p className="text-sm text-muted">Total sustantivos</p>
          <p className="mt-3 text-3xl font-black tracking-tight text-foreground">{data.total}</p>
        </Card>
        {(['der', 'die', 'das'] as const).map((art) => (
          <Card key={art} className="p-5">
            <p className="text-sm text-muted font-mono font-bold">{art}</p>
            <p className="mt-3 text-3xl font-black tracking-tight text-foreground">{data.byArticle[art]}</p>
            <p className="text-xs text-muted mt-1">{Math.round((data.byArticle[art] / data.total) * 100)}%</p>
          </Card>
        ))}
      </section>

      {/* Word list */}
      <section>
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b border-line">
            <h2 className="text-xl font-bold text-foreground">Sustantivos</h2>
            <p className="text-sm text-muted">{data.total} palabras activas con artículo</p>
          </div>
          <div className="divide-y divide-line max-h-[600px] overflow-y-auto">
            {data.lemmas.map((lemma) => (
              <div key={lemma.id} className="flex items-center gap-3 px-5 py-2.5">
                <Badge className={`${ARTICLE_STYLE[lemma.article] ?? ''} shrink-0 w-8 justify-center`}>
                  {lemma.article}
                </Badge>
                <span className="font-medium text-foreground text-sm">{lemma.german}</span>
                {lemma.plural && (
                  <span className="text-xs text-muted">· {lemma.plural}</span>
                )}
              </div>
            ))}
          </div>
        </Card>
      </section>
    </AdminShell>
  )
}
