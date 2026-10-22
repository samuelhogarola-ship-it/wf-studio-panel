import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { database, projectId } from './helpers/project-harness.mjs';

const root = new URL('../', import.meta.url);
const migration = new URL('supabase/migrations/202610200001_admin_project_favorites.sql', root);

async function readMigration() {
  return readFile(migration, 'utf8').catch(error => {
    assert.fail(`Administrator favorites migration must exist (${error.code})`);
  });
}

function tableBody(source) {
  const match = source.match(/create table if not exists public\.admin_project_favorites\s*\(([\s\S]*?)\);/i);
  assert.ok(match, 'admin_project_favorites must be created idempotently');
  return match[1];
}

function policyBody(source) {
  const match = source.match(/create policy admin_project_favorites_owner_all on public\.admin_project_favorites([\s\S]*?);/i);
  assert.ok(match, 'the owner-only administrator policy must exist');
  return match[1];
}

test('administrator favorites persistence is owner-scoped, typed and removable by exact preference key', async () => {
  const source = await readMigration();
  const table = tableBody(source);

  for (const expression of [
    /admin_user_id uuid not null/,
    /project_id uuid not null references public\.client_projects\(id\) on delete cascade/,
    /position integer/,
    /created_at timestamptz not null default now\(\)/,
    /primary key \(admin_user_id, project_id\)/,
  ]) assert.match(table, expression);

  assert.match(source, /create index if not exists admin_project_favorites_owner_order_idx\s+on public\.admin_project_favorites \(admin_user_id, position, created_at\)/i);
  assert.match(source, /alter table public\.admin_project_favorites enable row level security/i);
  const policy = policyBody(source);
  assert.match(policy, /for all to authenticated/i);
  assert.match(policy, /using \(auth\.uid\(\) = admin_user_id and private\.is_admin\(\)\)/i);
  assert.match(policy, /with check \(auth\.uid\(\) = admin_user_id and private\.is_admin\(\)\)/i);
  assert.doesNotMatch(source, /insert into public\.admin_project_favorites/i);

  const types = await readFile(new URL('src/lib/supabase/types.ts', root), 'utf8');
  assert.match(types, /admin_project_favorites: \{[\s\S]*?Row: \{ admin_user_id: string; project_id: string; position: number \| null; created_at: string \}[\s\S]*?Insert: \{ admin_user_id: string; project_id: string; position\?: number \| null; created_at\?: string \}[\s\S]*?Update: \{ admin_user_id\?: string; project_id\?: string; position\?: number \| null; created_at\?: string \}/);
  assert.match(types, /admin_project_favorites_project_id_fkey[\s\S]*?referencedRelation: "client_projects"/);

  const first = { admin_user_id: 'admin-a', project_id: projectId, position: 0, created_at: '2026-10-20T00:00:00Z' };
  const second = { ...first, admin_user_id: 'admin-b' };
  const db = database({ admin_project_favorites: [first, second] });
  await db.from('admin_project_favorites').delete().eq('admin_user_id', first.admin_user_id).eq('project_id', first.project_id);
  assert.deepEqual(db.tables.admin_project_favorites, [second]);
  assert.deepEqual(database().tables.admin_project_favorites, []);
});
