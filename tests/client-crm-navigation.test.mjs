import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { clientId, loadProjectModule } from './helpers/project-harness.mjs'

const client = {
  id: clientId,
  name: 'Ángel',
  company: 'Agama',
  email: 'angel@example.com',
  phone: '600000000',
  status: 'active',
  created_at: '2026-10-01',
}

test('client list view and edit actions both open the standalone client record', async () => {
  const Page = loadProjectModule('src/app/paneladmin/(protected)/clientes/page.tsx', {
    '@/lib/auth': { requireAdmin: async () => ({ email: 'admin@example.com' }) },
    '@/lib/data/admin': { getAdminClientsPageData: async () => ({
      clients: [client], editingClient: null, summaries: [], pendingClients: [],
      packsByClient: new Map(), clientsWithServices: new Set(),
    }) },
    '@/components/admin/client-form': { ClientForm: () => null },
    '@/lib/i18n': { t: (_locale, key) => key },
  }).default

  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }))
  const destination = `/paneladmin/clientes/${clientId}`

  assert.equal(html.match(new RegExp(`href="${destination}"`, 'g'))?.length, 3)
  assert.doesNotMatch(html, /clientes\?edit=/)
})

test('client record is editable and exposes direct CRM actions without the client list', async () => {
  const Page = loadProjectModule('src/app/paneladmin/(protected)/clientes/[id]/page.tsx', {
    '@/lib/auth': { requireAdmin: async () => ({ email: 'admin@example.com' }) },
    '@/lib/data/admin': { getAdminClientDetailPageData: async () => ({
      client,
      activePacks: [], packs: [], messages: [], pendingItems: [], recentActivities: [],
    }) },
    '@/lib/actions/admin': { deletePendingItemAction() {}, togglePendingItemStatusAction() {} },
    '@/components/admin/client-form': {
      ClientForm: ({ editingClient }) => React.createElement('div', { 'data-editing-client': editingClient?.id }),
    },
    '@/components/admin/client-message-form': { ClientMessageForm: () => null },
    '@/components/admin/pending-item-form': { PendingItemForm: () => null },
    '@/components/admin/support-preview-form': { SupportPreviewForm: () => null },
    '@/lib/i18n': {
      t: (_locale, key) => key,
      supportPreviewTranslations: { es: { featureDisabled: 'disabled', clientInactive: 'inactive' } },
    },
  }).default

  const html = renderToStaticMarkup(await Page({
    params: Promise.resolve({ id: clientId }),
    searchParams: Promise.resolve({}),
  }))

  assert.match(html, new RegExp(`data-editing-client="${clientId}"`))
  assert.match(html, new RegExp(`/paneladmin/facturas\\?new=1&amp;client=${clientId}`))
  assert.match(html, new RegExp(`/paneladmin/servicios\\?new=1&amp;client=${clientId}`))
  assert.match(html, new RegExp(`/paneladmin/clientes/${clientId}#mensajes`))
  assert.doesNotMatch(html, /Buscar cliente/)
})

test('client domain section filters by name and orders the next expiry first', async () => {
  const Page = loadProjectModule('src/app/paneladmin/(protected)/clientes/[id]/page.tsx', {
    '@/lib/auth': { requireAdmin: async () => ({ email: 'admin@example.com' }) },
    '@/lib/data/admin': { getAdminClientDetailPageData: async () => ({
      client,
      activePacks: [
        { id: 'late', client_id: clientId, name: 'late.example', pack_type: 'domain', minutes_total: 0, price: 20, purchase_date: '2026-01-01', renewal_date: '2028-01-01', billing_cycle: 'yearly', paid: true, status: 'active', notes: null, invoice_number: null },
        { id: 'soon', client_id: clientId, name: 'agama.com.mx', pack_type: 'domain', minutes_total: 0, price: 20, purchase_date: '2026-01-01', renewal_date: '2027-01-01', billing_cycle: 'yearly', paid: true, status: 'active', notes: null, invoice_number: null },
      ],
      packs: [], messages: [], pendingItems: [], recentActivities: [],
    }) },
    '@/lib/actions/admin': { deletePendingItemAction() {}, togglePendingItemStatusAction() {} },
    '@/components/admin/client-form': { ClientForm: () => null },
    '@/components/admin/client-message-form': { ClientMessageForm: () => null },
    '@/components/admin/pending-item-form': { PendingItemForm: () => null },
    '@/components/admin/support-preview-form': { SupportPreviewForm: () => null },
    '@/lib/i18n': {
      t: (_locale, key) => key,
      supportPreviewTranslations: { es: { featureDisabled: 'disabled', clientInactive: 'inactive' } },
    },
  }).default

  const html = renderToStaticMarkup(await Page({
    params: Promise.resolve({ id: clientId }),
    searchParams: Promise.resolve({ domain_q: 'agama' }),
  }))

  assert.match(html, /name="domain_q"/)
  assert.match(html, /agama\.com\.mx/)
  assert.doesNotMatch(html, /late\.example/)
})
