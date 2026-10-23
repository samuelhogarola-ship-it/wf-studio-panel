import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import {
  loadProjectModule,
  database,
  client,
  clientId,
  project,
  projectId,
  form,
} from './helpers/project-harness.mjs'

const render = element => renderToStaticMarkup(element)
const admin = { userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'admin@example.com', role: 'admin' }
const token = Buffer.alloc(32, 9).toString('base64url')
const sessionId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const expiresAt = '2099-10-23T10:30:00.000Z'
const clientReturnPath = `/paneladmin/clientes/${clientId}`
const projectReturnPath = `/paneladmin/proyectos/${projectId}`

function withFlag(enabled, callback) {
  const previous = process.env.WF_SUPPORT_PREVIEW_ENABLED
  if (enabled) process.env.WF_SUPPORT_PREVIEW_ENABLED = 'true'
  else delete process.env.WF_SUPPORT_PREVIEW_ENABLED
  return Promise.resolve().then(callback).finally(() => {
    if (previous === undefined) delete process.env.WF_SUPPORT_PREVIEW_ENABLED
    else process.env.WF_SUPPORT_PREVIEW_ENABLED = previous
  })
}

function actionSetup({ identity = admin, clients = [client], projects = [project], supportViewer = null } = {}) {
  const cookieWrites = []
  const db = database({ clients, client_projects: projects, admin_support_sessions: [] }, {}, { rpcs: {
    start_admin_support_session({ args, tables }) {
      const row = {
        id: sessionId,
        admin_user_id: identity.userId,
        client_id: args.p_client_id,
        token_hash: args.p_token_hash,
        return_path: args.p_return_path,
        started_at: '2099-10-23T10:00:00.000Z',
        expires_at: expiresAt,
        ended_at: null,
        end_reason: null,
      }
      tables.admin_support_sessions.push(row)
      return { data: [row], error: null }
    },
    end_admin_support_session({ args, tables }) {
      const row = tables.admin_support_sessions.find(candidate => candidate.token_hash === args.p_token_hash && candidate.ended_at === null)
      if (!row) return { data: false, error: null }
      row.ended_at = '2099-10-23T10:05:00.000Z'
      row.end_reason = args.p_reason
      return { data: true, error: null }
    },
  } })
  const cookieStore = {
    get: name => name === '__Host-wf_support_preview' ? { value: token } : undefined,
    set: value => cookieWrites.push(value),
  }
  const load = relative => loadProjectModule(relative, {
    '@/lib/auth': {
      requireAdmin: async () => {
        if (identity.role !== 'admin') throw new Error('redirect:/paneladmin')
        return identity
      },
    },
    '@/lib/support/portal-viewer': {
      getOptionalSupportViewer: async () => supportViewer,
      normalizeSupportReturnPath: value => {
        if (typeof value !== 'string' || !/^\/paneladmin\/(?:clientes|proyectos)\/[0-9a-f-]+$/.test(value)) return '/paneladmin/inicio'
        return value
      },
    },
    '@/lib/supabase/server': { createSupabaseServerClient: async () => db },
    'next/headers': { cookies: async () => cookieStore },
    'next/navigation': { redirect(url) { throw new Error(`redirect:${url}`) } },
  })
  return { db, cookieWrites, load }
}

test('only an administrator can start support preview and the disabled server flag fails before lookup', async () => {
  await withFlag(true, async () => {
    const denied = actionSetup({ identity: { userId: 'client-user', email: client.email, role: 'client' } })
    await assert.rejects(
      () => denied.load('src/lib/actions/support-preview.ts').startSupportPreviewAction(form({ client_id: clientId, return_path: clientReturnPath })),
      { message: 'redirect:/paneladmin' },
    )
    assert.equal(denied.db.calls.length, 0)
  })

  await withFlag(false, async () => {
    const denied = actionSetup({ identity: { userId: 'client-user', email: client.email, role: 'client' } })
    await assert.rejects(
      () => denied.load('src/lib/actions/support-preview.ts').startSupportPreviewAction(form({ client_id: clientId, return_path: clientReturnPath })),
      { message: 'redirect:/paneladmin' },
    )
    assert.equal(denied.db.calls.length, 0)

    const disabled = actionSetup()
    await assert.rejects(
      () => disabled.load('src/lib/actions/support-preview.ts').startSupportPreviewAction(form({ client_id: clientId, return_path: clientReturnPath })),
      /desactivada|disabled/i,
    )
    assert.equal(disabled.db.calls.length, 0)
  })
})

test('start treats submitted client and project ids as lookup keys and persists only a valid active target', async () => withFlag(true, async () => {
  for (const clients of [[], [{ ...client, status: 'inactive' }]]) {
    const invalid = actionSetup({ clients })
    await assert.rejects(
      () => invalid.load('src/lib/actions/support-preview.ts').startSupportPreviewAction(form({ client_id: clientId, return_path: clientReturnPath })),
      /cliente activo|active client/i,
    )
    assert.equal(invalid.db.calls.some(call => call.table === 'rpc:start_admin_support_session'), false)
  }

  const active = actionSetup()
  await assert.rejects(
    () => active.load('src/lib/actions/support-preview.ts').startSupportPreviewAction(form({ client_id: clientId, return_path: clientReturnPath })),
    { message: 'redirect:/cliente/dashboard' },
  )
  const start = active.db.calls.find(call => call.table === 'rpc:start_admin_support_session')
  assert.equal(start.args.p_client_id, clientId)
  assert.equal(start.args.p_return_path, clientReturnPath)
  assert.match(start.args.p_token_hash, /^[0-9a-f]{64}$/)
  assert.deepEqual(active.cookieWrites, [{
    name: '__Host-wf_support_preview', value: active.cookieWrites[0].value,
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 1800,
  }])

  const projectStart = actionSetup()
  await assert.rejects(
    () => projectStart.load('src/lib/actions/support-preview.ts').startSupportPreviewAction(form({
      client_id: '33333333-3333-4333-8333-333333333333',
      project_id: projectId,
      return_path: projectReturnPath,
    })),
    { message: 'redirect:/cliente/dashboard' },
  )
  assert.equal(projectStart.db.calls.find(call => call.table === 'rpc:start_admin_support_session').args.p_client_id, project.client_id)
}))

test('project start rejects unassigned, inactive or inaccessible projects before session creation', async () => withFlag(true, async () => {
  const cases = [
    { ...project, client_id: null },
    { ...project, status: 'draft' },
    { ...project, client_access_enabled: false },
  ]
  for (const candidate of cases) {
    const setup = actionSetup({ projects: [candidate] })
    await assert.rejects(
      () => setup.load('src/lib/actions/support-preview.ts').startSupportPreviewAction(form({ project_id: projectId, return_path: projectReturnPath })),
      /proyecto activo y accesible|active accessible project/i,
    )
    assert.equal(setup.db.calls.some(call => call.table === 'rpc:start_admin_support_session'), false)
  }
}))

test('start rejects any submitted return path that is not the exact server-derived admin record', async () => withFlag(true, async () => {
  for (const return_path of [
    '//evil.test/paneladmin/clientes/' + clientId,
    '/paneladmin/inicio',
    `/paneladmin/clientes/${clientId}?next=/cliente`,
    `/paneladmin/proyectos/${projectId}`,
  ]) {
    const setup = actionSetup()
    await assert.rejects(
      () => setup.load('src/lib/actions/support-preview.ts').startSupportPreviewAction(form({ client_id: clientId, return_path })),
      /ruta de retorno|return path/i,
    )
    assert.equal(setup.db.calls.some(call => call.table === 'rpc:start_admin_support_session'), false)
  }
}))

test('exit ends the exact owner-bound cookie session, clears it and returns to the saved path', async () => withFlag(true, async () => {
  const tokenHash = createHash('sha256').update(token).digest('hex')
  const supportViewer = {
    mode: 'support', identity: admin, client, supportSessionId: sessionId,
    expiresAt, returnPath: projectReturnPath,
  }
  const setup = actionSetup({ supportViewer })
  setup.db.tables.admin_support_sessions.push({
    id: sessionId, admin_user_id: admin.userId, client_id: clientId, token_hash: tokenHash,
    return_path: projectReturnPath, started_at: '2099-10-23T10:00:00.000Z', expires_at: expiresAt,
    ended_at: null, end_reason: null,
  })

  await assert.rejects(
    () => setup.load('src/lib/actions/support-preview.ts').endSupportPreviewAction(),
    { message: `redirect:${projectReturnPath}` },
  )

  const end = setup.db.calls.find(call => call.table === 'rpc:end_admin_support_session')
  assert.deepEqual(end.args, { p_token_hash: tokenHash, p_reason: 'manual' })
  assert.equal(setup.db.tables.admin_support_sessions[0].end_reason, 'manual')
  assert.deepEqual(setup.cookieWrites, [{ name: '__Host-wf_support_preview', value: '', httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 }])
}))

test('the client sign-out endpoint exits support without signing out the real administrator', async () => {
  const ended = []
  const cookieWrites = []
  let signOuts = 0
  const supportViewer = { mode: 'support', identity: admin, client, supportSessionId: sessionId, expiresAt, returnPath: projectReturnPath }
  const route = loadProjectModule('src/app/auth/sign-out/route.ts', {
    '@/lib/support/portal-viewer': { getOptionalSupportViewer: async () => supportViewer },
    '@/lib/support/support-session': {
      SUPPORT_COOKIE_NAME: '__Host-wf_support_preview',
      clearSupportCookie: () => ({ name: '__Host-wf_support_preview', value: '', httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 }),
      endSupportSession: async (_db, input, reason) => { ended.push({ input, reason }); return true },
    },
    '@/lib/supabase/server': {
      createSupabaseServerClient: async () => ({}),
      createSupabaseRouteClient: () => ({ auth: { signOut: async () => { signOuts += 1 } } }),
    },
    'next/headers': { cookies: async () => ({ get: () => ({ value: token }) }) },
    'next/server': { NextResponse: { redirect(url) { return { location: url.toString(), cookies: { set(value) { cookieWrites.push(value) } } } } } },
  })
  const request = {
    url: 'https://studio.example.test/auth/sign-out',
    headers: new Headers(),
    formData: async () => form({ redirect: 'client' }),
  }

  const response = await route.POST(request)

  assert.equal(response.location, `https://studio.example.test${projectReturnPath}`)
  assert.equal(signOuts, 0)
  assert.deepEqual(ended, [{ input: { adminUserId: admin.userId, token }, reason: 'manual' }])
  assert.equal(cookieWrites[0].name, '__Host-wf_support_preview')
  assert.equal(cookieWrites[0].maxAge, 0)
})

test('ordinary client and administrator sign-out remain unchanged outside support preview', async () => {
  for (const [redirect, destination] of [['client', '/cliente'], ['admin', '/paneladmin']]) {
    let signOuts = 0
    const route = loadProjectModule('src/app/auth/sign-out/route.ts', {
      '@/lib/support/portal-viewer': { getOptionalSupportViewer: async () => null },
      '@/lib/supabase/server': {
        createSupabaseRouteClient: () => ({ auth: { signOut: async () => { signOuts += 1 } } }),
      },
      'next/server': { NextResponse: { redirect(url) { return { location: url.toString(), cookies: { set() {} } } } } },
    })
    const response = await route.POST({
      url: 'https://studio.example.test/auth/sign-out', headers: new Headers(),
      formData: async () => form({ redirect }),
    })
    assert.equal(response.location, `https://studio.example.test${destination}`)
    assert.equal(signOuts, 1)
  }
})

test('entry form names the client and explains why an unavailable target cannot start', () => {
  const { SupportPreviewForm } = loadProjectModule('src/components/admin/support-preview-form.tsx', {
    '@/lib/actions/support-preview': { startSupportPreviewAction() {} },
  })
  const available = render(React.createElement(SupportPreviewForm, {
    clientId, clientName: 'Ana', returnPath: clientReturnPath, locale: 'es',
  }))
  assert.match(available, /Ver como Ana/)
  assert.match(available, new RegExp(`name="client_id" value="${clientId}"`))
  assert.match(available, new RegExp(`name="return_path" value="${clientReturnPath.replaceAll('/', '\\/')}"`))

  const unavailable = render(React.createElement(SupportPreviewForm, {
    clientName: 'Sin cliente', returnPath: projectReturnPath, locale: 'es',
    disabledReason: 'Asigna un cliente activo al proyecto.',
  }))
  assert.match(unavailable, /<button[^>]*disabled/)
  assert.match(unavailable, /Asigna un cliente activo al proyecto\./)
})

test('responsive banner exposes client, countdown metadata, read-only explanation and return action', () => {
  const { SupportPreviewBanner } = loadProjectModule('src/components/client/support-preview-banner.tsx', {
    react: { ...React, useEffect() {}, useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}] },
    '@/lib/actions/support-preview': { endSupportPreviewAction() {} },
  })
  const html = render(React.createElement(SupportPreviewBanner, {
    clientName: 'Ana', expiresAt, locale: 'es',
  }))
  assert.match(html, /data-support-preview-banner="responsive"/)
  assert.match(html, /Modo soporte/)
  assert.match(html, /Viendo como Ana/)
  assert.match(html, /Solo lectura/)
  assert.match(html, /No se guardará ningún cambio\./)
  assert.match(html, new RegExp(`data-support-expires-at="${expiresAt.replaceAll('.', '\\.')}`))
  assert.match(html, /data-support-countdown=/)
  assert.match(html, /Volver al panel administrador/)
})

test('support shell replaces both desktop and mobile real sign-out controls while ordinary client markup is unchanged', () => {
  const { ClientShell } = loadProjectModule('src/components/layout/client-shell.tsx', {
    'next/navigation': { usePathname: () => '/cliente/dashboard' },
    '@/components/layout/locale-toggle': { LocaleToggle: () => React.createElement('span', null, 'locale') },
    '@/lib/actions/support-preview': { endSupportPreviewAction() {} },
    react: { ...React, useEffect() {}, useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}] },
  })
  const base = { clientName: 'Ana', clientEmail: client.email, navigation: [], locale: 'es', children: React.createElement('p', null, 'content') }
  const ordinary = render(React.createElement(ClientShell, base))
  assert.equal((ordinary.match(/action="\/auth\/sign-out"/g) ?? []).length, 2)
  assert.doesNotMatch(ordinary, /Modo soporte|Salir del modo soporte/)

  const support = render(React.createElement(ClientShell, {
    ...base,
    supportPreview: { expiresAt, returnPath: projectReturnPath },
  }))
  assert.doesNotMatch(support, /action="\/auth\/sign-out"/)
  assert.equal((support.match(/Salir del modo soporte/g) ?? []).length, 2)
  assert.match(support, /hidden lg:flex/)
  assert.match(support, /lg:hidden/)
  assert.match(support, /Modo soporte/)
})

test('client layout passes only server-resolved support fields into the shell', async () => {
  let received
  const Layout = loadProjectModule('src/app/cliente/(protected)/layout.tsx', {
    '@/lib/data/projects': { getClientPortalContext: async () => ({
      client, mode: 'legacy', projects: [], navigation: [], viewerMode: 'support',
      supportSessionId: sessionId, supportExpiresAt: expiresAt, returnPath: projectReturnPath,
    }) },
    '@/lib/projects/portal-navigation.mjs': { buildPortalNavigation: () => [] },
    '@/components/layout/client-shell': { ClientShell: props => { received = props; return React.createElement('main', null, props.children) } },
  }).default

  render(await Layout({ children: React.createElement('p', null, 'content') }))

  assert.equal(received.clientName, client.name)
  assert.deepEqual(received.supportPreview, { expiresAt, returnPath: projectReturnPath })
  assert.equal('supportSessionId' in received.supportPreview, false)
})

test('active admin client detail renders its support entry and inactive detail explains the disabled state', async () => withFlag(true, async () => {
  for (const [status, pattern] of [['active', /Ver como Ana/], ['inactive', /El cliente debe estar activo para iniciar la vista de soporte\./]]) {
    const candidate = { ...client, status, company: null, phone: null, created_at: '2026-10-01T00:00:00Z' }
    const db = database({ clients: [candidate], packs: [], activities: [], pending_items: [], messages: [] })
    const Page = loadProjectModule('src/app/paneladmin/(protected)/clientes/[id]/page.tsx', {
      '@/lib/auth': { requireAdmin: async () => admin },
      '@/lib/supabase/server': { createSupabaseServerClient: async () => db },
      'next/headers': { cookies: async () => ({ get() {}, set() {} }) },
    }).default
    const html = render(await Page({ params: Promise.resolve({ id: clientId }) }))
    assert.match(html, pattern)
  }
}))
