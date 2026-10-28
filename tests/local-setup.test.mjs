import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { buildLocalEnv, parseSupabaseEnv, writeLocalEnv } from '../scripts/setup-local.mjs'

const statusOutput = `
API_URL="http://127.0.0.1:55321"
ANON_KEY="local-anon-key"
SERVICE_ROLE_KEY="local-service-role"
DB_URL="postgresql://postgres:postgres@127.0.0.1:55322/postgres"
`

test('local setup parses the machine-readable Supabase status', () => {
  assert.deepEqual(parseSupabaseEnv(statusOutput), {
    API_URL: 'http://127.0.0.1:55321',
    ANON_KEY: 'local-anon-key',
    SERVICE_ROLE_KEY: 'local-service-role',
    DB_URL: 'postgresql://postgres:postgres@127.0.0.1:55322/postgres',
  })
})

test('local setup builds a complete app environment without production credentials', () => {
  const output = buildLocalEnv(parseSupabaseEnv(statusOutput), {
    appUrl: 'http://localhost:3000',
    adminEmail: 'admin@wf-panel.local',
    adminPassword: 'LocalPassword!',
    randomSecret: () => 'local-generated-secret',
  })

  const values = parseSupabaseEnv(output)
  assert.equal(values.NEXT_PUBLIC_SUPABASE_URL, 'http://127.0.0.1:55321')
  assert.equal(values.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, 'local-anon-key')
  assert.equal(values.SUPABASE_SECRET_KEY, 'local-service-role')
  assert.equal(values.APP_URL, 'http://localhost:3000')
  assert.equal(values.NEXT_PUBLIC_APP_URL, 'http://localhost:3000')
  assert.equal(values.PROJECT_PROVISIONING_SECRET, 'local-generated-secret')
  assert.equal(values.CRON_SECRET, 'local-generated-secret')
  assert.equal(values.LOCAL_ADMIN_EMAIL, 'admin@wf-panel.local')
  assert.equal(values.LOCAL_ADMIN_PASSWORD, 'LocalPassword!')
})

test('local setup writes the generated environment as a private file', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'wf-panel-local-env-'))
  const target = join(directory, '.env.local')
  const contents = buildLocalEnv(parseSupabaseEnv(statusOutput), { randomSecret: () => 'secret' })

  await writeLocalEnv(target, contents)

  assert.equal(await readFile(target, 'utf8'), contents)
  assert.equal((await stat(target)).mode & 0o777, 0o600)
})
