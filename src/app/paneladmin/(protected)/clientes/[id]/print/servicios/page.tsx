import { notFound } from 'next/navigation'

import { requireAdmin } from '@/lib/auth'
import { getClientDetailPageData } from '@/lib/data/admin'
import { PrintButton } from '@/components/ui/print-button'
import { formatDate, formatDuration } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const PACK_TYPE_LABEL: Record<string, string> = {
  hours: 'Bono de horas',
  tasks: 'Packs de tareas',
  domain: 'Dominios',
  hosting: 'Hosting',
  service: 'Servicios',
}

const PACK_TYPE_ORDER = ['hours', 'tasks', 'domain', 'hosting', 'service'] as const

export default async function ClientServiciosReportPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  const data = await getClientDetailPageData(id)

  if (!data.client) notFound()

  const { client, packs, packSummaries } = data
  const summaryMap = new Map(packSummaries.map((s) => [s.pack_id, s]))
  const activePacks = packs.filter((p) => p.status === 'active')
  const today = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })

  const BRAND = '#1a1a2e'
  const ACCENT = '#4f46e5'

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap');
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          @page { margin: 0; }
        }
        body { font-family: Inter, ui-sans-serif, system-ui, sans-serif; background: #f0f0f5; margin: 0; color: #1a1a2e; -webkit-font-smoothing: antialiased; }
        * { box-sizing: border-box; }
      `}</style>

      <div className="no-print" style={{ padding: '16px', textAlign: 'center', background: '#f0f0f5', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
        <PrintButton />
        <a href={`/paneladmin/clientes/${id}`} style={{ background: '#fff', color: '#1a1a2e', border: '1px solid rgba(0,0,0,0.12)', borderRadius: '999px', padding: '10px 24px', fontWeight: 600, fontSize: '14px', textDecoration: 'none', display: 'inline-block' }}>
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
              <h1 style={{ fontSize: '22px', fontWeight: 900, margin: 0, color: '#fff', letterSpacing: '-0.02em' }}>Servicios contratados</h1>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 4px', color: '#fff' }}>{client.name}</p>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)', margin: 0 }}>{today}</p>
          </div>
        </div>

        <div style={{ padding: '40px 48px' }}>

          {/* Hours bono — featured card */}
          {PACK_TYPE_ORDER.map((type) => {
            if (type !== 'hours') return null
            const items = activePacks.filter((p) => p.pack_type === type)
            if (items.length === 0) return null
            return (
              <div key="hours" style={{ marginBottom: '36px' }}>
                <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: ACCENT, margin: '0 0 14px' }}>
                  {PACK_TYPE_LABEL[type]}
                </p>
                <div style={{ display: 'grid', gap: '12px' }}>
                  {items.map((pack) => {
                    const summary = summaryMap.get(pack.id)
                    const remaining = summary?.remaining_minutes ?? 0
                    const total = pack.minutes_total
                    const pct = total > 0 ? Math.max(0, Math.min(100, (remaining / total) * 100)) : 0
                    const isLow = pct < 25

                    return (
                      <div key={pack.id} style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #2d2b55 100%)', borderRadius: '16px', padding: '24px 28px', color: '#fff' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                          <div>
                            <p style={{ fontWeight: 800, fontSize: '17px', margin: '0 0 4px' }}>{pack.name}</p>
                            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)', margin: 0 }}>
                              {new Date(pack.purchase_date).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                              {pack.renewal_date ? `  ·  Renueva: ${formatDate(pack.renewal_date)}` : ''}
                            </p>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <p style={{ fontSize: '26px', fontWeight: 900, margin: 0, color: isLow ? '#fbbf24' : '#a5f3fc', lineHeight: 1 }}>
                              {formatDuration(remaining)}
                            </p>
                            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', margin: '4px 0 0' }}>restantes de {formatDuration(total)}</p>
                          </div>
                        </div>
                        {/* Progress bar */}
                        <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: '999px', height: '6px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: '999px', width: `${pct}%`, background: isLow ? '#fbbf24' : '#a5f3fc', transition: 'width 0.3s' }} />
                        </div>
                        {pack.price && (
                          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', margin: '12px 0 0' }}>{pack.price.toFixed(2)} €</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* Rest of pack types */}
          {PACK_TYPE_ORDER.filter((t) => t !== 'hours').map((type) => {
            const items = activePacks.filter((p) => p.pack_type === type)
            if (items.length === 0) return null
            return (
              <div key={type} style={{ marginBottom: '32px' }}>
                <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: ACCENT, margin: '0 0 14px' }}>
                  {PACK_TYPE_LABEL[type]}
                </p>
                <div style={{ display: 'grid', gap: '10px' }}>
                  {items.map((pack) => {
                    const isExpiring = pack.renewal_date && new Date(pack.renewal_date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                    return (
                      <div key={pack.id} style={{ background: '#f8f8fb', border: '1px solid rgba(79,70,229,0.08)', borderRadius: '14px', padding: '18px 22px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <p style={{ fontWeight: 700, fontSize: '15px', margin: '0 0 5px', color: BRAND }}>{pack.name}</p>
                            <p style={{ fontSize: '13px', color: '#767690', margin: 0 }}>
                              {new Date(pack.purchase_date).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                            </p>
                            {pack.renewal_date && (
                              <p style={{ fontSize: '13px', margin: '3px 0 0', color: isExpiring ? '#b45309' : '#767690', fontWeight: isExpiring ? 700 : 400 }}>
                                {(type === 'domain' || type === 'hosting') ? 'Caduca' : 'Renueva'}: {formatDate(pack.renewal_date)}
                                {isExpiring ? '  ⚠ Próxima caducidad' : ''}
                              </p>
                            )}
                          </div>
                          {pack.price && (
                            <p style={{ fontSize: '14px', fontWeight: 700, color: BRAND, margin: 0, flexShrink: 0, marginLeft: '16px' }}>
                              {pack.price.toFixed(2)} €
                            </p>
                          )}
                        </div>
                        {pack.notes && (
                          <p style={{ fontSize: '13px', color: '#767690', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(0,0,0,0.06)', margin: '10px 0 0' }}>
                            {pack.notes}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {activePacks.length === 0 && (
            <p style={{ fontSize: '14px', color: '#767690' }}>Sin servicios activos.</p>
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
