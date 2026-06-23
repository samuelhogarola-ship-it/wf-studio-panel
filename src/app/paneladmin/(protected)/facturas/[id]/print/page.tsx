import { notFound } from 'next/navigation'

import { requireAdmin } from '@/lib/auth'
import { getInvoiceById } from '@/lib/data/invoices'
import { formatDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia bancaria',
}

export default async function InvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  const invoice = await getInvoiceById(id)

  if (!invoice) {
    notFound()
  }

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
        <button
          onClick={() => window.print()}
          style={{
            background: '#0a0a0a',
            color: '#fff',
            border: 'none',
            borderRadius: '999px',
            padding: '10px 24px',
            fontWeight: 600,
            fontSize: '14px',
            cursor: 'pointer',
            marginRight: '12px',
          }}
        >
          Imprimir / Guardar PDF
        </button>
        <a
          href="/paneladmin/facturas"
          style={{
            background: '#f3f3f3',
            color: '#0a0a0a',
            border: 'none',
            borderRadius: '999px',
            padding: '10px 24px',
            fontWeight: 600,
            fontSize: '14px',
            textDecoration: 'none',
            display: 'inline-block',
          }}
        >
          Volver
        </a>
      </div>

      <div style={{ maxWidth: '720px', margin: '40px auto', background: '#fff', borderRadius: '16px', padding: '48px', boxShadow: '0 4px 16px rgba(0,0,0,0.07)' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px' }}>
          <div>
            <p style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#767676', marginBottom: '8px' }}>WF-Studio</p>
            <h1 style={{ fontSize: '32px', fontWeight: 900, margin: 0, letterSpacing: '-0.02em' }}>FACTURA</h1>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '22px', fontWeight: 700, fontFamily: 'monospace', margin: 0 }}>{invoice.number}</p>
            <p style={{ fontSize: '14px', color: '#767676', marginTop: '4px' }}>Fecha: {formatDate(invoice.issued_at)}</p>
            {invoice.paid_at ? (
              <p style={{ fontSize: '14px', color: '#0f766e', marginTop: '4px', fontWeight: 600 }}>Pagada: {formatDate(invoice.paid_at)}</p>
            ) : null}
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: '1px', background: 'rgba(0,0,0,0.07)', marginBottom: '32px' }} />

        {/* Client info */}
        <div style={{ marginBottom: '32px' }}>
          <p style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#767676', marginBottom: '10px' }}>Facturado a</p>
          <p style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>{invoice.clients?.name ?? '—'}</p>
          {invoice.clients?.email ? (
            <p style={{ fontSize: '14px', color: '#767676', marginTop: '4px' }}>{invoice.clients.email}</p>
          ) : null}
        </div>

        {/* Concept */}
        <div style={{ background: '#f8f8f8', borderRadius: '12px', padding: '24px', marginBottom: '32px' }}>
          <p style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#767676', marginBottom: '10px' }}>Concepto</p>
          <p style={{ fontSize: '15px', lineHeight: '1.6', margin: 0 }}>{invoice.concept}</p>
        </div>

        {/* Amount & payment */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', background: '#0a0a0a', borderRadius: '12px', color: '#fff', marginBottom: '32px' }}>
          <div>
            <p style={{ fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.7, margin: 0 }}>Total</p>
            <p style={{ fontSize: '32px', fontWeight: 900, margin: '4px 0 0' }}>
              {Number(invoice.amount).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.7, margin: 0 }}>Método de pago</p>
            <p style={{ fontSize: '15px', fontWeight: 600, margin: '4px 0 0' }}>
              {PAYMENT_METHOD_LABELS[invoice.payment_method] ?? invoice.payment_method}
            </p>
          </div>
        </div>

        {/* Notes */}
        {invoice.notes ? (
          <div style={{ borderTop: '1px solid rgba(0,0,0,0.07)', paddingTop: '24px' }}>
            <p style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#767676', marginBottom: '10px' }}>Notas</p>
            <p style={{ fontSize: '14px', color: '#767676', lineHeight: '1.6', margin: 0 }}>{invoice.notes}</p>
          </div>
        ) : null}

        {/* Footer */}
        <div style={{ borderTop: '1px solid rgba(0,0,0,0.07)', marginTop: '40px', paddingTop: '20px', textAlign: 'center' }}>
          <p style={{ fontSize: '13px', color: '#767676', margin: 0 }}>WF-Studio · webfuengirola.com</p>
        </div>
      </div>
    </>
  )
}
