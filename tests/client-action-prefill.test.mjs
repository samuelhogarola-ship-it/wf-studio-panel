import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { clientId, otherClientId, loadProjectModule } from './helpers/project-harness.mjs'

const clients = [
  { id: clientId, name: 'Ángel', company: 'Agama', email: 'angel@example.com', status: 'active' },
  { id: otherClientId, name: 'Bea', company: null, email: 'bea@example.com', status: 'active' },
]

test('invoice form preselects the client from the CRM action', () => {
  const InvoiceForm = loadProjectModule('src/components/admin/invoice-form.tsx', {
    '@/lib/actions/invoices': { createInvoiceAction: async () => ({}) },
    '@/lib/i18n': { t: (_locale, key) => key },
  }).InvoiceForm

  const html = renderToStaticMarkup(React.createElement(InvoiceForm, {
    clients,
    locale: 'es',
    defaultClientId: clientId,
  }))

  assert.match(html, new RegExp(`<option value="${clientId}" selected="">`))
})

test('service form preselects the client from the CRM action', () => {
  const ServiceForm = loadProjectModule('src/components/admin/service-form.tsx', {
    '@/lib/actions/admin': { upsertServiceAction: async () => ({}) },
  }).ServiceForm

  const html = renderToStaticMarkup(React.createElement(ServiceForm, {
    clients,
    editingService: null,
    defaultClientId: clientId,
  }))

  assert.match(html, new RegExp(`<option value="${clientId}" selected="">`))
})

test('editing a service keeps its owner instead of the CRM shortcut client', () => {
  const ServiceForm = loadProjectModule('src/components/admin/service-form.tsx', {
    '@/lib/actions/admin': { upsertServiceAction: async () => ({}) },
  }).ServiceForm

  const html = renderToStaticMarkup(React.createElement(ServiceForm, {
    clients,
    defaultClientId: clientId,
    editingService: {
      id: 'service-1', client_id: otherClientId, pack_id: null, name: 'SEO', service_type: 'seo',
      price: 100, service_date: '2026-10-28', status: 'active', notes: null,
    },
  }))

  assert.match(html, new RegExp(`<option value="${otherClientId}" selected="">`))
  assert.doesNotMatch(html, new RegExp(`<option value="${clientId}" selected="">`))
})
