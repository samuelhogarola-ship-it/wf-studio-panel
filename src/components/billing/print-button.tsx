'use client'

export function PrintButton({ label = 'Imprimir / guardar PDF' }: { label?: string }) {
  return <button type="button" onClick={() => window.print()} className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white print:hidden">{label}</button>
}
