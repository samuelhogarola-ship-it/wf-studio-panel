'use server'

import 'server-only'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export type ProjectFavoriteState = { error?: string; success?: string }

const favoriteSchema = z.object({
  project_id: z.string().uuid(),
  favorite: z.enum(['true', 'false']),
})

const failure = (): ProjectFavoriteState => ({ error: 'No se pudo actualizar el proyecto favorito.' })

export async function setProjectFavoriteAction(
  _previousState: ProjectFavoriteState,
  formData: FormData,
): Promise<ProjectFavoriteState> {
  const admin = await requireAdmin()
  const parsed = favoriteSchema.safeParse({
    project_id: formData.get('project_id'),
    favorite: formData.get('favorite'),
  })
  if (!parsed.success) return failure()

  const db = await createSupabaseServerClient()
  const { project_id: projectId, favorite } = parsed.data
  const result = favorite === 'true'
    ? await db.from('admin_project_favorites').upsert(
      { admin_user_id: admin.userId, project_id: projectId },
      { onConflict: 'admin_user_id,project_id' },
    )
    : await db.from('admin_project_favorites').delete()
      .eq('admin_user_id', admin.userId).eq('project_id', projectId)
  if (result.error) return failure()

  revalidatePath('/paneladmin/inicio')
  revalidatePath('/paneladmin/proyectos')
  revalidatePath(`/paneladmin/proyectos/${projectId}`)
  return { success: favorite === 'true' ? 'Proyecto añadido a Inicio.' : 'Proyecto eliminado de Inicio.' }
}
