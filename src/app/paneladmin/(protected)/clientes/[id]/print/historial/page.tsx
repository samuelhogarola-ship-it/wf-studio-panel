import { notFound } from 'next/navigation'

import { requireAdmin } from '@/lib/auth'
import { getClientDetailPageData, getClientFullHistory } from '@/lib/data/admin'
import { PrintButton } from '@/components/ui/print-button'
import { formatDate, formatDuration } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const BRAND = '#1a1a2e'
const ACCENT = '#4f46e5'

export default async function ClientHistorialReportPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  const [data, activities] = await Promise.all([
    getClientDetailPageData(id),
    getClientFullHistory(id),
  ])

  if (!data.client) notFound()

  const { client, packs } = data
  const packMap = new Map(packs.map((p) => [p.id, p]))
  const today = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })

  const byPack = new Map<string, typeof activities>()
  const noPack: typeof activities = []
  for (const a of activities) {
    const packId = (a.packs as { id: string; name: string } | null)?.id
    if (!packId) { noPack.push(a); continue }
    if (!byPack.has(packId)) byPack.set(packId, [])
    byPack.get(packId)!.push(a)
  }

  const totalMinutes = activities.reduce((sum, a) => sum + (a.minutes_used ?? 0), 0)

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap');
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          @page { margin: 0; }
        }
        body { font-family: Inter, ui-sans-serif, system-ui, sans-serif; background: #f0f0f5; margin: 0; color: ${BRAND}; -webkit-font-smoothing: antialiased; }
        * { box-sizing: border-box; }
      `}</style>

      <div className="no-print" style={{ padding: '16px', textAlign: 'center', background: '#f0f0f5', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
        <PrintButton />
        <a href={`/paneladmin/clientes/${id}`} style={{ background: '#fff', color: BRAND, border: '1px solid rgba(0,0,0,0.12)', borderRadius: '999px', padding: '10px 24px', fontWeight: 600, fontSize: '14px', textDecoration: 'none', display: 'inline-block' }}>
          ← Volver
        </a>
      </div>

      <div style={{ maxWidth: '760px', margin: '40px auto 60px', background: '#fff', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.10)' }}>

        {/* Header band */}
        <div style={{ background: BRAND, padding: '36px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-wf.webp" alt="WF" width={48} height={48} style={{ borderRadius: '10px' }} />
            <div>
              <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', margin: '0 0 2px' }}>WF-Studio</p>
              <h1 style={{ fontSize: '22px', fontWeight: 900, margin: 0, color: '#fff', letterSpacing: '-0.02em' }}>Historial de actividades</h1>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 4px', color: '#fff' }}>{client.name}</p>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)', margin: 0 }}>{today}</p>
          </div>
        </div>

        <div style={{ padding: '40px 48px' }}>

          {/* Summary strip */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '36px' }}>
            <div style={{ flex: 1, background: '#f8f8fb', border: '1px solid rgba(79,70,229,0.08)', borderRadius: '14px', padding: '18px 22px' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: ACCENT, margin: '0 0 6px' }}>Total actividades</p>
              <p style={{ fontSize: '28px', fontWeight: 900, margin: 0, color: BRAND }}>{activities.length}</p>
            </div>
            <div style={{ flex: 1, background: '#f8f8fb', border: '1px solid rgba(79,70,229,0.08)', borderRadius: '14px', padding: '18px 22px' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: ACCENT, margin: '0 0 6px' }}>Tiempo total</p>
              <p style={{ fontSize: '28px', fontWeight: 900, margin: 0, color: BRAND }}>{formatDuration(totalMinutes)}</p>
            </div>
          </div>

          {activities.length === 0 && (
            <p style={{ fontSize: '14px', color: '#767690' }}>Sin actividades registradas.</p>
          )}

          {/* Activities by pack */}
          {Array.from(byPack.entries()).map(([packId, packActivities]) => {
            const pack = packMap.get(packId)
            const packMinutes = packActivities.reduce((sum, a) => sum + (a.minutes_used ?? 0), 0)
            return (
              <div key={packId} style={{ marginBottom: '36px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '14px', paddingBottom: '10px', borderBottom: `2px solid ${ACCENT}` }}>
                  <p style={{ fontSize: '14px', fontWeight: 800, margin: 0, color: BRAND }}>{pack?.name ?? 'Pack'}</p>
                  {packMinutes > 0 && (
                    <p style={{ fontSize: '13px', color: ACCENT, fontWeight: 700, margin: 0 }}>{formatDuration(packMinutes)} consumidos</p>
                  )}
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f8f8fb' }}>
                      {['Título', 'Tipo', 'Tiempo', 'Fecha'].map((h) => (
                        <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: ACCENT }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {packActivities.map((a, i) => (
                      <>
                        <tr key={a.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 600, color: BRAND }}>{a.title}</td>
                          <td style={{ padding: '10px 12px', color: '#767690' }}>{a.activity_type}</td>
                          <td style={{ padding: '10px 12px', color: '#767690', fontWeight: 600 }}>{a.minutes_used > 0 ? formatDuration(a.minutes_used) : '—'}</td>
                          <td style={{ padding: '10px 12px', color: '#767690', whiteSpace: 'nowrap' }}>{formatDate(a.work_date)}</td>
                        </tr>
                        {a.description && (
                          <tr key={`${a.id}-desc`} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                            <td colSpan={4} style={{ padding: '0 12px 12px 12px', color: '#9999b0', fontSize: '12px', fontStyle: 'italic', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical' }}>
                              {a.description}
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })}

          {noPack.length > 0 && (
            <div style={{ marginBottom: '36px' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#9999b0', margin: '0 0 14px' }}>Sin pack asignado</p>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <tbody>
                  {noPack.map((a, i) => (
                    <tr key={a.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: BRAND }}>{a.title}</td>
                      <td style={{ padding: '10px 12px', color: '#767690' }}>{a.activity_type}</td>
                      <td style={{ padding: '10px 12px', color: '#767690' }}>{a.minutes_used > 0 ? formatDuration(a.minutes_used) : '—'}</td>
                      <td style={{ padding: '10px 12px', color: '#767690', whiteSpace: 'nowrap' }}>{formatDate(a.work_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ background: '#f8f8fb', borderTop: '1px solid rgba(79,70,229,0.08)', padding: '20px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontSize: '12px', color: '#9999b0', margin: 0 }}>WF-Studio · webfuengirola.com</p>
          <p style={{ fontSize: '12px', color: '#9999b0', margin: 0 }}>{today}</p>
        </div>
      </div>
    </>
  )
}
