import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const migrationUrl = new URL('supabase/migrations/202610170001_client_portal_platform.sql', root)
const sql = () => readFile(migrationUrl, 'utf8').catch(error => {
  assert.fail(`Client portal migration must exist (${error.code})`)
})
const table = (source, name) => {
  const body = source.match(new RegExp(`create table if not exists public\\.${name} \\(([\\s\\S]*?)\\n\\);`, 'i'))
  assert.ok(body, `${name} must exist`)
  return body[1]
}

test('model constrains the exact portal, project, capability key and state values', async () => {
  const source = await sql()
  assert.match(source, /portal_mode text not null default 'legacy'/)
  assert.match(source, /check \(portal_mode in \('legacy', 'dynamic'\)\)/)
  assert.match(table(source, 'client_projects'), /check \(status in \('draft', 'active', 'archived'\)\)/)
  const capabilities = table(source, 'project_capabilities')
  assert.match(capabilities, /check \(capability_key in \('products', 'domains', 'hosting', 'invoices', 'bonuses_reports', 'blogger', 'analytics'\)\)/)
  assert.match(capabilities, /state text not null default 'unavailable' check \(state in \('unavailable', 'available', 'active'\)\)/)
  assert.match(capabilities, /unique \(project_id, capability_key\)/)
  assert.match(capabilities, /capability_key <> 'blogger' or state <> 'active' or \(launch_url is not null and validated_at is not null/)
})

test('projects have nullable ownership, portal controls, timestamps and normalized unique identities', async () => {
  const source = await sql()
  const projects = table(source, 'client_projects')
  assert.match(projects, /client_id uuid references public\.clients\(id\) on delete set null/)
  assert.match(projects, /client_access_enabled boolean not null default false/)
  for (const field of ['hosting_label', 'hosting_management_url', 'analytics_registry_key']) assert.match(projects, new RegExp(`${field} text`))
  for (const name of ['client_projects', 'project_capabilities']) {
    assert.match(table(source, name), /created_at timestamptz not null default now\(\)/)
    assert.match(table(source, name), /updated_at timestamptz not null default now\(\)/)
    assert.match(source, new RegExp(`before update on public\\.${name}[\\s\\S]*?execute function public\\.set_updated_at\\(\\)`))
  }
  assert.match(source, /create unique index if not exists client_projects_slug_normalized_unique_idx\s+on public\.client_projects \(lower\(btrim\(slug\)\)\)/)
  assert.match(source, /create unique index if not exists client_projects_domain_normalized_unique_idx\s+on public\.client_projects \(lower\(btrim\(domain\)\)\)/)
})

test('portal RLS resolves the wf-studio namespace and hides foreign, archived, hidden and inactive rows', async () => {
  const source = await sql()
  const lookup = source.match(/create or replace function private\.current_portal_client_id\(\)([\s\S]*?)\$\$;/)?.[1]
  assert.ok(lookup, 'portal-specific client lookup must exist')
  for (const expression of [/security definer/, /set search_path = ''/, /auth\.uid\(\) is not null/, /c\.project = 'wf-studio'/, /c\.status = 'active'/, /lower\(c\.email\) = private\.current_client_email\(\)/]) assert.match(lookup, expression)
  const access = source.match(/create or replace function private\.can_read_client_project\(p_project_id uuid\)([\s\S]*?)\$\$;/)?.[1]
  assert.ok(access)
  for (const expression of [/p\.id = p_project_id/, /p\.client_id = private\.current_portal_client_id\(\)/, /p\.status = 'active'/, /p\.client_access_enabled/]) assert.match(access, expression)
  for (const name of ['client_projects', 'project_capabilities', 'project_capability_audit']) assert.match(source, new RegExp(`alter table public\\.${name} enable row level security`))
  for (const name of ['client_projects', 'project_capabilities']) {
    assert.match(source, new RegExp(`create policy ${name}_admin_all on public\\.${name}\\s+for all to authenticated using \\(private\\.is_admin\\(\\)\\) with check \\(private\\.is_admin\\(\\)\\)`))
    assert.match(source, new RegExp(`create policy ${name}_client_select on public\\.${name}\\s+for select to authenticated`))
  }
  assert.match(source, /using \(private\.can_read_client_project\(id\)\)/)
  assert.match(source, /using \(state = 'active' and private\.can_read_client_project\(project_id\)\)/)
  assert.doesNotMatch(source, /create policy \w+_client_\w+ on public\.\w+\s+for (?:all|insert|update|delete)/)
  assert.doesNotMatch(source, /create or replace function private\.current_client_id\(\)/)
})

test('audit records capability mutations and cannot be edited, deleted, truncated or forged by clients', async () => {
  const source = await sql()
  const audit = table(source, 'project_capability_audit')
  for (const expression of [/actor_id uuid/, /old_record jsonb/, /new_record jsonb/, /operation text not null check \(operation in \('INSERT', 'UPDATE', 'DELETE'\)\)/]) assert.match(audit, expression)
  assert.doesNotMatch(audit, /on delete cascade/)
  assert.match(source, /after insert or update or delete on public\.project_capabilities/)
  assert.match(source, /insert into public\.project_capability_audit/)
  assert.match(source, /auth\.uid\(\)/)
  assert.match(source, /to_jsonb\(old\)/)
  assert.match(source, /to_jsonb\(new\)/)
  assert.match(source, /before update or delete or truncate on public\.project_capability_audit/)
  assert.match(source, /raise exception 'Capability audit is append-only'/)
  assert.match(source, /revoke all on public\.project_capability_audit from public, anon, authenticated/)
  assert.match(source, /grant select on public\.project_capability_audit to authenticated/)
  assert.match(source, /create policy project_capability_audit_admin_select[\s\S]*?for select to authenticated using \(private\.is_admin\(\)\)/)
})

test('registry seed is idempotent for either identity and never activates Blogger or rewrites existing data', async () => {
  const source = await sql()
  const registry = JSON.parse(await readFile(new URL('src/config/sites.json', root), 'utf8'))
  const seed = source.slice(source.indexOf('-- Registry seed'))
  assert.ok(seed.startsWith('-- Registry seed'))
  for (const site of registry) {
    assert.ok(seed.includes(`'${site.key}'`), `missing ${site.key}`)
    assert.ok(seed.includes(`'${site.domain}'`), `missing ${site.domain}`)
    assert.ok(seed.includes(`'${site.name.replaceAll("'", "''")}'`), `missing ${site.name}`)
  }
  assert.match(seed, /lower\(btrim\(p\.slug\)\) = seed\.slug or lower\(btrim\(p\.domain\)\) = seed\.domain/)
  assert.match(seed, /on conflict do nothing/)
  assert.match(seed, /on conflict \(project_id, capability_key\) do nothing/)
  assert.doesNotMatch(seed, /'active'|do update/i)
  assert.doesNotMatch(source, /(?:update|delete from|alter table) public\.(?:invoices|packs|services|client_resources)\b/i)
  assert.doesNotMatch(source, /update public\.clients/i)
})

test('Supabase types expose project and capability rows, relationships, exact unions and immutable audit writes', async () => {
  const types = await readFile(new URL('src/lib/supabase/types.ts', root), 'utf8')
  for (const name of ['client_projects', 'project_capabilities', 'project_capability_audit']) assert.match(types, new RegExp(`\\b${name}: \\{`))
  for (const field of ['portal_mode: PortalMode', 'portal_mode?: PortalMode', 'client_projects_client_id_fkey', 'project_capabilities_project_id_fkey']) assert.ok(types.includes(field), `missing ${field}`)
  assert.match(types, /export type PortalMode = 'legacy' \| 'dynamic'/)
  assert.match(types, /export type ProjectStatus = 'draft' \| 'active' \| 'archived'/)
  assert.match(types, /export type CapabilityKey = 'products' \| 'domains' \| 'hosting' \| 'invoices' \| 'bonuses_reports' \| 'blogger' \| 'analytics'/)
  assert.match(types, /export type CapabilityState = 'unavailable' \| 'available' \| 'active'/)
  assert.match(types, /project_capability_audit: \{[\s\S]*?Insert: never\s+Update: never/)
})
