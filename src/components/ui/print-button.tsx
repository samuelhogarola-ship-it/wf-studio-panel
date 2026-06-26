'use client'

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      style={{ background: '#0a0a0a', color: '#fff', border: 'none', borderRadius: '999px', padding: '10px 24px', fontWeight: 600, fontSize: '14px', cursor: 'pointer', marginRight: '12px' }}
    >
      Imprimir / Guardar PDF
    </button>
  )
}
