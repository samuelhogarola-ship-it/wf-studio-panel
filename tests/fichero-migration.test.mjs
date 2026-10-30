import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migrationUrl = new URL('../supabase/migrations/202610300001_fichero_catalog.sql', import.meta.url)

async function migrationSql() {
  return (await readFile(migrationUrl, 'utf8')).replace(/\s+/g, ' ').toLowerCase()
}

const tables = [
  'directory_catalogs',
  'directory_channels',
  'directory_profiles',
  'directory_profile_channels',
  'directory_profile_reviews',
  'directory_publication_events',
  'directory_slug_redirects',
]

test('creates the complete canonical directory model with its fixed state domains', async () => {
  const sql = await migrationSql()

  for (const table of tables) {
    assert.match(sql, new RegExp(`create table public\\.${table} \\(`))
  }

  assert.match(sql, /plan text not null[^;]+check \(plan in \('gratis', 'pro', 'premium'\)\)/)
  assert.match(sql, /review_status text not null[^;]+check \(review_status in \('draft', 'pending_review', 'approved', 'rejected', 'archived'\)\)/)
  assert.match(sql, /last_publication_status text[^;]+check \(last_publication_status is null or last_publication_status in \('pending', 'publishing', 'published', 'failed'\)\)/)
  assert.match(sql, /status text not null[^;]+check \(status in \('pending', 'publishing', 'published', 'failed'\)\)/)
})

test('creates the extension schema before installing citext into it', async () => {
  const sql = await migrationSql()
  const schemaPosition = sql.indexOf('create schema if not exists extensions')
  const extensionPosition = sql.indexOf('create extension if not exists citext with schema extensions')

  assert.notEqual(schemaPosition, -1)
  assert.notEqual(extensionPosition, -1)
  assert.ok(schemaPosition < extensionPosition)
})

test('makes canonical slugs, channel links and publication versions idempotently unique', async () => {
  const sql = await migrationSql()

  assert.match(sql, /unique \(catalog_id, canonical_slug\)/)
  assert.match(sql, /primary key \(profile_id, channel_id\)/)
  assert.match(sql, /unique \(profile_id, channel_id, source_version\)/)
  assert.match(sql, /idempotency_key text not null unique/)
})

test('keeps every canonical table behind administrator-only row level security', async () => {
  const sql = await migrationSql()

  for (const table of tables) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`))
    assert.match(
      sql,
      new RegExp(`create policy ${table}_admin_all on public\\.${table} for all to authenticated using \\(private\\.is_admin\\(\\)\\) with check \\(private\\.is_admin\\(\\)\\)`),
    )
  }

  assert.doesNotMatch(sql, /grant select on table public\.directory_profiles to (anon|public)/)
  assert.doesNotMatch(sql, /create policy directory_profiles_[^;]+ for select to (anon|public)/)
})

test('seeds Fuengirola with both mandatory publication channels', async () => {
  const sql = await migrationSql()

  assert.match(sql, /values \('fuengirola', 'fuengirola', 'active'\)/)
  assert.match(sql, /values[^;]+\('vivir-fuengirola', 'vivir en fuengirola', 'active'\)[^;]+\('conoce-fuengirola', 'conoce fuengirola', 'active'\)/)
})
