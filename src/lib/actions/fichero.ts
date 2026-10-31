'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { requireAdmin } from '@/lib/auth'
import { requireFicheroPublishingEnabled } from '@/lib/env'
import { createSupabaseChannelAdapter } from '@/lib/fichero/publication/adapter.mjs'
import { mapConocePublication } from '@/lib/fichero/publication/map-conoce.mjs'
import { mapVivirPublication } from '@/lib/fichero/publication/map-vivir.mjs'
import {
  publishApprovedProfileWithDependencies,
  retryProfileChannelWithDependencies,
} from '@/lib/fichero/publication/publish.mjs'
import type { DirectoryChannelKey } from '@/lib/fichero/publication/types'
import { createDirectoryPublicationRepository } from '@/lib/fichero/repository'
import {
  createConoceFuengirolaAdminClient,
  createVivirFuengirolaAdminClient,
} from '@/lib/supabase/server'

const profileIdSchema = z.string().uuid()
const channelKeySchema = z.enum(['vivir-fuengirola', 'conoce-fuengirola'])
const sourceVersionSchema = z.number().int().positive()

function adapters() {
  return {
    'vivir-fuengirola': createSupabaseChannelAdapter({
      channelKey: 'vivir-fuengirola',
      schema: 'public',
      table: 'businesses',
      getClient: createVivirFuengirolaAdminClient,
      map: mapVivirPublication,
    }),
    'conoce-fuengirola': createSupabaseChannelAdapter({
      channelKey: 'conoce-fuengirola',
      schema: 'conoce',
      table: 'businesses',
      getClient: createConoceFuengirolaAdminClient,
      map: mapConocePublication,
    }),
  }
}

function revalidateProfile(profileId: string) {
  revalidatePath('/paneladmin/fichero/fuengirola/fichas')
  revalidatePath(`/paneladmin/fichero/fuengirola/fichas/${profileId}`)
}

export async function publishApprovedProfile(profileId: string) {
  await requireAdmin()
  requireFicheroPublishingEnabled()
  const parsedId = profileIdSchema.parse(profileId)
  const repository = await createDirectoryPublicationRepository()
  const result = await publishApprovedProfileWithDependencies(parsedId, { repository, adapters: adapters() })
  revalidateProfile(parsedId)
  return result
}

export async function retryProfileChannel(
  profileId: string,
  channelKey: DirectoryChannelKey,
  sourceVersion: number,
) {
  await requireAdmin()
  requireFicheroPublishingEnabled()
  const parsedId = profileIdSchema.parse(profileId)
  const parsedChannel = channelKeySchema.parse(channelKey)
  const parsedVersion = sourceVersionSchema.parse(sourceVersion)
  const repository = await createDirectoryPublicationRepository()
  const result = await retryProfileChannelWithDependencies(
    parsedId,
    parsedChannel,
    parsedVersion,
    { repository, adapters: adapters() },
  )
  revalidateProfile(parsedId)
  return result
}
