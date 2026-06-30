import { AdminShell } from '@/components/layout/app-shell'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { requireAdmin } from '@/lib/auth'
import { getSamuelCoachEjerciciosData } from '@/lib/data/samuel-coach'
import { getLocale } from '@/lib/locale'

export const dynamic = 'force-dynamic'

const NIVEL_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1']

export default async function Page() {
  const identity = await requireAdmin()
  const locale = await getLocale()
  const data = await getSamuelCoachEjerciciosData()

  return (
    <AdminShell
      title="Ejercicios"
      description="Preguntas Wahr/Falsch por texto"
      currentPath="/paneladmin/samuel-coach/ejercicios"
      userEmail={identity.email}
      locale={locale}
    >
      <div className="mb-6 flex gap-4">
        <Card className="p-5 flex-1">
          <p className="text-sm text-muted">Textos</p>
          <p className="mt-3 text-3xl font-black tracking-tight text-foreground">{data.total}</p>
        </Card>
        <Card className="p-5 flex-1">
          <p className="text-sm text-muted">Preguntas totales</p>
          <p className="mt-3 text-3xl font-black tracking-tight text-foreground">{data.totalQuestions}</p>
        </Card>
      </div>

      <div className="flex flex-col gap-6">
        {NIVEL_ORDER.filter((n) => data.byNivel.has(n)).map((nivel) => {
          const texts = data.byNivel.get(nivel)!
          return (
            <section key={nivel}>
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted mb-3">{nivel}</h2>
              <div className="flex flex-col gap-3">
                {texts.map((text) => (
                  <Card key={text.id} className="overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-line">
                      <p className="font-semibold text-foreground">{text.titulo}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted">{text.questions.length} preguntas</span>
                        <Badge className={text.is_published ? 'bg-green-100 text-green-700 border-green-200' : 'bg-slate-100 text-slate-500 border-slate-200'}>
                          {text.is_published ? 'Publicado' : 'Borrador'}
                        </Badge>
                      </div>
                    </div>
                    {text.questions.length > 0 ? (
                      <div className="divide-y divide-line">
                        {text.questions.map((q) => (
                          <div key={q.id} className="flex items-start gap-3 px-5 py-3">
                            <Badge className={q.respuesta ? 'bg-green-100 text-green-700 border-green-200 shrink-0 mt-0.5' : 'bg-red-100 text-red-600 border-red-200 shrink-0 mt-0.5'}>
                              {q.respuesta ? 'Richtig' : 'Falsch'}
                            </Badge>
                            <p className="text-sm text-foreground">{q.enunciado}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="px-5 py-4 text-sm text-muted">Sin preguntas.</p>
                    )}
                  </Card>
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </AdminShell>
  )
}
