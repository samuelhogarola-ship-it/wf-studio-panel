'use client'

import { useLayoutEffect } from 'react'

export function DashboardScrollReset() {
  useLayoutEffect(() => {
    if (window.matchMedia('(max-width: 1023px)').matches) {
      window.scrollTo(0, 0)
    }
  }, [])

  return null
}
