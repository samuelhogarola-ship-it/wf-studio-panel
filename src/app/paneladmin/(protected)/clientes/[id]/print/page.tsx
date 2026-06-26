import { notFound } from 'next/navigation'

import { requireAdmin } from '@/lib/auth'
import { getClientDetailPageData } from '@/lib/data/admin'
import { PrintButton } from '@/components/ui/print-button'
import { formatDate, formatDuration } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const PACK_TYPE_LABEL: Record<string, string> = {
  hours: 'Bono de horas',
  tasks: 'Pack de tareas',
  domain: 'Dominio',
  hosting: 'Hosting',
  service: 'Servicio',
}

export default async function ClientReportPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  const data = await getClientDetailPageData(id)

  if (!data.client) notFound()

  const { client, packs, packSummaries, recentActivities } = data
  const summaryMap = new Map(packSummaries.map((s) => [s.pack_id, s]))
  const activePacks = packs.filter((p) => p.status === 'active')
  const today = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
        body {
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, sans-serif;
          background: #f8f8f8;
          margin: 0;
          color: #0a0a0a;
          -webkit-font-smoothing: antialiased;
        }
        * { box-sizing: border-box; }
      `}</style>

      <div className="no-print" style={{ padding: '16px', textAlign: 'center', background: '#f8f8f8', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
        <PrintButton />
        <a
          href={`/paneladmin/clientes/${id}`}
          style={{ background: '#f3f3f3', color: '#0a0a0a', border: 'none', borderRadius: '999px', padding: '10px 24px', fontWeight: 600, fontSize: '14px', textDecoration: 'none', display: 'inline-block' }}
        >
          ← Volver
        </a>
      </div>

      <div style={{ maxWidth: '720px', margin: '40px auto', background: '#fff', borderRadius: '16px', padding: '48px', boxShadow: '0 4px 16px rgba(0,0,0,0.07)' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px' }}>
          <div>
            <p style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#767676', margin: '0 0 8px' }}>WF-Studio</p>
            <h1 style={{ fontSize: '28px', fontWeight: 900, margin: 0, letterSpacing: '-0.02em' }}>Informe de cliente</h1>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '14px', color: '#767676', margin: 0 }}>Generado el {today}</p>
          </div>
        </div>

        <div style={{ height: '1px', background: 'rgba(0,0,0,0.07)', marginBottom: '32px' }} />

        {/* Client info */}
        <div style={{ marginBottom: '32px' }}>
          <p style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#767676', margin: '0 0 10px' }}>Cliente</p>
          <p style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 4px' }}>{client.name}</p>
          {client.company && <p style={{ fontSize: '14px', color: '#767676', margin: '0 0 2px' }}>{client.company}</p>}
          <p style={{ fontSize: '14px', color: '#767676', margin: '0 0 2px' }}>{client.email}</p>
          {client.phone && <p style={{ fontSize: '14px', color: '#767676', margin: '0 0 2px' }}>{client.phone}</p>}
          <p style={{ fontSize: '13px', color: '#767676', margin: '8px 0 0' }}>Cliente desde {formatDate(client.created_at)}</p>
        </div>

        <div style={{ height: '1px', background: 'rgba(0,0,0,0.07)', marginBottom: '32px' }} />

        {/* Active packs */}
        <div style={{ marginBottom: '32px' }}>
          <p style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#767676', margin: '0 0 16px' }}>
            Servicios contratados ({activePacks.length})
          </p>
          {activePacks.length === 0 ? (
            <p style={{ fontSize: '14px', color: '#767676' }}>Sin servicios activos.</p>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              {activePacks.map((pack) => {
                const summary = summaryMap.get(pack.id)
                return (
                  <div key={pack.id} style={{ background: '#f8f8f8', borderRadius: '12px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: '15px', margin: '0 0 2px' }}>{pack.name}</p>
                      <p style={{ fontSize: '13px', color: '#767676', margin: 0 }}>
                        {PACK_TYPE_LABEL[pack.pack_type] ?? pack.pack_type}
                        {pack.renewal_date ? ` · Renueva ${formatDate(pack.renewal_date)}` : ''}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {pack.pack_type === 'hours' && summary && (
                        <p style={{ fontSize: '14px', fontWeight: 700, color: '#0f766e', margin: '0 0 2px' }}>
                          {formatDuration(summary.remaining_minutes ?? 0)} restantes
                        </p>
                      )}
                      {pack.price && (
                        <p style={{ fontSize: '13px', color: '#767676', margin: 0 }}>{pack.price.toFixed(2)} €</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div style={{ height: '1px', background: 'rgba(0,0,0,0.07)', marginBottom: '32px' }} />

        {/* Recent activities */}
        <div>
          <p style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#767676', margin: '0 0 16px' }}>
            Últimas actividades
          </p>
          {recentActivities.length === 0 ? (
            <p style={{ fontSize: '14px', color: '#767676' }}>Sin actividades registradas.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr>
                  {['Título', 'Pack', 'Tipo', 'Tiempo', 'Fecha'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#767676', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentActivities.map((a, i) => (
                  <tr key={a.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{a.title}</td>
                    <td style={{ padding: '10px 12px', color: '#767676' }}>{(a.packs as { name: string } | null)?.name ?? '—'}</td>
                    <td style={{ padding: '10px 12px', color: '#767676' }}>{a.activity_type}</td>
                    <td style={{ padding: '10px 12px', color: '#767676' }}>{a.minutes_used > 0 ? formatDuration(a.minutes_used) : '—'}</td>
                    <td style={{ padding: '10px 12px', color: '#767676' }}>{formatDate(a.work_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div style={{ borderTop: '1px solid rgba(0,0,0,0.07)', marginTop: '40px', paddingTop: '20px', textAlign: 'center' }}>
          <p style={{ fontSize: '13px', color: '#767676', margin: 0 }}>WF-Studio · webfuengirola.com</p>
        </div>
      </div>
    </>
  )
}
