'use client'

import { useLayoutEffect } from 'react'

export function DashboardScrollReset() {
  useLayoutEffect(() => {
    if (!window.matchMedia('(max-width: 1023px)').matches) return
    const reset = () => window.scrollTo(0, 0)
    reset()
    const frame = window.requestAnimationFrame(reset)
    return () => window.cancelAnimationFrame(frame)
  }, [])

  return null
}
