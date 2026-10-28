import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { clientId, loadProjectModule } from './helpers/project-harness.mjs'

test('admin sidebar exposes CRM messages and the Bill-in group', () => {
  const { AdminShell } = loadProjectModule('src/components/layout/app-shell.tsx', {
    '@/lib/i18n': { t: (_locale, key) => key },
  })
  const html = renderToStaticMarkup(React.createElement(AdminShell, {
    title: 'Test', description: 'Test', currentPath: '/paneladmin/mensajes',
    userEmail: 'admin@example.com', locale: 'es', children: React.createElement('div'),
  }))

  assert.match(html, />CRM</)
  assert.match(html, /href="\/paneladmin\/mensajes"/)
  assert.match(html, />Bill-in</)
  assert.match(html, /href="\/paneladmin\/gastos"/)
})

test('global messages page filters a client and allows sending from the same screen', async () => {
  const Page = loadProjectModule('src/app/paneladmin/(protected)/mensajes/page.tsx', {
    '@/lib/auth': { requireAdmin: async () => ({ email: 'admin@example.com' }) },
    '@/lib/data/admin': { getAdminMessagesPageData: async () => ({
      clients: [{ id: clientId, name: 'Ángel', email: 'angel@example.com', status: 'active' }],
      messages: [{ id: 'message-1', client_id: clientId, subject: 'Dominio', body: 'Caduca pronto', direction: 'outbound', type: 'message', read_at: null, created_at: '2026-10-28', clients: { name: 'Ángel' } }],
    }) },
    '@/components/admin/client-message-form': {
      ClientMessageForm: ({ clientId: selected }) => React.createElement('div', { 'data-message-client': selected }),
    },
  }).default

  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ client: clientId }) }))

  assert.match(html, new RegExp(`data-message-client="${clientId}"`))
  assert.match(html, /Dominio/)
  assert.match(html, /Caduca pronto/)
  assert.match(html, new RegExp(`/paneladmin/clientes/${clientId}#mensajes`))
})
