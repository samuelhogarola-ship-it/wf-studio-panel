'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Button } from '@/components/ui/button'

export function GenerateStatReportButton() {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')

  async function generate() {
    setPending(true)
    setMessage('')
    try {
      const response = await fetch('/api/monthly-stat-reports', {
        method: 'POST',
        headers: { 'x-wf-report-request': 'paneladmin' },
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.message || 'No se pudo generar el informe.')
      setMessage(result.complete
        ? 'Informe generado correctamente.'
        : 'Informe guardado con avisos de fuentes no disponibles.')
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo generar el informe.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <Button type="button" onClick={generate} disabled={pending}>
        {pending ? 'Generando…' : 'Generar último mes ahora'}
      </Button>
      <p className="text-xs text-muted" aria-live="polite">{message}</p>
    </div>
  )
}
