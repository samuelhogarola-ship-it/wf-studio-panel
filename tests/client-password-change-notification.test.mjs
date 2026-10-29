import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { clientId, database, form, loadProjectModule } from './helpers/project-harness.mjs'

function passwordActions(updateError = null) {
  const db = database({ clients: [{
    id: clientId, name: 'EPU', email: 'epu@example.com', status: 'active', project: 'wf-studio',
  }], client_access_events: [] })
  db.auth = {
    updateUser: async () => ({ error: updateError ? { message: updateError } : null }),
    getUser: async () => ({ data: { user: { id: 'auth-user-id', email: 'epu@example.com' } } }),
  }
  const actions = loadProjectModule('src/lib/actions/auth.ts', {
    '@/lib/supabase/server': { createSupabaseServerClient: async () => db },
    '@/lib/supabase/admin': { getSupabaseAdminClient: () => ({}) },
  })
  return { db, actions }
}

test('successful self-service password update records a credential-free panel event', async () => {
  const { db, actions } = passwordActions()
  await assert.rejects(
    actions.updatePasswordAction({}, form({ password: 'secure-pass', confirm: 'secure-pass' })),
    /redirect:\/cliente\/dashboard/,
  )
  assert.deepEqual(db.tables.client_access_events[0], {
    id: '11111111-1111-4111-8111-111111111111',
    client_id: clientId,
    auth_user_id: 'auth-user-id',
    event_type: 'password_changed_by_client',
  })
  assert.equal(JSON.stringify(db.tables.client_access_events).includes('secure-pass'), false)
})

test('failed password update writes no security event', async () => {
  const { db, actions } = passwordActions('expired')
  const result = await actions.updatePasswordAction({}, form({ password: 'secure-pass', confirm: 'secure-pass' }))
  assert.match(result.error, /no se pudo actualizar/i)
  assert.equal(db.tables.client_access_events.length, 0)
})

test('panel notice names the event, client and date without credential fields', () => {
  const { ClientAccessNotifications } = loadProjectModule('src/components/admin/client-access-notifications.tsx')
  const html = renderToStaticMarkup(React.createElement(ClientAccessNotifications, { events: [{
    clientId, clientName: 'EPU', eventType: 'password_changed_by_client', createdAt: '2026-10-29T09:30:00Z',
  }] }))
  assert.match(html, /Contraseña cambiada por el cliente/)
  assert.match(html, /EPU/)
  assert.match(html, new RegExp(`/paneladmin/clientes/${clientId}\\?view=access`))
  assert.doesNotMatch(html, /generatedPassword|password=/)
})
