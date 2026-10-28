'use client'

import { cancelPremiumCodeAction } from '@/lib/actions/premium-codes'

export function PremiumCodeCancelForm({ code }: { code: string }) {
  return (
    <form
      action={cancelPremiumCodeAction}
      onSubmit={(event) => {
        if (!window.confirm(`¿Cancelar el código ${code}?`)) event.preventDefault()
      }}
    >
      <input type="hidden" name="code" value={code} />
      <button className="text-xs font-semibold text-rose-600">Cancelar</button>
    </form>
  )
}
