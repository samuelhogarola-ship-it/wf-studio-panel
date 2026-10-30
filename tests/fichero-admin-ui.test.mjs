import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { loadProjectModule } from './helpers/project-harness.mjs'

const profile = {
  id: '10000000-0000-4000-8000-000000000001', catalogId: '10000000-0000-4000-8000-000000000002',
  canonicalSlug: 'academia-sol', legalName: 'Academia Sol SL', displayName: 'Academia Sol', cif: 'B12345678',
  contactEmail: 'hola@academiasol.test', phone: '+34952000000', whatsapp: null, website: 'https://academiasol.test/',
  address: 'Calle Sol 1', latitude: 36.54, longitude: -4.62, categoryKey: 'educacion', categoryLabel: 'Educación',
  neighborhoodKeys: ['centro'], shortDescription: 'Academia local', longDescription: 'Formación local.', seoTitle: 'Academia Sol',
  seoDescription: 'Formación en Fuengirola', services: ['Idiomas'], schedule: ['L-V 09:00-18:00'], photos: [], plan: 'premium',
  reviewStatus: 'pending_review', contentVersion: 2, ownerUserId: null,
}
const channels = [
  { channelId: '20000000-0000-4000-8000-000000000001', channelKey: 'vivir-fuengirola', enabled: true, publicSlug: 'academia-sol', editorialPlacement: true, lastPublishedVersion: 2, lastPublicationStatus: 'published', lastPublicationError: null },
  { channelId: '20000000-0000-4000-8000-000000000002', channelKey: 'conoce-fuengirola', enabled: true, publicSlug: 'academia-sol', editorialPlacement: true, lastPublishedVersion: null, lastPublicationStatus: 'failed', lastPublicationError: 'Destino no disponible' },
]
const actionMocks = {
  '@/lib/actions/fichero': {
    saveDirectoryProfileAction: async () => ({ success: 'ok' }),
    reviewDirectoryProfileAction: async () => ({ success: 'ok' }),
    retryDirectoryProfileChannelAction: async () => ({ success: 'ok' }),
  },
}

test('Fichero is a first-level shell destination and catalog navigation is independent', () => {
  const { AdminShell } = loadProjectModule('src/components/layout/app-shell.tsx')
  const shell = renderToStaticMarkup(React.createElement(AdminShell, {
    title: 'Fichero', description: 'Directorios', currentPath: '/paneladmin/fichero', userEmail: 'admin@example.com', locale: 'es', children: null,
  }))
  assert.match(shell, /href="\/paneladmin\/fichero"[^>]*aria-current="page"/)
  assert.match(shell, />Fichero</)

  const { FicheroNav } = loadProjectModule('src/components/fichero/fichero-nav.tsx')
  const nav = renderToStaticMarkup(React.createElement(FicheroNav, { catalogKey: 'fuengirola', currentPath: '/paneladmin/fichero/fuengirola/fichas' }))
  for (const label of ['Resumen', 'Solicitudes', 'Fichas', 'Publicaciones']) assert.match(nav, new RegExp(label))
  assert.match(nav, /aria-current="page"[^>]*>Fichas/)
})

test('profile editor exposes canonical fields, both channels and a rights preview', () => {
  const { ProfileEditor } = loadProjectModule('src/components/fichero/profile-editor.tsx', actionMocks)
  const html = renderToStaticMarkup(React.createElement(ProfileEditor, { catalogKey: 'fuengirola', profile, channels, duplicates: [] }))
  for (const field of ['displayName', 'legalName', 'cif', 'contactEmail', 'canonicalSlug', 'plan', 'ownerUserId', 'seoTitle', 'seoDescription']) {
    assert.match(html, new RegExp(`name="${field}"`))
  }
  assert.match(html, /name="channel_vivir-fuengirola_enabled"/)
  assert.match(html, /name="channel_conoce-fuengirola_enabled"/)
  assert.match(html, /name="channel_vivir-fuengirola_slug"/)
  assert.match(html, /name="channel_conoce-fuengirola_slug"/)
  assert.match(html, /Vista previa de derechos/)
  assert.match(html, /Miniweb SEO/)
  assert.match(html, /Estadísticas avanzadas/)
  assert.match(html, />Guardar borrador</)
})

test('review keeps save, approve and publish separate and requires explicit rejection/publish confirmation', () => {
  const { ReviewPanel } = loadProjectModule('src/components/fichero/review-panel.tsx', actionMocks)
  const html = renderToStaticMarkup(React.createElement(ReviewPanel, { profileId: profile.id, channels }))
  assert.match(html, /name="decision" value="approve"/)
  assert.match(html, />Aprobar</)
  assert.match(html, /name="decision" value="approve_publish"/)
  assert.match(html, />Aprobar y publicar</)
  assert.match(html, /(?:name="confirm_publish"[^>]*required|required[^>]*name="confirm_publish")/)
  assert.match(html, /Vivir en Fuengirola/)
  assert.match(html, /Conoce Fuengirola/)
  assert.match(html, /name="decision" value="reject"/)
  assert.match(html, /(?:name="note"[^>]*required|required[^>]*name="note")/)
})

test('publication feedback is per channel and retry remains scoped to the failed version', () => {
  const { PublicationStatus } = loadProjectModule('src/components/fichero/publication-status.tsx', actionMocks)
  const events = [
    { eventId: '30000000-0000-4000-8000-000000000001', channelKey: 'vivir-fuengirola', sourceVersion: 2, status: 'published', remoteRecordId: 'remote-1', errorMessage: null },
    { eventId: '30000000-0000-4000-8000-000000000002', channelKey: 'conoce-fuengirola', sourceVersion: 2, status: 'failed', remoteRecordId: null, errorMessage: 'Destino no disponible' },
  ]
  const html = renderToStaticMarkup(React.createElement(PublicationStatus, { profileId: profile.id, events }))
  assert.match(html, /Vivir en Fuengirola/)
  assert.match(html, /Publicado/)
  assert.match(html, /Conoce Fuengirola/)
  assert.match(html, /Falló/)
  assert.match(html, /Destino no disponible/)
  assert.match(html, /name="channel_key" value="conoce-fuengirola"/)
  assert.match(html, /name="source_version" value="2"/)
  assert.match(html, />Reintentar solo este canal</)
})
