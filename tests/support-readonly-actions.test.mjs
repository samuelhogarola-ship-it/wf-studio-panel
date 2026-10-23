import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { client, clientId, database, form, loadProjectModule } from './helpers/project-harness.mjs'

const readonlyResult = {
  ok: false,
  error: 'support_readonly',
  message: 'No disponible en modo soporte.',
}

const protectedRoot = 'src/app/cliente/(protected)'
const clientRouteMatrix = [
  ['src/app/cliente/page.tsx', 'public-auth'],
  ['src/app/cliente/recuperar/page.tsx', 'public-auth'],
  ['src/app/cliente/registro/page.tsx', 'public-auth'],
  [`${protectedRoot}/actualizaciones/page.tsx`, 'read-only'],
  [`${protectedRoot}/bonos/page.tsx`, 'task4:sendRequestAction'],
  [`${protectedRoot}/dashboard/page.tsx`, 'read-only'],
  [`${protectedRoot}/facturas/page.tsx`, 'read-only'],
  [`${protectedRoot}/fotografias/page.tsx`, 'task4:uploadClientPhoto'],
  [`${protectedRoot}/historial/page.tsx`, 'read-only'],
  [`${protectedRoot}/informes/page.tsx`, 'read-only'],
  [`${protectedRoot}/mensajeria/page.tsx`, 'task4:sendMessageAction+markMessageReadAction+render-read_at'],
  [`${protectedRoot}/packs/page.tsx`, 'read-only'],
  [`${protectedRoot}/pendientes/page.tsx`, 'task4:sendMessageAction'],
  [`${protectedRoot}/proyectos/page.tsx`, 'read-only'],
  [`${protectedRoot}/proyectos/[slug]/page.tsx`, 'read-only'],
  [`${protectedRoot}/proyectos/[slug]/blogger/page.tsx`, 'task6:POST /api/tools/blogger/[siteKey]/launch'],
  [`${protectedRoot}/proyectos/[slug]/estadisticas/page.tsx`, 'read-only'],
  [`${protectedRoot}/servicios/page.tsx`, 'task4:sendRequestAction'],
]

const clientMutationMatrix = [
  { name: 'clientPasswordLoginAction', route: '/cliente', kind: 'public-auth-action', owner: 'auth', clientBundlePolicy: 'public-auth' },
  { name: 'clientMagicLinkAction', route: '/cliente', kind: 'public-auth-action', owner: 'auth', clientBundlePolicy: 'public-auth' },
  { name: 'clientRegisterAction', route: '/cliente/registro', kind: 'public-auth-action', owner: 'auth', clientBundlePolicy: 'public-auth' },
  { name: 'resetPasswordAction', route: '/cliente/recuperar', kind: 'public-auth-action', owner: 'auth', clientBundlePolicy: 'public-auth' },
  { name: 'sendMessageAction', route: '/cliente/mensajeria', kind: 'server-action', owner: 'task4', clientBundlePolicy: 'support-blocked' },
  { name: 'sendRequestAction', route: '/cliente/bonos + /cliente/servicios', kind: 'server-action', owner: 'task4', clientBundlePolicy: 'support-blocked' },
  { name: 'markMessageReadAction', route: '/cliente/mensajeria', kind: 'server-action', owner: 'task4', clientBundlePolicy: 'support-blocked' },
  { name: 'uploadClientPhoto', route: '/cliente/fotografias', kind: 'server-action', owner: 'task4', clientBundlePolicy: 'support-blocked' },
  { name: 'markClientInboundMessagesRead', route: '/cliente/mensajeria', kind: 'render-side-effect', owner: 'task4' },
  { name: 'publishResource', route: '/paneladmin/clientes/[id]/recursos', kind: 'server-action', owner: 'task4-defense', clientBundlePolicy: 'admin-not-bundled' },
  { name: 'endSupportPreviewAction', route: 'support banner + client shell', kind: 'support-session-action', owner: 'task3', clientBundlePolicy: 'support-lifecycle' },
  { name: 'POST /auth/sign-out', route: 'client shell', kind: 'route-handler', owner: 'task3' },
  { name: 'POST /api/tools/blogger/[siteKey]/launch', route: '/cliente/proyectos/[slug]/blogger', kind: 'route-handler', owner: 'task6' },
]

function walkPages(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const absolute = path.join(directory, entry.name)
    return entry.isDirectory() ? walkPages(absolute) : entry.name === 'page.tsx' ? [absolute] : []
  })
}

function importedServerActions(files) {
  return files.flatMap(file => {
    const source = readFileSync(file, 'utf8')
    return [...source.matchAll(/import\s*\{([^}]+)\}\s*from '@\/lib\/actions\/[^']+'/gs)]
      .flatMap(match => match[1].split(','))
      .map(value => value.trim())
      .filter(value => value && !value.startsWith('type '))
  })
}

test('every current /cliente page is classified as read-only or mapped to an explicit mutation boundary', () => {
  const actual = walkPages('src/app/cliente').map(value => value.split(path.sep).join('/')).sort()
  const expected = clientRouteMatrix.map(([file]) => file).sort()
  assert.deepEqual(actual, expected)
  assert.ok(clientRouteMatrix.every(([, classification]) => classification === 'read-only' || classification === 'public-auth' || classification.startsWith('task')))
  assert.deepEqual(clientMutationMatrix.filter(entry => entry.owner === 'task4').map(entry => entry.name).sort(), [
    'markClientInboundMessagesRead',
    'markMessageReadAction',
    'sendMessageAction',
    'sendRequestAction',
    'uploadClientPhoto',
  ])
})

test('the mutation matrix names every server action imported by the client-facing components', () => {
  const clientSurfaceActions = importedServerActions([
    'src/components/auth/client-login-form.tsx',
    'src/components/auth/client-register-form.tsx',
    'src/components/auth/reset-password-form.tsx',
    'src/components/client/message-composer.tsx',
    'src/components/client/request-form.tsx',
    'src/components/client/resource-form.tsx',
    'src/components/client/support-preview-banner.tsx',
    'src/components/layout/client-shell.tsx',
  ])
  const classified = new Set(clientMutationMatrix.map(entry => entry.name))
  assert.deepEqual([...new Set(clientSurfaceActions)].filter(name => !classified.has(name)), [])
  const policies = new Map(clientMutationMatrix.map(entry => [entry.name, entry.clientBundlePolicy]))
  const allowedPolicies = new Set(['public-auth', 'support-blocked', 'support-lifecycle'])
  assert.deepEqual([...new Set(clientSurfaceActions)].filter(name => !allowedPolicies.has(policies.get(name))), [])
  assert.equal(clientSurfaceActions.includes('publishResource'), false)
})

test('the mutation matrix names every POST route submitted by protected client UI', () => {
  const files = [
    ...walkPages('src/app/cliente/(protected)'),
    'src/components/layout/client-shell.tsx',
  ]
  const submittedRoutes = files.flatMap(file => {
    const source = readFileSync(file, 'utf8')
    return [...source.matchAll(/<form[^>]*action=(?:"([^"]+)"|\{`([^`]+)`\})[^>]*method="post"/g)]
      .map(match => match[1] ?? match[2])
      .map(value => value.replace('${encodeURIComponent(site.key)}', '[siteKey]'))
      .map(value => `POST ${value}`)
  })
  const classified = new Set(clientMutationMatrix.filter(entry => entry.kind === 'route-handler').map(entry => entry.name))
  assert.deepEqual([...new Set(submittedRoutes)].filter(name => !classified.has(name)), [])
})

function supportActionSetup() {
  const effects = { guard: 0, adminAuth: 0, parse: 0, db: 0, email: 0, upload: 0, build: 0, revalidate: 0 }
  class SupportReadOnlyError extends Error {
    constructor() {
      super(readonlyResult.message)
      this.name = 'SupportReadOnlyError'
      this.code = readonlyResult.error
      this.status = 403
    }
  }
  const error = new SupportReadOnlyError()
  const query = {
    update() { return query },
    eq() { return query },
    is() { return query },
    then(resolve) { return Promise.resolve({ data: null, error: null }).then(resolve) },
  }
  const db = {
    from() { return query },
    storage: { from() { return { upload() { effects.upload += 1; return Promise.resolve({ error: null }) } } } },
  }
  const guard = async () => {
    effects.guard += 1
    throw error
  }
  const mocks = {
    '@/lib/support/portal-viewer': {
      requireClientMutationAccess: guard,
      getOptionalSupportViewer: async () => {
        effects.guard += 1
        return { mode: 'support', supportSessionId: 'support-session', identity: { userId: 'admin-user' }, client }
      },
      SupportReadOnlyError,
      isSupportReadOnlyError: value => value instanceof SupportReadOnlyError,
    },
    '@/lib/auth': { requireClientAccess: guard, requireAdmin: async () => { effects.adminAuth += 1; throw new Error('admin guard must not run') } },
    '@/lib/supabase/server': { createSupabaseServerClient: async () => { effects.db += 1; return db } },
    '@/lib/supabase/admin': { getSupabaseAdminClient: () => { effects.db += 1; return db } },
    '@/lib/email': { sendAdminRequestEmail: async () => { effects.email += 1 } },
    'next/cache': { revalidatePath: () => { effects.revalidate += 1 } },
  }
  const poisonForm = { get() { effects.parse += 1; throw new Error('form parsed before mutation guard') } }
  return { effects, mocks, poisonForm }
}

for (const [modulePath, exportName, invoke] of [
  ['src/lib/actions/messages.ts', 'sendMessageAction', (action, setup) => action({}, setup.poisonForm)],
  ['src/lib/actions/messages.ts', 'sendRequestAction', (action, setup) => action({}, setup.poisonForm)],
  ['src/lib/actions/messages.ts', 'markMessageReadAction', action => action('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')],
  ['src/lib/actions/client-resources.ts', 'uploadClientPhoto', (action, setup) => action({}, setup.poisonForm)],
  ['src/lib/actions/resources.ts', 'publishResource', (action, setup) => action({}, setup.poisonForm)],
]) {
  test(`${exportName} rejects support before parsing or any side effect`, async () => {
    const setup = supportActionSetup()
    const action = loadProjectModule(modulePath, setup.mocks)[exportName]

    const result = await invoke(action, setup)

    assert.deepEqual(result, readonlyResult)
    assert.deepEqual(setup.effects, { guard: 1, adminAuth: 0, parse: 0, db: 0, email: 0, upload: 0, build: 0, revalidate: 0 })
  })
}

test('publishResource preserves ordinary admin publishing outside support mode', async () => {
  const db = database({ client_resources: [] })
  const revalidated = []
  let supportChecks = 0
  let adminChecks = 0
  const { publishResource } = loadProjectModule('src/lib/actions/resources.ts', {
    '@/lib/support/portal-viewer': {
      getOptionalSupportViewer: async () => { supportChecks += 1; return null },
      requireClientMutationAccess: async () => { throw new Error('client guard must not run') },
    },
    '@/lib/auth': {
      requireAdmin: async () => { adminChecks += 1; return { userId: 'admin-user', email: 'admin@example.com', role: 'admin' } },
    },
    '@/lib/supabase/admin': { getSupabaseAdminClient: () => db },
    'next/cache': { revalidatePath: value => { revalidated.push(value) } },
  })

  const result = await publishResource({}, form({
    clientId,
    title: 'Actualización de octubre',
    body: 'Trabajo completado.',
    kind: 'update',
    reportPath: '',
  }))

  assert.deepEqual(result, { success: 'Guardado en el panel del cliente.' })
  assert.equal(supportChecks, 1)
  assert.equal(adminChecks, 1)
  assert.equal(db.tables.client_resources.length, 1)
  assert.deepEqual(revalidated, [
    '/cliente/informes',
    '/cliente/actualizaciones',
    '/cliente/fotografias',
    `/paneladmin/clientes/${clientId}/recursos`,
  ])
})

test('real clients still send messages and service requests with their existing effects', async () => {
  const db = database({ messages: [] })
  const emails = []
  const revalidated = []
  const viewer = { mode: 'client', identity: { userId: 'client-user', email: client.email, role: 'client', client }, client }
  const actions = loadProjectModule('src/lib/actions/messages.ts', {
    '@/lib/support/portal-viewer': { requireClientMutationAccess: async () => viewer },
    '@/lib/auth': { requireClientAccess: async () => viewer.identity },
    '@/lib/email': { sendAdminRequestEmail: async payload => { emails.push(payload) } },
    '@/lib/supabase/server': { createSupabaseServerClient: async () => db },
    'next/cache': { revalidatePath: value => { revalidated.push(value) } },
  })

  const sent = await actions.sendMessageAction({}, form({ subject: 'Hola', body: 'Mensaje' }))
  const requested = await actions.sendRequestAction({}, form({ subject: 'Diseño web', body: 'Necesito ayuda', type: 'solicitud_servicio' }))

  assert.deepEqual(sent, { success: 'Mensaje enviado.' })
  assert.deepEqual(requested, { success: '¡Solicitud enviada! Te contactaremos pronto.' })
  assert.equal(db.tables.messages.length, 2)
  assert.equal(db.tables.messages.every(message => message.client_id === clientId), true)
  assert.equal(emails.length, 1)
  assert.deepEqual(revalidated, ['/cliente/mensajeria', '/cliente/servicios', '/cliente/bonos'])
})

function renderClientComponent(modulePath, exportName, props) {
  const module = loadProjectModule(modulePath, {
    react: { ...React, useActionState: () => [{}, () => {}, false], useState: initial => [initial, () => {}] },
    '@/lib/actions/messages': { sendMessageAction() {}, sendRequestAction() {} },
    '@/lib/actions/resources': { publishResource() {}, uploadClientPhoto() {} },
    '@/lib/actions/client-resources': { uploadClientPhoto() {} },
  })
  return renderToStaticMarkup(React.createElement(module[exportName], props))
}

test('support forms remain inspectable while message, request and upload controls are disabled with the exact explanation', () => {
  for (const [modulePath, exportName, props, mutationLabel] of [
    ['src/components/client/message-composer.tsx', 'MessageComposer', { readOnly: true }, 'Enviar mensaje'],
    ['src/components/client/request-form.tsx', 'RequestForm', { type: 'solicitud_servicio', readOnly: true }, 'Enviar solicitud'],
    ['src/components/client/resource-form.tsx', 'ResourceForm', { readOnly: true }, 'Guardar'],
  ]) {
    const html = renderClientComponent(modulePath, exportName, props)
    assert.match(html, /<form/)
    assert.match(html, new RegExp(`<button(?=[^>]*disabled="")[^>]*>${mutationLabel}<\/button>`))
    assert.match(html, /No disponible en modo soporte\./)
  }
  const upload = renderClientComponent('src/components/client/resource-form.tsx', 'ResourceForm', { readOnly: true })
  assert.match(upload, /<input(?=[^>]*type="file")(?=[^>]*disabled="")[^>]*>/)
})

test('ordinary client forms retain enabled mutation controls without the support explanation', () => {
  for (const [modulePath, exportName, props] of [
    ['src/components/client/message-composer.tsx', 'MessageComposer', {}],
    ['src/components/client/request-form.tsx', 'RequestForm', { type: 'solicitud_bono' }],
    ['src/components/client/resource-form.tsx', 'ResourceForm', {}],
  ]) {
    const html = renderClientComponent(modulePath, exportName, props)
    assert.doesNotMatch(html, /<button(?=[^>]*disabled="")[^>]*>/)
    assert.doesNotMatch(html, /No disponible en modo soporte\./)
  }
})

test('support pages pass readOnly to request and upload forms', async () => {
  const viewer = { mode: 'support', identity: { userId: 'admin-user', email: 'admin@example.com', role: 'admin' }, client }
  const cases = [
    {
      page: `${protectedRoot}/bonos/page.tsx`,
      props: { searchParams: Promise.resolve({ new: '1' }) },
      component: '@/components/client/request-form',
      exportName: 'RequestForm',
      dataModule: '@/lib/data/client',
      data: { getClientBonosData: async () => ({ packs: [], summaryMap: new Map() }) },
      viewerModule: '@/lib/projects/client-access',
      viewerExport: 'requireClientCapability',
    },
    {
      page: `${protectedRoot}/servicios/page.tsx`,
      props: { searchParams: Promise.resolve({ new: '1' }) },
      component: '@/components/client/request-form',
      exportName: 'RequestForm',
      dataModule: '@/lib/data/client',
      data: { getClientServicesData: async () => ({ packs: [] }) },
      viewerModule: '@/lib/support/portal-viewer',
      viewerExport: 'requirePortalViewer',
    },
    {
      page: `${protectedRoot}/fotografias/page.tsx`,
      props: {},
      component: '@/components/client/resource-form',
      exportName: 'ResourceForm',
      dataModule: '@/lib/resources/data',
      data: { listResources: async () => [] },
      viewerModule: '@/lib/projects/client-access',
      viewerExport: 'requireLegacyClientPortal',
      extra: { '@/components/client/resource-list': { ResourceList: () => React.createElement('div') } },
    },
  ]

  for (const entry of cases) {
    const seen = []
    const Page = loadProjectModule(entry.page, {
      [entry.viewerModule]: { [entry.viewerExport]: async () => viewer },
      [entry.dataModule]: entry.data,
      [entry.component]: { [entry.exportName]: props => { seen.push(props); return React.createElement('form') } },
      ...(entry.extra ?? {}),
    }).default
    renderToStaticMarkup(await Page(entry.props))
    assert.equal(seen[0]?.readOnly, true, entry.page)
  }
})

test('support pending items stay inspectable but the reply control is unavailable with the exact explanation', async () => {
  const Page = loadProjectModule(`${protectedRoot}/pendientes/page.tsx`, {
    '@/lib/support/portal-viewer': {
      requirePortalViewer: async () => ({ mode: 'support', identity: { userId: 'admin-user', email: 'admin@example.com', role: 'admin' }, client }),
    },
    '@/lib/data/client': {
      getClientPendingItems: async () => [{
        id: 'pending-id', title: 'Acceso', description: 'Enviar credenciales', status: 'pending',
        requested_at: '2026-10-23T10:00:00.000Z', received_at: null,
        reminder_interval_days: null, next_reminder_at: null, sort_order: 1,
      }],
    },
  }).default

  const html = renderToStaticMarkup(await Page())

  assert.match(html, /Acceso/)
  assert.doesNotMatch(html, /href="\/cliente\/mensajeria\?new=1&amp;pending=pending-id"/)
  assert.match(html, /No disponible en modo soporte\./)
})
