'use client'

import Link from 'next/link'
import { useEffect, useMemo, useReducer } from 'react'

import type { ClientAnalyticsSummary } from '@/lib/analytics/client-summary'

export const DEFAULT_ROTATION_INTERVAL_MS = 6_000

export type RotatorState = {
  index: number
  elapsedMs: number
  manualPaused: boolean
  hoverPaused: boolean
  focusPaused: boolean
  reducedMotion: boolean
}

export type RotatorAction =
  | { type: 'advance'; elapsedMs: number; intervalMs: number; itemCount: number }
  | { type: 'next' | 'previous'; itemCount: number }
  | { type: 'set-manual-paused'; paused: boolean }
  | { type: 'set-hover-paused'; paused: boolean }
  | { type: 'set-focus-paused'; paused: boolean }
  | { type: 'set-reduced-motion'; reducedMotion: boolean }
  | { type: 'sync-items'; itemCount: number }

export function createRotatorState(itemCount: number, reducedMotion: boolean): RotatorState {
  return {
    index: 0,
    elapsedMs: 0,
    manualPaused: false,
    hoverPaused: false,
    focusPaused: false,
    reducedMotion,
  }
}

function rotationPaused(state: RotatorState) {
  return state.manualPaused || state.hoverPaused || state.focusPaused || state.reducedMotion
}

export function getRotationControlState(state: RotatorState) {
  if (state.reducedMotion) return {
    disabled: true,
    label: 'Rotación desactivada por movimiento reducido',
    text: 'Movimiento reducido',
  }
  return state.manualPaused
    ? { disabled: false, label: 'Reanudar rotación', text: 'Reanudar' }
    : { disabled: false, label: 'Pausar rotación', text: 'Pausar' }
}

export function reduceRotatorState(state: RotatorState, action: RotatorAction): RotatorState {
  if (action.type === 'set-manual-paused') return { ...state, manualPaused: action.paused, elapsedMs: 0 }
  if (action.type === 'set-hover-paused') return { ...state, hoverPaused: action.paused }
  if (action.type === 'set-focus-paused') return { ...state, focusPaused: action.paused }
  if (action.type === 'set-reduced-motion') return { ...state, reducedMotion: action.reducedMotion, elapsedMs: 0 }

  if (action.type === 'sync-items') {
    return { ...state, index: action.itemCount > 0 ? state.index % action.itemCount : 0, elapsedMs: 0 }
  }

  if (action.type !== 'advance') {
    if (action.itemCount <= 1) return { ...state, index: 0, elapsedMs: 0 }
    return action.type === 'next'
      ? { ...state, index: (state.index + 1) % action.itemCount, elapsedMs: 0 }
      : { ...state, index: (state.index - 1 + action.itemCount) % action.itemCount, elapsedMs: 0 }
  }

  if (action.itemCount <= 1) return { ...state, index: 0, elapsedMs: 0 }
  if (rotationPaused(state) || action.intervalMs <= 0) return state
  const elapsedMs = state.elapsedMs + Math.max(0, action.elapsedMs)
  const steps = Math.floor(elapsedMs / action.intervalMs)
  return {
    ...state,
    index: (state.index + steps) % action.itemCount,
    elapsedMs: elapsedMs % action.intervalMs,
  }
}

type RotatingAnalyticsSummaryProps = {
  summaries: readonly ClientAnalyticsSummary[]
  intervalMs?: number
}

export function RotatingAnalyticsSummary({
  summaries,
  intervalMs = DEFAULT_ROTATION_INTERVAL_MS,
}: RotatingAnalyticsSummaryProps) {
  const metrics = useMemo(() => summaries.flatMap((summary) => [
    { ...summary, label: 'Páginas vistas', value: summary.pageviews },
    { ...summary, label: 'Visitantes', value: summary.visitors },
    { ...summary, label: 'Visitas', value: summary.visits },
  ]), [summaries])
  const [state, dispatch] = useReducer(
    reduceRotatorState,
    metrics.length,
    (itemCount) => createRotatorState(itemCount, false),
  )
  const paused = rotationPaused(state)
  const rotationControl = getRotationControlState(state)

  useEffect(() => {
    dispatch({ type: 'sync-items', itemCount: metrics.length })
  }, [metrics.length])

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => dispatch({ type: 'set-reduced-motion', reducedMotion: media.matches })
    update()
    media.addEventListener?.('change', update)
    return () => media.removeEventListener?.('change', update)
  }, [])

  useEffect(() => {
    if (metrics.length <= 1 || paused ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setInterval(() => {
      dispatch({ type: 'advance', elapsedMs: intervalMs, intervalMs, itemCount: metrics.length })
    }, intervalMs)
    return () => window.clearInterval(timer)
  }, [intervalMs, metrics.length, paused])

  if (metrics.length === 0) {
    return (
      <section aria-labelledby="analytics-summary-heading" className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 id="analytics-summary-heading" className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Estadísticas</h2>
        <p className="mt-4 text-sm text-slate-500">Todavía no hay estadísticas disponibles para tus webs.</p>
        <Link href="/cliente/proyectos" className="mt-4 inline-block text-sm font-semibold text-brand hover:underline">Ver webs →</Link>
      </section>
    )
  }

  const metric = metrics[state.index] ?? metrics[0]
  return (
    <section
      aria-labelledby="analytics-summary-heading"
      className="rounded-2xl border border-slate-200 bg-white p-5"
      onMouseEnter={() => dispatch({ type: 'set-hover-paused', paused: true })}
      onMouseLeave={() => dispatch({ type: 'set-hover-paused', paused: false })}
      onFocusCapture={() => dispatch({ type: 'set-focus-paused', paused: true })}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          dispatch({ type: 'set-focus-paused', paused: false })
        }
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div aria-live="polite" aria-atomic="true">
          <h2 id="analytics-summary-heading" className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Estadísticas</h2>
          <p className="mt-3 text-sm font-semibold text-slate-600">{metric.projectName}</p>
          <p className="mt-1 text-3xl font-black text-foreground">{metric.value.toLocaleString('es-ES')}</p>
          <p className="text-sm text-slate-500">{metric.label}</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">30 días</span>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <button type="button" aria-label="Métrica anterior" onClick={() => dispatch({ type: 'previous', itemCount: metrics.length })} className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">←</button>
        <button type="button" aria-label={rotationControl.label} disabled={rotationControl.disabled} onClick={() => dispatch({ type: 'set-manual-paused', paused: !state.manualPaused })} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">{rotationControl.text}</button>
        <button type="button" aria-label="Métrica siguiente" onClick={() => dispatch({ type: 'next', itemCount: metrics.length })} className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">→</button>
        <Link href={`/cliente/proyectos/${encodeURIComponent(metric.projectSlug)}/estadisticas`} className="ml-auto text-xs font-semibold text-brand hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">Ver detalle →</Link>
      </div>
    </section>
  )
}
