'use server'

import { revalidatePath } from 'next/cache'

import { requireAdmin } from '@/lib/auth'
import { publishApprovedProfile, retryProfileChannel } from '@/lib/actions/fichero'
import { findDirectoryProfileDuplicates } from '@/lib/fichero/admin'
import { parseDirectoryProfileInput } from '@/lib/fichero/validation.mjs'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { DirectoryChannelKey, PublicationResult } from '@/lib/fichero/publication/types'

export type FicheroActionState = {
  error?: string
  success?: string
  profileId?: string
  profileHref?: string
  publication?: PublicationResult
  duplicates?: Array<{ id: string; displayName: string; canonicalSlug: string }>
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const channelKeys: DirectoryChannelKey[] = ['vivir-fuengirola', 'conoce-fuengirola']

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim()
}

function nullable(value: string) {
  return value || null
}

function lines(value: string) {
  return value.split(/\r?\n/).map(item => item.trim()).filter(Boolean)
}

function safeError(): FicheroActionState {
  return { error: 'No se pudo completar la operación de Fichero.' }
}

function revalidateProfile(catalogKey: string, profileId: string) {
  revalidatePath(`/paneladmin/fichero/${catalogKey}`)
  revalidatePath(`/paneladmin/fichero/${catalogKey}/fichas`)
  revalidatePath(`/paneladmin/fichero/${catalogKey}/fichas/${profileId}`)
  revalidatePath(`/paneladmin/fichero/${catalogKey}/publicaciones`)
}

export async function saveDirectoryProfileAction(
  _previous: FicheroActionState,
  formData: FormData,
): Promise<FicheroActionState> {
  await requireAdmin()
  const catalogKey = value(formData, 'catalogKey')
  const requestedProfileId = value(formData, 'profileId')
  const profileId = UUID_PATTERN.test(requestedProfileId) ? requestedProfileId : null
  const db = await createSupabaseServerClient()
  const { data: catalog } = await db.from('directory_catalogs').select('id,key').eq('key', catalogKey).eq('status', 'active').maybeSingle()
  if (!catalog) return { error: 'El directorio no existe.' }

  const parsed = parseDirectoryProfileInput({
    canonicalSlug: value(formData, 'canonicalSlug'), legalName: value(formData, 'legalName'), displayName: value(formData, 'displayName'),
    cif: value(formData, 'cif'), contactEmail: value(formData, 'contactEmail'), phone: value(formData, 'phone'), whatsapp: value(formData, 'whatsapp'),
    website: value(formData, 'website'), address: value(formData, 'address'),
    latitude: value(formData, 'latitude') ? Number(value(formData, 'latitude')) : null,
    longitude: value(formData, 'longitude') ? Number(value(formData, 'longitude')) : null,
    categoryKey: value(formData, 'categoryKey'), categoryLabel: value(formData, 'categoryLabel'),
    neighborhoodKeys: lines(value(formData, 'neighborhoodKeys')), shortDescription: value(formData, 'shortDescription'),
    longDescription: value(formData, 'longDescription'), seoTitle: value(formData, 'seoTitle'), seoDescription: value(formData, 'seoDescription'),
    services: lines(value(formData, 'services')), schedule: lines(value(formData, 'schedule')), photos: lines(value(formData, 'photos')),
    plan: value(formData, 'plan'),
  })
  if (!parsed.success) return { error: Object.values(parsed.fieldErrors).flat()[0] ?? 'Revisa los campos de la ficha.' }

  const duplicates = await findDirectoryProfileDuplicates({
    catalogId: catalog.id, profileId: profileId ?? undefined, cif: parsed.data.cif,
    email: parsed.data.contactEmail, displayName: parsed.data.displayName,
  })
  if (duplicates.length > 0 && value(formData, 'duplicate_reviewed') !== 'yes') {
    return {
      error: 'Hay coincidencias que requieren revisión humana antes de guardar.',
      duplicates: duplicates.map(item => ({ id: item.id, displayName: item.displayName, canonicalSlug: item.canonicalSlug })),
    }
  }

  const payload = {
    catalog_id: catalog.id, owner_user_id: nullable(value(formData, 'ownerUserId')),
    canonical_slug: parsed.data.canonicalSlug, legal_name: parsed.data.legalName, display_name: parsed.data.displayName,
    cif: parsed.data.cif, contact_email: parsed.data.contactEmail, phone: parsed.data.phone, whatsapp: parsed.data.whatsapp,
    website: parsed.data.website, address: parsed.data.address, latitude: parsed.data.latitude, longitude: parsed.data.longitude,
    category_key: parsed.data.categoryKey, category_label: parsed.data.categoryLabel, neighborhood_keys: parsed.data.neighborhoodKeys,
    short_description: parsed.data.shortDescription, long_description: parsed.data.longDescription,
    seo_title: parsed.data.seoTitle, seo_description: parsed.data.seoDescription, services: parsed.data.services,
    schedule: parsed.data.schedule, photos: parsed.data.photos, plan: parsed.data.plan, review_status: 'draft' as const,
    approved_at: null, approved_by: null,
  }
  const result = profileId
    ? await db.from('directory_profiles').update(payload).eq('id', profileId).eq('catalog_id', catalog.id).select('id').single()
    : await db.from('directory_profiles').insert(payload).select('id').single()
  if (result.error || !result.data) return safeError()
  const savedId = result.data.id

  const { data: channels, error: channelError } = await db.from('directory_channels').select('id,key').eq('catalog_id', catalog.id).eq('status', 'active')
  if (channelError || !channels) return safeError()
  for (const channel of channels) {
    if (!channelKeys.includes(channel.key as DirectoryChannelKey)) continue
    const key = channel.key as DirectoryChannelKey
    const { error } = await db.from('directory_profile_channels').upsert({
      profile_id: savedId, channel_id: channel.id,
      enabled: formData.get(`channel_${key}_enabled`) === 'on',
      public_slug: value(formData, `channel_${key}_slug`) || parsed.data.canonicalSlug,
      editorial_placement: parsed.data.plan === 'premium',
    }, { onConflict: 'profile_id,channel_id' })
    if (error) return safeError()
  }
  revalidateProfile(catalogKey, savedId)
  return { success: 'Borrador guardado para revisión.', profileId: savedId, profileHref: `/paneladmin/fichero/${catalogKey}/fichas/${savedId}` }
}

export async function reviewDirectoryProfileAction(
  _previous: FicheroActionState,
  formData: FormData,
): Promise<FicheroActionState> {
  await requireAdmin()
  const profileId = value(formData, 'profileId')
  const catalogKey = value(formData, 'catalogKey')
  const decision = value(formData, 'decision')
  const note = value(formData, 'note')
  if (!UUID_PATTERN.test(profileId) || !['approve', 'approve_publish', 'reject'].includes(decision)) return { error: 'Acción de revisión inválida.' }
  if (decision === 'reject' && !note) return { error: 'La nota es obligatoria para rechazar una ficha.' }
  if (decision === 'approve_publish' && formData.get('confirm_publish') !== 'on') return { error: 'Confirma los canales antes de publicar.' }
  const db = await createSupabaseServerClient()
  const approved = decision !== 'reject'
  const { error: reviewError } = await db.rpc('review_directory_profile', {
    p_profile_id: profileId,
    p_decision: approved ? 'approved' : 'rejected',
    p_note: note || null,
  })
  if (reviewError) return safeError()
  revalidateProfile(catalogKey, profileId)
  if (decision === 'approve_publish') {
    try {
      const publication = await publishApprovedProfile(profileId)
      return { success: 'Ficha aprobada y publicación procesada.', profileId, publication }
    } catch { return { error: 'La ficha quedó aprobada, pero no se pudo iniciar la publicación.', profileId } }
  }
  return { success: approved ? 'Ficha aprobada. Aún no se ha publicado.' : 'Ficha rechazada.', profileId }
}

export async function retryDirectoryProfileChannelAction(
  _previous: FicheroActionState,
  formData: FormData,
): Promise<FicheroActionState> {
  await requireAdmin()
  const profileId = value(formData, 'profileId')
  const catalogKey = value(formData, 'catalogKey')
  const channelKey = value(formData, 'channel_key') as DirectoryChannelKey
  const sourceVersion = Number(value(formData, 'source_version'))
  if (!UUID_PATTERN.test(profileId) || !channelKeys.includes(channelKey) || !Number.isInteger(sourceVersion) || sourceVersion < 1) return { error: 'Reintento inválido.' }
  try {
    const publication = await retryProfileChannel(profileId, channelKey, sourceVersion)
    revalidateProfile(catalogKey, profileId)
    return { success: 'Reintento procesado para el canal seleccionado.', profileId, publication }
  } catch { return safeError() }
}
