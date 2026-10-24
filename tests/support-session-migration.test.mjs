import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migration = new URL('../supabase/migrations/202610230001_admin_support_sessions.sql', import.meta.url)

test('support migration persists bounded owner sessions and fixed-scope append-only events', async () => {
  const sql = await readFile(migration, 'utf8')
  for (const column of ['admin_user_id', 'client_id', 'token_hash', 'return_path', 'started_at', 'expires_at', 'ended_at', 'end_reason']) assert.match(sql, new RegExp(`\\b${column}\\b`))
  assert.match(sql, /expires_at <= started_at \+ interval '30 minutes'/)
  assert.match(sql, /unique index[\s\S]*?admin_user_id\) where ended_at is null/)
  assert.match(sql, /token_hash text not null unique/)
  assert.match(sql, /create table public\.admin_support_events/)
  for (const column of ['support_session_id', 'client_id', 'project_id', 'capability_key']) assert.match(sql, new RegExp(`\\b${column}\\b`))
  assert.match(sql, /scope = 'support_readonly'/)
  assert.match(sql, /revoke all on public\.admin_support_events from public, anon, authenticated, service_role/)
})

test('start and end derive the admin from JWT and restrict definer execution', async () => {
  const sql = await readFile(migration, 'utf8')
  assert.equal((sql.match(/security definer set search_path = pg_catalog, public/g) ?? []).length, 2)
  assert.match(sql, /pg_advisory_xact_lock\(hashtextextended\(auth\.uid\(\)::text, 0\)\)/)
  assert.match(sql, /p\.id = auth\.uid\(\) and p\.role = 'admin'/)
  assert.doesNotMatch(sql, /p_admin_user_id/)
  for (const fn of ['start_admin_support_session', 'end_admin_support_session']) {
    assert.match(sql, new RegExp(`revoke all on function public\\.${fn}[^;]+from public, anon, authenticated, service_role`))
    assert.match(sql, new RegExp(`grant execute on function public\\.${fn}[^;]+to authenticated`))
  }
})

test('event relationship metadata uses the explicit PostgreSQL constraint name', async () => {
  const sql = await readFile(migration, 'utf8')
  const types = await readFile(new URL('../src/lib/supabase/types.ts', import.meta.url), 'utf8')
  const name = types.match(/foreignKeyName: "(admin_support_events_[^"]+)"/)?.[1]
  assert.ok(name, 'event relationship must be typed')
  assert.ok(Buffer.byteLength(name) <= 63, 'PostgreSQL truncates names longer than 63 bytes')
  assert.match(sql, new RegExp(`constraint ${name}\\s+foreign key \\(support_session_id, admin_user_id, client_id\\)`))
})
