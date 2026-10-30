import test from 'node:test'
import assert from 'node:assert/strict'

import { createSupabaseChannelAdapter } from '../src/lib/fichero/publication/adapter.mjs'
import { mapConocePublication } from '../src/lib/fichero/publication/map-conoce.mjs'
import { mapVivirPublication } from '../src/lib/fichero/publication/map-vivir.mjs'

const snapshot = {
  sourceUpdatedAt: '2026-10-30T12:00:00.000Z',
  profile: {
    id: '10000000-0000-4000-8000-000000000001',
    catalogId: '10000000-0000-4000-8000-000000000002',
    ownerUserId: '30000000-0000-4000-8000-000000000001',
    canonicalSlug: 'academia-sol',
    legalName: 'Academia Sol SL',
    displayName: 'Academia Sol',
    cif: 'B12345678',
    contactEmail: 'hola@academiasol.test',
    phone: '+34952000000',
    whatsapp: '+34600000000',
    website: 'https://academiasol.test/',
    address: 'Calle Sol 1',
    latitude: 36.54,
    longitude: -4.62,
    categoryKey: 'educacion',
    categoryLabel: 'Educación',
    neighborhoodKeys: ['centro'],
    shortDescription: 'Academia local',
    longDescription: 'Formación local en Fuengirola.',
    seoTitle: 'Academia Sol en Fuengirola',
    seoDescription: 'Formación local.',
    services: ['Idiomas'],
    schedule: ['L-V 09:00-18:00'],
    photos: ['https://academiasol.test/foto.jpg'],
    plan: 'premium',
    reviewStatus: 'approved',
    contentVersion: 0,
  },
  channels: [
    { channelId: '20000000-0000-4000-8000-000000000001', channelKey: 'vivir-fuengirola', categorySlug: 'servicios', enabled: true, publicSlug: 'academia-sol', editorialPlacement: false },
    { channelId: '20000000-0000-4000-8000-000000000002', channelKey: 'conoce-fuengirola', categorySlug: 'escuelas-de-idiomas', enabled: true, publicSlug: 'academia-sol', editorialPlacement: false },
  ],
}

test('Vivir and Conoce projections share canonical identity, version and premium rights', () => {
  const vivir = mapVivirPublication(snapshot, snapshot.channels[0], 3)
  const conoce = mapConocePublication(snapshot, snapshot.channels[1], 3)

  for (const projection of [vivir, conoce]) {
    assert.equal(projection.canonical_profile_id, snapshot.profile.id)
    assert.equal(projection.source_version, 3)
    assert.equal(projection.plan, 'premium')
    assert.equal(projection.is_recommended, true)
    assert.equal(projection.contact_actions_enabled, true)
    assert.equal(projection.miniweb_enabled, true)
    assert.equal(projection.seo_enabled, true)
    assert.equal(projection.editorial_placement, false)
    assert.match(projection.payload_hash, /^[0-9a-f]{64}$/)
  }
  assert.equal(conoce.slug, 'academia-sol')
  assert.equal(vivir.name, conoce.name)
  assert.equal(conoce.category_slug, 'escuelas-de-idiomas')
  assert.equal(conoce.summary, snapshot.profile.shortDescription)
  assert.equal(conoce.description, snapshot.profile.longDescription)
  assert.equal(conoce.location, snapshot.profile.address)
  assert.equal(conoce.neighborhood, 'centro')
  assert.equal(conoce.publication_status, 'published')
  assert.equal(conoce.channel_enabled, true)
  assert.equal(Object.hasOwn(vivir, 'owner_user_id'), false)
  assert.equal(Object.hasOwn(conoce, 'owner_user_id'), false)
  assert.equal(vivir.slug, 'academia-sol')
  assert.equal(vivir.status, 'publicado')
  assert.equal(vivir.channel_enabled, true)
  assert.equal(vivir.publication_status, 'published')
  assert.equal(vivir.published_at, snapshot.sourceUpdatedAt)
  assert.equal(vivir.category_slug, 'servicios')
  assert.deepEqual(vivir.neighborhood_slugs, ['centro'])
  assert.deepEqual(vivir.services, conoce.services)
})

test('projection hashes are deterministic and change with the source version', () => {
  const first = mapVivirPublication(snapshot, snapshot.channels[0], 1)
  const repeated = mapVivirPublication(structuredClone(snapshot), structuredClone(snapshot.channels[0]), 1)
  const next = mapVivirPublication(snapshot, snapshot.channels[0], 2)
  assert.equal(first.payload_hash, repeated.payload_hash)
  assert.notEqual(first.payload_hash, next.payload_hash)
})

test('Conoce adapter explicitly selects the conoce schema before upserting', async () => {
  const calls = []
  const query = {
    upsert(payload, options) { calls.push(['upsert', payload, options]); return this },
    select(columns) { calls.push(['select', columns]); return this },
    async single() { return { data: { canonical_profile_id: snapshot.profile.id }, error: null } },
  }
  const client = {
    schema(name) {
      calls.push(['schema', name])
      return { from(table) { calls.push(['from', table]); return query } }
    },
  }
  const adapter = createSupabaseChannelAdapter({
    channelKey: 'conoce-fuengirola',
    schema: 'conoce',
    table: 'businesses',
    client,
    map: mapConocePublication,
  })
  const result = await adapter.publish(snapshot, snapshot.channels[1], 1)
  assert.deepEqual(calls[0], ['schema', 'conoce'])
  assert.deepEqual(calls[1], ['from', 'businesses'])
  assert.equal(calls[2][2].onConflict, 'canonical_profile_id')
  assert.equal(result.remoteRecordId, snapshot.profile.id)
})

test('adapter errors expose a bounded code without leaking destination responses', async () => {
  const client = {
    schema() {
      return { from() { return {
        upsert() { return this }, select() { return this },
        async single() { return { data: null, error: { code: '23514', message: 'secret=service-role raw body'.repeat(100) } } },
      } } }
    },
  }
  const adapter = createSupabaseChannelAdapter({ channelKey: 'vivir-fuengirola', schema: 'public', table: 'businesses', client, map: mapVivirPublication })
  await assert.rejects(
    adapter.publish(snapshot, snapshot.channels[0], 1),
    error => error.code === 'destination_rejected' && error.message.length <= 240 && !/secret|service-role|raw body/i.test(error.message),
  )
})
