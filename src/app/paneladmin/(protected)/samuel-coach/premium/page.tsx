'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://hocdlmxzghwymamientc.supabase.co',
  'sb_publishable_d2RkD-vcqXebnAFs31AdHw_ti2Eb5qO'
)

interface PremiumCode {
  code: string
  customer_email: string
  duration_days: number
  status: string
  created_at: string
  redeemed_at: string | null
  redeemed_by: string | null
}

export default function PremiumCodesPage() {
  const [codes, setCodes] = useState<PremiumCode[]>([])
  const [filter, setFilter] = useState('active')
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    email: '',
    duration: '30',
    createdByType: 'studio-panel'
  })
  const [message, setMessage] = useState('')

  const loadCodes = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('list_premium_codes', {
        p_status: filter === 'all' ? null : filter
      })
      if (error) throw error
      setCodes(data || [])
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      setMessage('❌ Error cargando códigos: ' + errorMsg)
    }
    setLoading(false)
  }, [filter])

  useEffect(() => {
    loadCodes()
  }, [loadCodes])

  const generateCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data: code, error } = await supabase.rpc('generate_premium_code', {
        p_duration_days: parseInt(form.duration),
        p_customer_email: form.email,
        p_created_by_type: form.createdByType
      })

      if (error) throw error
      setMessage(`✅ Código generado: ${code}`)
      setForm({ email: '', duration: '30', createdByType: 'studio-panel' })
      loadCodes()
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      setMessage('❌ Error: ' + errorMsg)
    }
    setLoading(false)
  }

  const cancelCode = async (code: string) => {
    if (!confirm(`¿Cancelar código ${code}?`)) return

    setLoading(true)
    try {
      const { error } = await supabase.rpc('cancel_premium_code', {
        p_code: code
      })

      if (error) throw error
      setMessage('✅ Código cancelado')
      loadCodes()
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      setMessage('❌ Error al cancelar: ' + errorMsg)
    }
    setLoading(false)
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Gestión de Códigos Premium</h1>
      <p className="text-gray-600 mb-6">Genera, cancela y monitorea códigos de acceso premium para alumnos</p>

      {message && (
        <div className={`mb-4 p-4 rounded border ${
          message.startsWith('✅')
            ? 'bg-green-50 border-green-300 text-green-800'
            : 'bg-red-50 border-red-300 text-red-800'
        }`}>
          {message}
        </div>
      )}

      <div className="mb-6 p-6 bg-white rounded-lg border shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Generar Nuevo Código</h2>
        <form onSubmit={generateCode} className="flex gap-3 flex-wrap items-end">
          <div>
            <label className="block text-sm font-medium mb-1">Email del alumno</label>
            <input
              type="email"
              placeholder="alumno@example.com"
              value={form.email}
              onChange={(e) => setForm({...form, email: e.target.value})}
              required
              className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Duración</label>
            <select
              value={form.duration}
              onChange={(e) => setForm({...form, duration: e.target.value})}
              className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="30">1 mes</option>
              <option value="90">3 meses</option>
              <option value="180">6 meses</option>
              <option value="365">1 año</option>
              <option value="999">Ilimitado (2+ años)</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Generando...' : 'Generar Código'}
          </button>
        </form>
      </div>

      <div className="mb-4 flex gap-2 flex-wrap">
        {[
          { value: 'active', label: '🟢 Activos' },
          { value: 'used', label: '✅ Usados' },
          { value: 'cancelled', label: '❌ Cancelados' },
          { value: 'all', label: 'Todos' }
        ].map((option) => (
          <button
            key={option.value}
            onClick={() => setFilter(option.value)}
            className={`px-4 py-2 rounded font-medium transition ${
              filter === option.value
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-100 border-b">
                <th className="px-4 py-3 text-left font-semibold text-sm">Código</th>
                <th className="px-4 py-3 text-left font-semibold text-sm">Email</th>
                <th className="px-4 py-3 text-center font-semibold text-sm">Duración</th>
                <th className="px-4 py-3 text-center font-semibold text-sm">Estado</th>
                <th className="px-4 py-3 text-left font-semibold text-sm">Creado</th>
                <th className="px-4 py-3 text-left font-semibold text-sm">Usado</th>
                <th className="px-4 py-3 text-center font-semibold text-sm">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {codes.map((code) => (
                <tr key={code.code} className="border-b hover:bg-gray-50 transition">
                  <td className="px-4 py-3 font-mono text-sm bg-gray-50">{code.code}</td>
                  <td className="px-4 py-3 text-sm">{code.customer_email || '—'}</td>
                  <td className="px-4 py-3 text-center text-sm">{code.duration_days}d</td>
                  <td className="px-4 py-3 text-center text-sm">
                    {code.redeemed_at ? '✅ Usado' : code.status === 'active' ? '🟢 Activo' : '❌ Cancelado'}
                  </td>
                  <td className="px-4 py-3 text-sm">{new Date(code.created_at).toLocaleDateString('es-ES')}</td>
                  <td className="px-4 py-3 text-sm">{code.redeemed_at ? new Date(code.redeemed_at).toLocaleDateString('es-ES') : '—'}</td>
                  <td className="px-4 py-3 text-center">
                    {!code.redeemed_at && code.status === 'active' && (
                      <button
                        onClick={() => cancelCode(code.code)}
                        className="text-red-600 hover:text-red-800 font-medium text-sm"
                      >
                        Cancelar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {codes.length === 0 && !loading && (
          <div className="text-center py-8 text-gray-500">
            Sin códigos en esta categoría
          </div>
        )}

        {loading && (
          <div className="text-center py-8 text-gray-500">
            Cargando...
          </div>
        )}
      </div>
    </div>
  )
}
