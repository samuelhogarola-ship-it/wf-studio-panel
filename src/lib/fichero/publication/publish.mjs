import { parseDirectoryProfileInput } from '../validation.mjs'
import { safePublicationError } from './adapter.mjs'
import { mapConocePublication } from './map-conoce.mjs'
import { mapVivirPublication } from './map-vivir.mjs'

const mappers = {
  'vivir-fuengirola': mapVivirPublication,
  'conoce-fuengirola': mapConocePublication,
}

function validateSnapshot(snapshot) {
  if (snapshot.profile.reviewStatus !== 'approved') throw new Error('Profile must be approved before publication')
  const parsed = parseDirectoryProfileInput(snapshot.profile)
  if (!parsed.success) throw new Error('Profile validation failed before publication')
  if (!snapshot.channels.some(channel => channel.enabled)) throw new Error('Profile has no enabled publication channels')
  if (snapshot.channels.some(channel => channel.enabled && !channel.categorySlug)) throw new Error('Selecciona una categoría para cada canal activo antes de publicar.')
}

function channelFor(snapshot, key) {
  const channel = snapshot.channels.find(candidate => candidate.channelKey === key && candidate.enabled)
  if (!channel) throw new Error('Publication channel is not enabled')
  return channel
}

async function attemptEvent(snapshot, event, dependencies) {
  if (event.status === 'published') {
    return { channelKey: event.channelKey, sourceVersion: event.sourceVersion, status: 'published' }
  }
  const adapter = dependencies.adapters[event.channelKey]
  if (!adapter) throw new Error(`Publication adapter unavailable: ${event.channelKey}`)
  const channel = channelFor(snapshot, event.channelKey)
  const projection = mappers[event.channelKey](snapshot, channel, event.sourceVersion)
  if (projection.payload_hash !== event.payloadHash) {
    throw new Error('La ficha cambió desde este intento. Vuelve a revisarla antes de publicar.')
  }
  await dependencies.repository.markPublishing(event.eventId)
  try {
    const result = await adapter.publish(snapshot, channel, event.sourceVersion)
    await dependencies.repository.markPublished(event.eventId, result.remoteRecordId)
    return { channelKey: event.channelKey, sourceVersion: event.sourceVersion, status: 'published', remoteRecordId: result.remoteRecordId }
  } catch (error) {
    const safe = safePublicationError(error)
    await dependencies.repository.markFailed(event.eventId, safe)
    return { channelKey: event.channelKey, sourceVersion: event.sourceVersion, status: 'failed', errorCode: safe.code, errorMessage: safe.message }
  }
}

export async function publishApprovedProfileWithDependencies(profileId, dependencies) {
  const snapshot = await dependencies.repository.loadPublicationCandidate(profileId)
  validateSnapshot(snapshot)
  const nextVersion = snapshot.profile.contentVersion + 1
  const projections = snapshot.channels
    .filter(channel => channel.enabled)
    .map(channel => {
      const projection = mappers[channel.channelKey](snapshot, channel, nextVersion)
      return { channelId: channel.channelId, channelKey: channel.channelKey, publicSlug: channel.publicSlug, payloadHash: projection.payload_hash }
    })
  const prepared = await dependencies.repository.preparePublication(snapshot, projections)
  const channels = []
  for (const event of prepared.events) channels.push(await attemptEvent(snapshot, event, dependencies))
  return { profileId, sourceVersion: prepared.sourceVersion, channels }
}

export async function retryProfileChannelWithDependencies(profileId, channelKey, sourceVersion, dependencies) {
  const { snapshot, event } = await dependencies.repository.loadRetryCandidate(profileId, channelKey, sourceVersion)
  validateSnapshot(snapshot)
  const result = await attemptEvent(snapshot, event, dependencies)
  return { profileId, sourceVersion, channels: [result] }
}
