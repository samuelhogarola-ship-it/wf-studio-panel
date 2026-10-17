import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const migrations = new URL('supabase/migrations/', root)
const namespaceMigration = new URL('202607100001_clients_unique_per_project.sql', migrations)
const platformMigration = new URL('202610170001_client_portal_platform.sql', migrations)
const integrityMigration = new URL('202610170002_client_portal_integrity.sql', migrations)

async function readIntegrityMigration() {
  return readFile(integrityMigration, 'utf8').catch(error => {
    assert.fail(`Forward-only portal integrity migration must exist (${error.code})`)
  })
}

function policyBody(source, table, policy) {
  const match = source.match(new RegExp(`create policy ${policy} on public\\.${table}([\\s\\S]*?);`, 'i'))
  assert.ok(match, `${policy} must be recreated on ${table}`)
  return match[1]
}

function functionBody(source, name) {
  const match = source.match(new RegExp(`create or replace function private\\.${name}\\([^)]*\\)([\\s\\S]*?)\\$\\$;`, 'i'))
  assert.ok(match, `${name} must exist`)
  return match[1]
}

test('WF Studio account policies resolve duplicate-email namespaces through the portal client helper', async () => {
  const [source, platform, namespace, filenames] = await Promise.all([
    readIntegrityMigration(),
    readFile(platformMigration, 'utf8'),
    readFile(namespaceMigration, 'utf8'),
    readdir(migrations),
  ])

  const ordered = filenames.sort()
  assert.ok(ordered.indexOf('202610170002_client_portal_integrity.sql') > ordered.indexOf('202610170001_client_portal_platform.sql'))
  assert.match(namespace, /unique index if not exists clients_project_email_lower_unique_idx\s+on public\.clients \(project, lower\(email\)\)/i)
  const portalLookup = functionBody(platform, 'current_portal_client_id')
  for (const expression of [
    /auth\.uid\(\) is not null/,
    /c\.project = 'wf-studio'/,
    /c\.status = 'active'/,
    /lower\(c\.email\) = private\.current_client_email\(\)/,
  ]) assert.match(portalLookup, expression)

  const policies = [
    ['clients', 'clients_client_select_own', /id = private\.current_portal_client_id\(\)/, 1],
    ['packs', 'packs_client_select_own', /client_id = private\.current_portal_client_id\(\)/, 1],
    ['activities', 'activities_client_select_own', /client_id = private\.current_portal_client_id\(\)/, 1],
    ['notifications', 'notifications_client_select_own', /client_id = private\.current_portal_client_id\(\)/, 1],
    ['messages', 'messages_client_select_own', /client_id = private\.current_portal_client_id\(\)/, 1],
    ['messages', 'messages_client_insert_own', /client_id = private\.current_portal_client_id\(\)/, 1],
    ['messages', 'messages_client_update_own', /client_id = private\.current_portal_client_id\(\)/, 2],
    ['services', 'services_client_select_own', /client_id = private\.current_portal_client_id\(\)/, 1],
    ['invoices', 'invoices_client_select_own', /client_id = private\.current_portal_client_id\(\)/, 1],
    ['pending_items', 'pending_items_client_select_own', /client_id = private\.current_portal_client_id\(\)/, 1],
    ['client_resources', 'client_resources_own_read', /client_id = private\.current_portal_client_id\(\)/, 1],
  ]

  for (const [table, name, expected, expectedCount] of policies) {
    assert.match(source, new RegExp(`drop policy if exists ${name} on public\\.${table}`, 'i'))
    const body = policyBody(source, table, name)
    assert.match(body, /to authenticated/i)
    assert.match(body, expected)
    assert.equal((body.match(/private\.current_portal_client_id\(\)/g) ?? []).length, expectedCount, `${name} must use the scoped helper at every policy boundary`)
    assert.doesNotMatch(body, /current_client_id\(|auth\.jwt|current_client_email|lower\s*\(/i)
  }

  assert.doesNotMatch(source, /drop policy if exists \w+_admin_\w+ on/i)
  assert.doesNotMatch(source, /create policy \w+_admin_\w+ on/i)
  assert.doesNotMatch(source, /private\.current_client_id\(\)/)
})

test('every project insertion atomically receives exactly seven locked-down capability defaults', async () => {
  const source = await readIntegrityMigration()
  assert.match(source, /^begin;/i)
  assert.match(source, /commit;\s*$/i)

  const keys = functionBody(source, 'project_capability_keys')
  const actualKeys = [...keys.matchAll(/\('([^']+)'\)/g)].map(match => match[1]).sort()
  assert.deepEqual(actualKeys, ['analytics', 'blogger', 'bonuses_reports', 'domains', 'hosting', 'invoices', 'products'])

  const defaults = functionBody(source, 'ensure_project_capability_defaults')
  for (const expression of [
    /language plpgsql/i,
    /security definer/i,
    /set search_path = ''/i,
    /insert into public\.project_capabilities\s*\(project_id, capability_key, state, launch_url, metadata, validated_at\)/i,
    /select new\.id, k\.capability_key, 'unavailable', null, '\{\}'::jsonb, null/i,
    /from private\.project_capability_keys\(\) as k/i,
    /on conflict \(project_id, capability_key\) do nothing/i,
    /return new/i,
  ]) assert.match(defaults, expression)

  assert.match(source, /drop trigger if exists ensure_project_capability_defaults on public\.client_projects/i)
  assert.match(source, /create trigger ensure_project_capability_defaults\s+after insert on public\.client_projects\s+for each row execute function private\.ensure_project_capability_defaults\(\)/i)
  assert.match(source, /revoke all on function private\.project_capability_keys\(\) from public, anon, authenticated/i)
  assert.match(source, /revoke all on function private\.ensure_project_capability_defaults\(\) from public, anon, authenticated/i)

  const backfill = source.match(/-- Backfill([\s\S]*?)commit;/i)?.[1]
  assert.ok(backfill, 'existing projects must receive only missing defaults')
  assert.match(backfill, /from public\.client_projects as p\s+cross join private\.project_capability_keys\(\) as k/i)
  assert.match(backfill, /select p\.id, k\.capability_key, 'unavailable', null, '\{\}'::jsonb, null/i)
  assert.match(backfill, /on conflict \(project_id, capability_key\) do nothing/i)
  assert.doesNotMatch(backfill, /do update|update public\.project_capabilities/i)
})
