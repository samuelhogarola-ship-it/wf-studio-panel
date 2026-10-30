import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migrationUrl = new URL('../supabase/migrations/202610300002_fichero_request_approval.sql', import.meta.url)

async function migrationSql() {
  return (await readFile(migrationUrl, 'utf8')).replace(/\s+/g, ' ').toLowerCase()
}

test('business request approval is admin-derived, locked and idempotently linked to one draft', async () => {
  const sql = await migrationSql()

  assert.match(sql, /create or replace function public\.approve_directory_request\( p_request_id uuid, p_profile_patch jsonb default '\{\}'::jsonb \)/)
  assert.match(sql, /security definer set search_path = ''/)
  assert.match(sql, /auth\.uid\(\) is null or not private\.is_admin\(\)/)
  assert.match(sql, /from public\.platform_requests where id = p_request_id for update/)
  assert.match(sql, /from public\.directory_profiles where source_request_id = p_request_id/)
  assert.match(sql, /insert into public\.directory_profiles[^;]+review_status[^;]+draft/)
  assert.match(sql, /insert into public\.directory_profile_channels/)
  assert.match(sql, /insert into public\.directory_profile_reviews/)
  assert.match(sql, /update public\.platform_requests set status = 'approved'/)
  assert.doesNotMatch(sql, /published_at\s*=\s*now\(\)/)
})

test('business approval accepts only fichero.v1 Fuengirola business requests', async () => {
  const sql = await migrationSql()

  assert.match(sql, /v_request\.request_type <> 'business'/)
  assert.match(sql, /v_request\.profile_data ->> 'schema_version' <> 'fichero\.v1'/)
  assert.match(sql, /v_request\.profile_data ->> 'catalog' <> 'fuengirola'/)
})

test('direct RPC access is revoked and execution is limited to authenticated admins', async () => {
  const sql = await migrationSql()

  assert.match(sql, /revoke all on function public\.approve_directory_request\(uuid, jsonb\) from public, anon, authenticated/)
  assert.match(sql, /grant execute on function public\.approve_directory_request\(uuid, jsonb\) to authenticated/)
})
