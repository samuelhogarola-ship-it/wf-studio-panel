import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID, createHash } from 'node:crypto'

const enabled = Boolean(process.env.WF_SUPPORT_TEST_DATABASE_URL)
const digest = value => createHash('sha256').update(value).digest('hex')

test('Postgres enforces support ownership, lifetime, atomic replacement and append-only audit', { skip: !enabled }, async t => {
  const { Client } = await import('pg')
  const a = new Client({ connectionString: process.env.WF_SUPPORT_TEST_DATABASE_URL })
  const b = new Client({ connectionString: process.env.WF_SUPPORT_TEST_DATABASE_URL })
  const adminA = randomUUID(), adminB = randomUUID(), clientUser = randomUUID(), clientId = randomUUID(), inactiveId = randomUUID(), foreignId = randomUUID(), projectId = randomUUID()
  const userIds = [adminA, adminB, clientUser]
  const queryAs = async (connection, uid, sql, params = []) => {
    await connection.query('begin')
    try {
      await connection.query('set local role authenticated')
      await connection.query("select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claim.role', 'authenticated', true)", [uid])
      const result = await connection.query(sql, params)
      await connection.query('commit')
      return result
    } catch (error) { await connection.query('rollback'); throw error }
  }
  const start = (connection, uid, key, target = clientId, path = '/paneladmin/inicio') => queryAs(connection, uid,
    'select * from public.start_admin_support_session($1, $2, $3)', [target, digest(key), path])
  await a.connect()
  await b.connect()
  try {
    for (const [id, role] of [[adminA, 'admin'], [adminB, 'admin'], [clientUser, 'client']]) {
      await a.query('insert into auth.users (id, email) values ($1, $2)', [id, `${id}@support.test`])
      await a.query('insert into public.profiles (id, email, role) values ($1, $2, $3) on conflict (id) do update set role = excluded.role', [id, `${id}@support.test`, role])
    }
    for (const [id, status, project] of [[clientId, 'active', 'wf-studio'], [inactiveId, 'inactive', 'wf-studio'], [foreignId, 'active', 'vivir-fuengirola']]) {
      await a.query('insert into public.clients (id, name, email, status, project) values ($1, $2, $3, $4, $5)', [id, 'Support fixture', `${id}@support.test`, status, project])
    }
    await a.query("insert into public.client_projects (id, client_id, slug, name, domain) values ($1, $2, $3, 'Support fixture', $4)", [projectId, clientId, `support-${projectId}`, `${projectId}.test`])

    await t.test('clients and anonymous identities cannot start sessions; inactive, unknown and foreign clients fail', async () => {
      await assert.rejects(start(a, clientUser, 'client'), /administrator required/i)
      await assert.rejects(start(a, '', 'anonymous'), /administrator required/i)
      for (const target of [inactiveId, foreignId, randomUUID()]) await assert.rejects(start(a, adminA, target, target), /active client required/i)
      for (const path of ['https://evil.test', '//evil.test', '/cliente/dashboard', '/paneladmin/../cliente', '/paneladmin/%2e%2e/cliente', '/paneladmin/\\evil', '/paneladmin/inicio?next=evil', '/paneladmin/inicio\n']) {
        await assert.rejects(start(a, adminA, path, clientId, path), /return path/i)
      }
    })
    const first = (await start(a, adminA, 'first')).rows[0]
    await t.test('database lifetime, hash uniqueness and one unfinished row are enforced', async () => {
      assert.equal(first.admin_user_id, adminA)
      assert.equal(first.client_id, clientId)
      assert.equal(new Date(first.expires_at) - new Date(first.started_at), 1_800_000)
      const insert = `insert into public.admin_support_sessions (admin_user_id, client_id, token_hash, return_path, started_at, expires_at) values ($1, $2, $3, '/paneladmin/inicio', now(), now() + interval '31 minutes')`
      await assert.rejects(a.query(insert, [adminB, clientId, digest('too-long')]), { code: '23514' })
      await assert.rejects(start(a, adminB, 'first'), { code: '23505' })
      await assert.rejects(a.query("insert into public.admin_support_sessions (admin_user_id, client_id, token_hash, return_path, started_at, expires_at) values ($1, $2, $3, '/paneladmin/inicio', now(), now() + interval '1 minute')", [adminA, clientId, digest('unfinished')]), { code: '23505' })
    })
    await t.test('owner RLS hides sessions from other admins and clients; direct writes fail', async () => {
      for (const uid of [adminB, clientUser]) assert.equal((await queryAs(a, uid, 'select * from public.admin_support_sessions')).rowCount, 0)
      assert.equal((await queryAs(a, adminA, 'select * from public.admin_support_sessions')).rowCount, 1)
      for (const uid of userIds) {
        await assert.rejects(queryAs(a, uid, "update public.admin_support_sessions set return_path = '/paneladmin/inicio'"), { code: '42501' })
        await assert.rejects(queryAs(a, uid, 'delete from public.admin_support_sessions'), { code: '42501' })
        await assert.rejects(queryAs(a, uid, 'insert into public.admin_support_sessions default values'), { code: '42501' })
      }
      assert.equal((await queryAs(a, adminB, "select public.end_admin_support_session($1, 'manual') as ended", [digest('first')])).rows[0].ended, false)
      await assert.rejects(queryAs(a, clientUser, "select public.end_admin_support_session($1, 'manual')", [digest('first')]), /administrator required/i)
    })
    await t.test('failed replacement rolls back and expiry is recorded before replacement', async () => {
      await assert.rejects(start(a, adminA, 'first'), { code: '23505' })
      assert.equal((await a.query('select ended_at from public.admin_support_sessions where id = $1', [first.id])).rows[0].ended_at, null)
      await a.query("update public.admin_support_sessions set started_at = now() - interval '31 minutes', expires_at = now() - interval '1 minute' where id = $1", [first.id])
      await start(a, adminA, 'after-expiry')
      assert.equal((await a.query('select end_reason from public.admin_support_sessions where id = $1', [first.id])).rows[0].end_reason, 'expired')
    })
    await t.test('concurrent starts block on the administrator lock then leave one replaced and one active row', async () => {
      await a.query('begin')
      await a.query('set local role authenticated')
      await a.query("select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claim.role', 'authenticated', true)", [adminA])
      const one = (await a.query('select * from public.start_admin_support_session($1, $2, $3)', [clientId, digest('race-one'), '/paneladmin/inicio'])).rows[0]
      const pending = start(b, adminA, 'race-two')
      // Observe a real blocked backend rather than relying on a timing-only race.
      let blocked = false
      for (let attempt = 0; attempt < 100 && !blocked; attempt++) {
        const locks = await a.query("select 1 from pg_locks where pid = $1 and locktype = 'advisory' and not granted", [b.processID])
        blocked = locks.rowCount === 1
        if (!blocked) await new Promise(resolve => setTimeout(resolve, 10))
      }
      await a.query('commit')
      const two = (await pending).rows[0]
      assert.equal(blocked, true)
      const rows = (await a.query('select * from public.admin_support_sessions where id = any($1::uuid[])', [[one.id, two.id]])).rows
      assert.equal(rows.filter(row => row.ended_at === null).length, 1)
      assert.equal(rows.find(row => row.id === one.id).end_reason, 'replaced')
      assert.equal(rows.find(row => row.id === two.id).ended_at, null)
    })
    await t.test('manual end is owner-scoped and idempotent, reasons constrained', async () => {
      await assert.rejects(queryAs(a, adminA, "select public.end_admin_support_session($1, 'bogus')", [digest('race-two')]), /end reason/i)
      assert.equal((await queryAs(a, adminA, "select public.end_admin_support_session($1, 'manual') as ended", [digest('race-two')])).rows[0].ended, true)
      assert.equal((await queryAs(a, adminA, "select public.end_admin_support_session($1, 'manual') as ended", [digest('race-two')])).rows[0].ended, false)
    })
    await t.test('events are fixed-scope, session-bound, owner-readable and deny all direct writes', async () => {
      const eventId = randomUUID()
      const sql = 'insert into public.admin_support_events (id, support_session_id, admin_user_id, client_id, project_id, capability_key, scope) values ($1, $2, $3, $4, $5, $6, $7)'
      const params = [eventId, first.id, adminA, clientId, projectId, 'blogger', 'support_readonly']
      await assert.rejects(a.query(sql, [...params.slice(0, 6), 'blogger']), { code: '23514' })
      await assert.rejects(a.query(sql, [eventId, first.id, adminB, clientId, projectId, 'blogger', 'support_readonly']), { code: '23503' })
      await a.query(sql, params)
      assert.equal((await queryAs(a, adminA, 'select * from public.admin_support_events')).rowCount, 1)
      for (const uid of [adminB, clientUser]) assert.equal((await queryAs(a, uid, 'select * from public.admin_support_events')).rowCount, 0)
      for (const uid of userIds) for (const statement of [sql, 'update public.admin_support_events set scope = scope', 'delete from public.admin_support_events']) {
        await assert.rejects(queryAs(a, uid, statement, statement === sql ? [randomUUID(), ...params.slice(1)] : []), { code: '42501' })
      }
      for (const role of ['anon', 'service_role']) {
        await a.query('begin')
        try {
          await a.query(`set local role ${role}`)
          await assert.rejects(a.query(sql, [randomUUID(), ...params.slice(1)]), { code: '42501' })
        } finally { await a.query('rollback') }
      }
    })
  } finally {
    await a.query('rollback')
    await b.query('rollback')
    await a.query('delete from public.admin_support_events where admin_user_id = any($1::uuid[])', [userIds])
    await a.query('delete from public.admin_support_sessions where admin_user_id = any($1::uuid[])', [userIds])
    await a.query('delete from public.client_projects where id = $1', [projectId])
    await a.query('delete from public.clients where id = any($1::uuid[])', [[clientId, inactiveId, foreignId]])
    await a.query('delete from auth.users where id = any($1::uuid[])', [userIds])
    await Promise.all([a.end(), b.end()])
  }
})
