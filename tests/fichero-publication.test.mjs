import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import {
  publishApprovedProfileWithDependencies,
  retryProfileChannelWithDependencies,
} from '../src/lib/fichero/publication/publish.mjs'

function candidate(reviewStatus = 'approved') {
  return {
    sourceUpdatedAt: '2026-10-30T12:00:00.000Z',
    profile: {
      id: '10000000-0000-4000-8000-000000000001', catalogId: '10000000-0000-4000-8000-000000000002',
      canonicalSlug: 'academia-sol', legalName: 'Academia Sol SL', displayName: 'Academia Sol', cif: 'B12345678',
      contactEmail: 'hola@academiasol.test', phone: '+34952000000', whatsapp: null, website: 'https://academiasol.test/',
      address: 'Calle Sol 1', latitude: 36.54, longitude: -4.62, categoryKey: 'educacion', categoryLabel: 'Educación',
      neighborhoodKeys: ['centro'], shortDescription: 'Academia local', longDescription: 'Formación local.', seoTitle: null,
      seoDescription: null, services: ['Idiomas'], schedule: ['L-V 09:00-18:00'], photos: [], plan: 'pro',
      reviewStatus, contentVersion: 0,
    },
    channels: [
      { channelId: '20000000-0000-4000-8000-000000000001', channelKey: 'vivir-fuengirola', enabled: true, publicSlug: 'academia-sol', editorialPlacement: false },
      { channelId: '20000000-0000-4000-8000-000000000002', channelKey: 'conoce-fuengirola', enabled: true, publicSlug: 'academia-sol', editorialPlacement: false },
    ],
  }
}

function harness({ statusByChannel = {}, failChannel } = {}) {
  const calls = []
  const stored = new Map()
  let contentVersion = 0
  const repository = {
    async loadPublicationCandidate() { calls.push('load'); return candidate() },
    async preparePublication(_candidate, projections) {
      calls.push('prepare')
      if (stored.size === 0) contentVersion += 1
      for (const projection of projections) {
        if (!stored.has(projection.channelKey)) stored.set(projection.channelKey, {
          eventId: `event-${projection.channelKey}`, channelId: projection.channelId, channelKey: projection.channelKey,
          publicSlug: projection.publicSlug, sourceVersion: contentVersion, payloadHash: projection.payloadHash,
          status: statusByChannel[projection.channelKey] ?? 'pending',
        })
      }
      return { sourceVersion: contentVersion, events: [...stored.values()] }
    },
    async loadRetryCandidate(_profileId, channelKey, sourceVersion) {
      calls.push(`retry:${channelKey}`)
      const event = stored.get(channelKey)
      if (!event || event.sourceVersion !== sourceVersion) throw new Error('missing event')
      return { snapshot: candidate(), event }
    },
    async markPublishing(eventId) { calls.push(`publishing:${eventId}`) },
    async markPublished(eventId, remoteRecordId) { calls.push(`published:${eventId}:${remoteRecordId}`); stored.get(eventId.replace('event-', '')).status = 'published' },
    async markFailed(eventId, error) { calls.push(`failed:${eventId}:${error.code}:${error.message}`); stored.get(eventId.replace('event-', '')).status = 'failed' },
  }
  const adapters = Object.fromEntries(['vivir-fuengirola', 'conoce-fuengirola'].map(channelKey => [channelKey, {
    async publish(_snapshot, _channel, version) {
      calls.push(`adapter:${channelKey}:${version}`)
      if (channelKey === failChannel) throw new Error('service_role=top-secret; raw response body'.repeat(100))
      return { remoteRecordId: `${channelKey}-remote` }
    },
  }]))
  return { repository, adapters, calls, stored, get contentVersion() { return contentVersion } }
}

test('draft and rejected profiles fail validation before any version increment', async () => {
  for (const status of ['draft', 'rejected']) {
    let prepared = false
    const repository = {
      async loadPublicationCandidate() { return candidate(status) },
      async preparePublication() { prepared = true },
    }
    await assert.rejects(publishApprovedProfileWithDependencies(candidate().profile.id, { repository, adapters: {} }), /approved/i)
    assert.equal(prepared, false)
  }
})

test('one publish increments once and attempts every enabled channel once', async () => {
  const h = harness()
  const result = await publishApprovedProfileWithDependencies(candidate().profile.id, h)
  assert.equal(h.contentVersion, 1)
  assert.deepEqual(h.calls.filter(call => call.startsWith('adapter:')), ['adapter:vivir-fuengirola:1', 'adapter:conoce-fuengirola:1'])
  assert.deepEqual(result.channels.map(channel => channel.status), ['published', 'published'])
})

test('partial failure persists independent results and keeps the approved version retryable', async () => {
  const h = harness({ failChannel: 'conoce-fuengirola' })
  const result = await publishApprovedProfileWithDependencies(candidate().profile.id, h)
  assert.deepEqual(result.channels.map(channel => [channel.channelKey, channel.status]), [
    ['vivir-fuengirola', 'published'], ['conoce-fuengirola', 'failed'],
  ])
  const failed = h.calls.find(call => call.startsWith('failed:'))
  assert.ok(failed.length < 400)
  assert.doesNotMatch(failed, /top-secret|raw response|service_role/i)

  h.adapters['conoce-fuengirola'].publish = async (_snapshot, _channel, version) => {
    h.calls.push(`adapter:conoce-fuengirola:${version}`)
    return { remoteRecordId: 'conoce-recovered' }
  }
  await retryProfileChannelWithDependencies(candidate().profile.id, 'conoce-fuengirola', 1, h)
  assert.equal(h.contentVersion, 1)
  assert.equal(h.calls.filter(call => call.startsWith('adapter:vivir-fuengirola')).length, 1)
  assert.equal(h.calls.filter(call => call.startsWith('adapter:conoce-fuengirola')).length, 2)
})

test('publishing an already published version is a no-op', async () => {
  const h = harness({ statusByChannel: { 'vivir-fuengirola': 'published', 'conoce-fuengirola': 'published' } })
  const result = await publishApprovedProfileWithDependencies(candidate().profile.id, h)
  assert.equal(h.contentVersion, 1)
  assert.equal(h.calls.filter(call => call.startsWith('adapter:')).length, 0)
  assert.deepEqual(result.channels.map(channel => channel.status), ['published', 'published'])
})

test('production wiring is admin-only, lazily configured and transactionally prepares events', async () => {
  const [env, server, repository, actions, migration] = await Promise.all([
    readFile(new URL('../src/lib/env.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/lib/supabase/server.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/lib/fichero/repository.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/lib/actions/fichero.ts', import.meta.url), 'utf8'),
    readFile(new URL('../supabase/migrations/202610300003_fichero_publication.sql', import.meta.url), 'utf8'),
  ])
  for (const name of [
    'FICHERO_PUBLISHING_ENABLED',
    'VIVIR_FUENGIROLA_SUPABASE_URL',
    'VIVIR_FUENGIROLA_SUPABASE_SERVICE_ROLE_KEY',
    'CONOCE_FUENGIROLA_SUPABASE_URL',
    'CONOCE_FUENGIROLA_SUPABASE_SERVICE_ROLE_KEY',
  ]) assert.match(env + server, new RegExp(name))
  assert.match(server, /createVivirFuengirolaAdminClient/)
  assert.match(server, /createConoceFuengirolaAdminClient/)
  assert.match(repository, /prepare_directory_publication/)
  assert.match(repository, /begin_directory_publication_event/)
  assert.match(repository, /finish_directory_publication_event/)
  assert.match(actions, /await requireAdmin\(\)/)
  assert.match(actions, /publishApprovedProfileWithDependencies/)
  assert.match(actions, /retryProfileChannelWithDependencies/)
  assert.match(migration, /for update/i)
  assert.match(migration, /content_version = content_version \+ 1/i)
  assert.match(migration, /unique \(profile_id, channel_id, source_version\)/i)
  assert.doesNotMatch(migration, /http|net\.|curl/i)
})
