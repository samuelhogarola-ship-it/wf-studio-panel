'use client'

import { useActionState } from 'react'
import { setProjectFavoriteAction, type ProjectFavoriteState } from '@/lib/actions/project-favorites'
import { Button } from '@/components/ui/button'

export function ProjectFavoriteForm({ projectId, isFavorite }: { projectId: string; isFavorite: boolean }) {
  const [state, action, pending] = useActionState(setProjectFavoriteAction, {} as ProjectFavoriteState)
  return <form action={action} className="flex flex-wrap items-center gap-3">
    <input type="hidden" name="project_id" value={projectId} />
    <input type="hidden" name="favorite" value={isFavorite ? 'false' : 'true'} />
    <Button type="submit" variant={isFavorite ? 'ghost' : 'secondary'} disabled={pending}>
      {pending ? 'Guardando…' : isFavorite ? 'Quitar de Inicio' : 'Añadir a Inicio'}
    </Button>
    {state.error ? <p role="alert" className="text-sm font-medium text-rose-600">{state.error}</p> : null}
    {state.success ? <p role="status" className="text-sm font-medium text-emerald-700">{state.success}</p> : null}
  </form>
}
