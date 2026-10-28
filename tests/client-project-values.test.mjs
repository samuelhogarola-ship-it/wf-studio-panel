import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migrationUrl = new URL('../supabase/migrations/202610280001_clients_project_values.sql', import.meta.url)

test('client project constraint accepts every project exposed by the admin UI', async () => {
  const sql = await readFile(migrationUrl, 'utf8')

  for (const project of [
    'wf-studio',
    'vivir-fuengirola',
    'vivir-fuengirola-negocios',
    'conoce-fuengirola',
  ]) {
    assert.match(sql, new RegExp(`'${project}'`))
  }

  assert.match(sql, /drop constraint if exists clients_project_check/i)
  assert.match(sql, /add constraint clients_project_check[\s\S]*check \(project in \(/i)
})
