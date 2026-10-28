import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { clientId, otherClientId, loadProjectModule } from './helpers/project-harness.mjs'

const clients = [
  { id: clientId, name: 'Ana', email: 'ana@example.com', status: 'active' },
  { id: otherClientId, name: 'Bea', email: 'bea@example.com', status: 'active' },
]

function loadPackForm() {
  return loadProjectModule('src/components/admin/pack-form.tsx', {
    '@/lib/actions/admin': { upsertPackAction: async () => ({}) },
    '@/lib/i18n': { t: (_locale, key) => key },
  }).PackForm
}

test('new domain form preselects the client from the shortcut', () => {
  const PackForm = loadPackForm()
  const html = renderToStaticMarkup(React.createElement(PackForm, {
    clients,
    editingPack: null,
    locale: 'es',
    defaultPackType: 'domain',
    defaultClientId: clientId,
  }))

  assert.match(html, new RegExp(`<option value="${clientId}" selected="">`))
})

test('editing a domain keeps its owner instead of the shortcut client', () => {
  const PackForm = loadPackForm()
  const html = renderToStaticMarkup(React.createElement(PackForm, {
    clients,
    locale: 'es',
    defaultPackType: 'domain',
    defaultClientId: clientId,
    editingPack: {
      id: 'pack-1', client_id: otherClientId, name: 'example.com', pack_type: 'domain', billing_cycle: 'one_time',
      paid: false, minutes_total: 0, price: 20, invoice_number: null, purchase_date: '2026-10-28',
      renewal_date: '2027-10-28', status: 'active', notes: null,
    },
  }))

  assert.match(html, new RegExp(`<option value="${otherClientId}" selected="">`))
  assert.doesNotMatch(html, new RegExp(`<option value="${clientId}" selected="">`))
})

test('client detail exposes a direct new-domain action for that client', async () => {
  const Page = loadProjectModule('src/app/paneladmin/(protected)/clientes/[id]/page.tsx', {
    '@/lib/auth': { requireAdmin: async () => ({ email: 'admin@example.com' }) },
    '@/lib/data/admin': { getAdminClientDetailPageData: async () => ({
      client: { id: clientId, name: 'Ana', email: 'ana@example.com', company: null, phone: null, status: 'active', created_at: '2026-10-01' },
      activePacks: [], packs: [], messages: [], pendingItems: [], recentActivities: [],
    }) },
    '@/lib/actions/admin': { deletePendingItemAction() {}, togglePendingItemStatusAction() {} },
    '@/components/admin/client-message-form': { ClientMessageForm: () => null },
    '@/components/admin/pending-item-form': { PendingItemForm: () => null },
    '@/components/admin/support-preview-form': { SupportPreviewForm: () => null },
    '@/lib/i18n': {
      t: (_locale, key) => key,
      supportPreviewTranslations: { es: { featureDisabled: 'disabled', clientInactive: 'inactive' } },
    },
    '@/lib/locale': { getLocale: async () => 'es' },
  }).default

  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: clientId }) }))

  assert.match(html, new RegExp(`/paneladmin/bonos\\?new=1&amp;tab=dominios&amp;client=${clientId}`))
  assert.match(html, /Añadir dominio/)
})
