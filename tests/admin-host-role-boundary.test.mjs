import test from 'node:test'
import assert from 'node:assert/strict'

import { form, loadProjectModule } from './helpers/project-harness.mjs'

function request(path = '/api/posts') {
  const cookies = new Map([['sb-session', 'client-token']])
  return {
    headers: new Headers({ host: 'admin.webfuengirola.com' }),
    nextUrl: new URL(`https://admin.webfuengirola.com${path}`),
    cookies: {
      getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
      set: (name, value) => cookies.set(name, value),
    },
  }
}

function loadSessionMiddleware(role) {
  let signedOut = 0
  const module = loadProjectModule('src/lib/supabase/middleware.ts', {
    '@/lib/env': { getPublicEnv: () => ({ supabaseUrl: 'https://supabase.example', supabaseKey: 'public-key' }) },
    '@/lib/security/redirects.mjs': { getProtectedArea: () => null },
    '@supabase/ssr': {
      createServerClient(_url, _key, options) {
        return {
          auth: {
            async getUser() { return { data: { user: { id: 'user-client', email: 'client@example.test' } } } },
            async signOut() {
              signedOut += 1
              options.cookies.setAll([{ name: 'sb-session', value: '', options: { path: '/', maxAge: 0 } }])
              return { error: null }
            },
          },
          from(table) {
            assert.equal(table, 'profiles')
            return {
              select() { return this },
              eq() { return this },
              async maybeSingle() { return { data: role ? { role } : null, error: null } },
            }
          },
        }
      },
    },
  })
  return { ...module, signedOut: () => signedOut }
}

test('admin-host session middleware revokes a client session and returns a non-discoverable response', async () => {
  const session = loadSessionMiddleware('client')
  const response = await session.updateSession(request(), { requiredAuthenticatedRole: 'admin' })

  assert.equal(response.status, 404)
  assert.equal(session.signedOut(), 1)
  assert.match(response.headers.get('set-cookie') ?? '', /sb-session=;/)
})

test('a forged support cookie cannot let a client session traverse an admin-host client route', async () => {
  const session = loadSessionMiddleware('client')
  const response = await session.updateSession(request('/cliente/dashboard'), { requiredAuthenticatedRole: 'admin' })

  assert.equal(response.status, 404)
  assert.equal(session.signedOut(), 1)
})

test('admin-host session middleware preserves an administrator session', async () => {
  const session = loadSessionMiddleware('admin')
  const response = await session.updateSession(request('/paneladmin/inicio'), { requiredAuthenticatedRole: 'admin' })

  assert.equal(response.status, 200)
  assert.equal(session.signedOut(), 0)
})

function loadAdminLogin(role) {
  let signedOut = 0
  const sessionClient = {
    auth: {
      async signInWithPassword() { return { error: null } },
      async getUser() { return { data: { user: { id: 'signed-in-user' } } } },
      async signOut() { signedOut += 1; return { error: null } },
    },
    from(table) {
      assert.equal(table, 'profiles')
      return {
        select() { return this },
        eq() { return this },
        async maybeSingle() { return { data: role ? { role } : null, error: null } },
      }
    },
  }
  const actions = loadProjectModule('src/lib/actions/auth.ts', {
    '@/lib/supabase/server': { createSupabaseServerClient: async () => sessionClient },
    '@/lib/supabase/admin': { getSupabaseAdminClient: () => { throw new Error('not used') } },
    'next/navigation': { redirect(destination) { throw new Error(`redirect:${destination}`) } },
  })
  return { actions, signedOut: () => signedOut }
}

test('admin password login signs a client out without revealing its role', async () => {
  const setup = loadAdminLogin('client')
  const result = await setup.actions.adminLoginAction({}, form({ email: 'client@example.test', password: 'synthetic-password' }))

  assert.deepEqual(result, { error: 'No se pudo iniciar sesión. Revisa el email y la contraseña.' })
  assert.equal(setup.signedOut(), 1)
})

test('admin password login retains an administrator session', async () => {
  const setup = loadAdminLogin('admin')
  await assert.rejects(
    () => setup.actions.adminLoginAction({}, form({ email: 'owner@example.test', password: 'synthetic-password' })),
    { message: 'redirect:/paneladmin/inicio' },
  )
  assert.equal(setup.signedOut(), 0)
})

function loadCallback(role) {
  let signedOut = 0
  const route = loadProjectModule('src/app/auth/callback/route.ts', {
    '@/lib/supabase/server': {
      createSupabaseRouteClient: (_request, response) => ({
        auth: {
          async exchangeCodeForSession() {
            response.cookies.set('sb-session', 'synthetic-session', { httpOnly: true, path: '/' })
          },
          async getUser() { return { data: { user: { id: 'callback-user' } } } },
          async signOut() { signedOut += 1; response.cookies.set('sb-session', '', { path: '/', maxAge: 0 }) },
        },
        from(table) {
          assert.equal(table, 'profiles')
          return {
            select() { return this },
            eq() { return this },
            async maybeSingle() { return { data: role ? { role } : null, error: null } },
          }
        },
      }),
    },
  })
  return { route, signedOut: () => signedOut }
}

test('admin callback revokes a client exchange before redirecting to the panel', async () => {
  const setup = loadCallback('client')
  const url = new URL('https://admin.webfuengirola.com/auth/callback?code=valid&next=%2Fpaneladmin%2Finicio')
  const response = await setup.route.GET(new Request(url, { headers: { host: 'admin.webfuengirola.com' } }))

  assert.equal(response.headers.get('location'), 'https://admin.webfuengirola.com/paneladmin?error=unauthorized')
  assert.equal(setup.signedOut(), 1)
  assert.doesNotMatch(response.headers.get('set-cookie') ?? '', /synthetic-session/)
})

test('admin callback retains an administrator exchange', async () => {
  const setup = loadCallback('admin')
  const url = new URL('https://admin.webfuengirola.com/auth/callback?code=valid&next=%2Fpaneladmin%2Finicio')
  const response = await setup.route.GET(new Request(url, { headers: { host: 'admin.webfuengirola.com' } }))

  assert.equal(response.headers.get('location'), 'https://admin.webfuengirola.com/paneladmin/inicio')
  assert.equal(setup.signedOut(), 0)
})
