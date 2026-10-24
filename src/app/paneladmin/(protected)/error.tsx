'use client'

import { useEffect } from 'react'

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  return <div role="alert" aria-live="assertive" className="mx-auto max-w-xl p-8">
    <h2 className="text-xl font-bold">No se pudo cargar el panel</h2>
    <p className="mt-2 text-sm text-muted">Se produjo un error inesperado.</p>
    <button type="button" onClick={reset} className="mt-4 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white">Reintentar</button>
  </div>
}
