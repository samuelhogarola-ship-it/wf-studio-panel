'use client'

import { useTransition } from 'react'

import { approveTrainer, rejectTrainer } from '@/lib/actions/superentrenador'

export function TrainerActions({ id, reviewStatus }: { id: string; reviewStatus: string | null }) {
  const [isPending, startTransition] = useTransition()

  if (reviewStatus === 'approved') {
    return (
      <button
        disabled={isPending}
        onClick={() => startTransition(() => rejectTrainer(id))}
        className="rounded-md px-3 py-1.5 text-xs font-medium bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors disabled:opacity-50"
      >
        Rechazar
      </button>
    )
  }

  if (reviewStatus === 'rejected') {
    return (
      <button
        disabled={isPending}
        onClick={() => startTransition(() => approveTrainer(id))}
        className="rounded-md px-3 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50"
      >
        Aprobar
      </button>
    )
  }

  // pending or null
  return (
    <div className="flex gap-2">
      <button
        disabled={isPending}
        onClick={() => startTransition(() => approveTrainer(id))}
        className="rounded-md px-3 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50"
      >
        Aprobar
      </button>
      <button
        disabled={isPending}
        onClick={() => startTransition(() => rejectTrainer(id))}
        className="rounded-md px-3 py-1.5 text-xs font-medium bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors disabled:opacity-50"
      >
        Rechazar
      </button>
    </div>
  )
}
