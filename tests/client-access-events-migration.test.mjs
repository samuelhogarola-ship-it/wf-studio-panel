import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migration = new URL('../supabase/migrations/202610290001_client_access_events.sql', import.meta.url)

test('client access events record only credential-free client password changes', async () => {
  const sql = await readFile(migration, 'utf8')

  assert.match(sql, /create table public\.client_access_events/)
  for (const column of ['id', 'client_id', 'auth_user_id', 'event_type', 'created_at']) {
    assert.match(sql, new RegExp(`\\b${column}\\b`))
  }
  assert.match(sql, /event_type text not null check \(event_type = 'password_changed_by_client'\)/)
  assert.doesNotMatch(sql, /\b(password|secret|token|credential)(?:_hash|_value|_text)?\s+text\b/i)
})

test('client access events are append-only and scoped to the owning active Studio client', async () => {
  const sql = await readFile(migration, 'utf8')

  assert.match(sql, /auth_user_id uuid not null references auth\.users\(id\) on delete cascade/)
  assert.match(sql, /client_id uuid not null references public\.clients\(id\) on delete cascade/)
  assert.match(sql, /alter table public\.client_access_events enable row level security/)
  assert.match(sql, /create policy client_access_events_admin_read[\s\S]*?private\.is_admin\(\)/)
  assert.match(sql, /create policy client_access_events_client_insert[\s\S]*?auth\.uid\(\) = auth_user_id[\s\S]*?c\.project = 'wf-studio'[\s\S]*?c\.status = 'active'[\s\S]*?lower\(c\.email\) = lower\(auth\.jwt\(\) ->> 'email'\)/)
  assert.match(sql, /revoke all on public\.client_access_events from public, anon, authenticated/)
  assert.match(sql, /grant select, insert on public\.client_access_events to authenticated/)
  assert.doesNotMatch(sql, /create policy client_access_events_\w+_(?:update|delete)/)
})

test('client access event relationship is represented in database types', async () => {
  const types = await readFile(new URL('../src/lib/supabase/types.ts', import.meta.url), 'utf8')

  assert.match(types, /client_access_events:/)
  assert.match(types, /event_type: 'password_changed_by_client'/)
  assert.match(types, /foreignKeyName: "client_access_events_client_id_fkey"/)
})
