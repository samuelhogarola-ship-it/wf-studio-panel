'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { requireAdmin } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { PlatformRequestPlatform } from '@/lib/supabase/types'

export type PlatformRequestActionState = {
  error?: string
  success?: string
  clientId?: string
  clientHref?: string
  profileId?: string
  profileHref?: string
}

const requestIdSchema = z.string().uuid()
const rejectionReasonSchema = z.string().trim().max(500)

const PLATFORM_PATHS: Record<PlatformRequestPlatform, { inbox: string; list: string }> = {
  'vivir-fuengirola': {
    inbox: '/paneladmin/vivir-en-fuengirola/solicitudes',
    list: '/paneladmin/vivir-en-fuengirola/clientes',
  },
  'vivir-fuengirola-negocios': {
    inbox: '/paneladmin/vivir-en-fuengirola/solicitudes',
    list: '/paneladmin/vivir-en-fuengirola/negocios',
  },
  'conoce-fuengirola': {
    inbox: '/paneladmin/conoce-fuengirola/solicitudes',
    list: '/paneladmin/conoce-fuengirola/clientes',
  },
}

async function loadStoredRequest(requestId: string) {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('platform_requests')
    .select('id,platform,request_type,status')
    .eq('id', requestId)
    .maybeSingle()
  if (error || !data) return { supabase, request: null }
  return { supabase, request: data }
}

function revalidateRequestViews(platform: PlatformRequestPlatform, clientId?: string, profileId?: string) {
  const paths = PLATFORM_PATHS[platform]
  revalidatePath('/paneladmin/inicio')
  revalidatePath(paths.inbox)
  revalidatePath(paths.list)
  if (clientId) revalidatePath(`/paneladmin/clientes/${clientId}`)
  if (profileId) {
    revalidatePath('/paneladmin/fichero/fuengirola/fichas')
    revalidatePath(`/paneladmin/fichero/fuengirola/fichas/${profileId}`)
  }
}

function safeRpcError(message: string | undefined): PlatformRequestActionState {
  if (message?.toLowerCase().includes('already resolved')) return { error: 'La solicitud ya fue resuelta.' }
  if (message?.toLowerCase().includes('not found')) return { error: 'La solicitud no existe.' }
  return { error: 'No se pudo actualizar la solicitud.' }
}

export async function approvePlatformRequestAction(
  _previous: PlatformRequestActionState,
  formData: FormData,
): Promise<PlatformRequestActionState> {
  await requireAdmin()
  const parsedId = requestIdSchema.safeParse(formData.get('request_id'))
  if (!parsedId.success) return { error: 'La solicitud no es válida.' }

  const { supabase, request } = await loadStoredRequest(parsedId.data)
  if (!request) return { error: 'La solicitud no existe.' }
  if (request.request_type === 'business') {
    const { data, error } = await supabase.rpc('approve_directory_request', {
      p_request_id: parsedId.data,
      p_profile_patch: {},
    })
    if (error) return safeRpcError(error.message)
    const result = data?.[0]
    if (!result) return { error: 'No se pudo actualizar la solicitud.' }

    revalidateRequestViews(request.platform, undefined, result.profile_id)
    return {
      success: result.outcome === 'created_profile'
        ? 'Ficha creada para revisión.'
        : 'Solicitud ya enlazada a una ficha.',
      profileId: result.profile_id,
      profileHref: `/paneladmin/fichero/fuengirola/fichas/${result.profile_id}`,
    }
  }
  const { data, error } = await supabase.rpc('approve_platform_request', { p_request_id: parsedId.data })
  if (error) return safeRpcError(error.message)
  const result = data?.[0]
  if (!result) return { error: 'No se pudo actualizar la solicitud.' }

  revalidateRequestViews(request.platform, result.client_id)
  return {
    success: result.outcome === 'created_client'
      ? 'Solicitud aprobada y cliente creado.'
      : 'Solicitud aprobada y enlazada al cliente existente.',
    clientId: result.client_id,
    clientHref: `/paneladmin/clientes/${result.client_id}`,
  }
}

export async function rejectPlatformRequestAction(
  _previous: PlatformRequestActionState,
  formData: FormData,
): Promise<PlatformRequestActionState> {
  await requireAdmin()
  const parsedId = requestIdSchema.safeParse(formData.get('request_id'))
  if (!parsedId.success) return { error: 'La solicitud no es válida.' }
  const parsedReason = rejectionReasonSchema.safeParse(String(formData.get('reason') ?? ''))
  if (!parsedReason.success) return { error: 'El motivo no puede superar 500 caracteres.' }

  const { supabase, request } = await loadStoredRequest(parsedId.data)
  if (!request) return { error: 'La solicitud no existe.' }
  const { error } = await supabase.rpc('reject_platform_request', {
    p_request_id: parsedId.data,
    p_reason: parsedReason.data || null,
  })
  if (error) return safeRpcError(error.message)

  revalidateRequestViews(request.platform)
  return { success: 'Solicitud rechazada.' }
}
