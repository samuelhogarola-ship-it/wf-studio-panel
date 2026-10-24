'use server'

import 'server-only'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { requireAdmin } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { normalizeSupportReturnPath, getOptionalSupportViewer } from '@/lib/support/portal-viewer'
import {
  SUPPORT_COOKIE_NAME,
  clearSupportCookie,
  createSupportSession,
  endSupportSession,
  supportCookie,
} from '@/lib/support/support-session'

const uuid = z.string().uuid()

function submitted(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value : ''
}

function requireEnabled() {
  if (process.env.WF_SUPPORT_PREVIEW_ENABLED !== 'true') {
    throw new Error('La vista de soporte está desactivada.')
  }
}

export async function startSupportPreviewAction(formData: FormData) {
  const identity = await requireAdmin()
  requireEnabled()
  const db = await createSupabaseServerClient()
  const projectId = submitted(formData, 'project_id')
  let clientId = submitted(formData, 'client_id')
  let returnPath: string

  if (projectId) {
    if (!uuid.safeParse(projectId).success) throw new Error('Se requiere un proyecto activo y accesible.')
    const { data: project, error } = await db.from('client_projects').select('id, client_id, status, client_access_enabled')
      .eq('id', projectId).maybeSingle()
    if (error || !project || project.status !== 'active' || !project.client_access_enabled || !project.client_id) {
      throw new Error('Se requiere un proyecto activo y accesible.')
    }
    clientId = project.client_id
    returnPath = `/paneladmin/proyectos/${project.id}`
  } else {
    if (!uuid.safeParse(clientId).success) throw new Error('Se requiere un cliente activo.')
    returnPath = `/paneladmin/clientes/${clientId}`
  }

  const { data: client, error: clientError } = await db.from('clients').select('id')
    .eq('id', clientId).eq('project', 'wf-studio').eq('status', 'active').maybeSingle()
  if (clientError || !client) throw new Error('Se requiere un cliente activo.')

  const requestedReturnPath = submitted(formData, 'return_path')
  if (normalizeSupportReturnPath(requestedReturnPath) !== requestedReturnPath || requestedReturnPath !== returnPath) {
    throw new Error('Ruta de retorno no válida.')
  }

  const created = await createSupportSession(db, {
    adminUserId: identity.userId,
    clientId: client.id,
    returnPath,
  })
  const cookieStore = await cookies()
  cookieStore.set(supportCookie(created.token, 30 * 60))
  redirect('/cliente/dashboard')
}

export async function endSupportPreviewAction() {
  const identity = await requireAdmin()
  const viewer = await getOptionalSupportViewer()
  if (!viewer) redirect('/paneladmin/inicio')

  const cookieStore = await cookies()
  const token = cookieStore.get(SUPPORT_COOKIE_NAME)?.value
  const db = await createSupabaseServerClient()
  await endSupportSession(db, { adminUserId: identity.userId, token }, 'manual')
  cookieStore.set(clearSupportCookie())
  redirect(viewer.returnPath)
}
