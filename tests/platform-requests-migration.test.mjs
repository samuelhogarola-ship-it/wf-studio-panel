import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migrationUrl = new URL('../supabase/migrations/202610290003_platform_requests.sql', import.meta.url)

async function migration() {
  return readFile(migrationUrl, 'utf8').catch((error) => {
    assert.fail(`platform requests migration must exist (${error.code})`)
  })
}

function functionBody(sql, name) {
  const match = sql.match(new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?\\$\\$([\\s\\S]*?)\\$\\$;`, 'i'))
  assert.ok(match, `${name} must exist`)
  return match[1]
}

test('platform requests persist normalized contact data and constrained workflow values', async () => {
  const sql = await migration()
  const table = sql.match(/create table public\.platform_requests \(([\s\S]*?)\n\);/i)?.[1]
  assert.ok(table, 'platform_requests table must exist')
  for (const field of [
    /id uuid primary key default gen_random_uuid\(\)/,
    /platform text not null check \(platform in \('vivir-fuengirola', 'vivir-fuengirola-negocios', 'conoce-fuengirola'\)\)/,
    /request_type text not null check \(request_type in \('client', 'business', 'subscription_interest'\)\)/,
    /name text not null/,
    /email text not null/,
    /profile_data jsonb not null default '\{\}'::jsonb check \(jsonb_typeof\(profile_data\) = 'object'\)/,
    /status text not null default 'pending' check \(status in \('pending', 'approved', 'rejected'\)\)/,
    /converted_client_id uuid references public\.clients\(id\) on delete set null/,
    /reviewed_by uuid references auth\.users\(id\) on delete set null/,
    /created_at timestamptz not null default now\(\)/,
    /updated_at timestamptz not null default now\(\)/,
  ]) assert.match(table, field)
  assert.match(sql, /before update on public\.platform_requests[\s\S]*?execute function public\.set_updated_at\(\)/i)
})

test('pending request fingerprint is unique without preventing later resubmission', async () => {
  const sql = await migration()
  assert.match(sql, /create unique index platform_requests_pending_fingerprint_unique_idx\s+on public\.platform_requests \(fingerprint\)\s+where status = 'pending'/i)
  assert.doesNotMatch(sql, /unique\s*\(fingerprint\)/i)
})

test('RLS permits admin reads while public submissions require the server adapter', async () => {
  const sql = await migration()
  assert.match(sql, /alter table public\.platform_requests enable row level security/i)
  assert.match(sql, /create policy platform_requests_admin_select[\s\S]*?for select to authenticated[\s\S]*?using \(private\.is_admin\(\)\)/i)
  assert.match(sql, /revoke all on table public\.platform_requests from public, anon, authenticated/i)
  assert.match(sql, /grant select on table public\.platform_requests to authenticated/i)
  assert.doesNotMatch(sql, /create policy \w+[\s\S]*?for (?:insert|update|delete|all) to (?:anon|authenticated)/i)
})

test('approval is admin-only, locks one pending request and maps every platform exactly', async () => {
  const sql = await migration()
  const body = functionBody(sql, 'approve_platform_request')
  assert.match(sql, /approve_platform_request\(p_request_id uuid\)[\s\S]*?returns table \(outcome text, client_id uuid\)[\s\S]*?security definer[\s\S]*?set search_path = ''/i)
  assert.match(body, /auth\.uid\(\) is null or not private\.is_admin\(\)/i)
  assert.match(body, /from public\.platform_requests[\s\S]*?where id = p_request_id[\s\S]*?for update/i)
  assert.match(body, /v_request\.status <> 'pending'/i)
  for (const [platform, project] of [
    ['vivir-fuengirola', 'vivir-fuengirola'],
    ['vivir-fuengirola-negocios', 'vivir-fuengirola-negocios'],
    ['conoce-fuengirola', 'conoce-fuengirola'],
  ]) assert.match(body, new RegExp(`when '${platform}' then '${project}'`, 'i'))
})

test('approval reuses the project email uniqueness guarantee under concurrent requests', async () => {
  const sql = await migration()
  const body = functionBody(sql, 'approve_platform_request')
  assert.match(body, /to_regclass\('public\.clients_project_email_lower_unique_idx'\)/i)
  assert.match(body, /where project = v_project[\s\S]*?lower\(email\) = lower\(v_request\.email\)/i)
  assert.match(body, /insert into public\.clients[\s\S]*?on conflict \(project, lower\(email\)\) do nothing[\s\S]*?returning id into v_client_id/i)
  assert.match(body, /if v_client_id is null then[\s\S]*?select id[\s\S]*?from public\.clients[\s\S]*?lower\(email\) = lower\(v_request\.email\)/i)
  assert.doesNotMatch(body, /update public\.clients/i)
})

test('approval records the reviewer and returns whether a client was created or reused', async () => {
  const body = functionBody(await migration(), 'approve_platform_request')
  assert.match(body, /status = 'approved'/i)
  assert.match(body, /converted_client_id = v_client_id/i)
  assert.match(body, /reviewed_by = auth\.uid\(\)/i)
  assert.match(body, /reviewed_at = now\(\)/i)
  assert.match(body, /case when v_created then 'created_client' else 'existing_client' end/i)
})

test('rejection is admin-only, accepts only pending requests and preserves an audit trail', async () => {
  const sql = await migration()
  const body = functionBody(sql, 'reject_platform_request')
  assert.match(sql, /reject_platform_request\(p_request_id uuid, p_reason text default null\)[\s\S]*?security definer[\s\S]*?set search_path = ''/i)
  assert.match(body, /auth\.uid\(\) is null or not private\.is_admin\(\)/i)
  assert.match(body, /where id = p_request_id and status = 'pending'/i)
  assert.match(body, /status = 'rejected'/i)
  assert.match(body, /rejection_reason = nullif\(btrim\(p_reason\), ''\)/i)
  assert.match(body, /reviewed_by = auth\.uid\(\)/i)
  assert.match(body, /reviewed_at = now\(\)/i)
})

test('only authenticated admins may execute workflow RPCs', async () => {
  const sql = await migration()
  for (const signature of [
    'approve_platform_request(uuid)',
    'reject_platform_request(uuid, text)',
  ]) {
    const escaped = signature.replace(/[()]/g, '\\$&')
    assert.match(sql, new RegExp(`revoke all on function public\\.${escaped} from public, anon, authenticated`, 'i'))
    assert.match(sql, new RegExp(`grant execute on function public\\.${escaped} to authenticated`, 'i'))
  }
})
