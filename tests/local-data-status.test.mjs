import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { collectLocalDataStatus } from '../scripts/local-data-db.mjs'
import { formatLocalDataStatus, readRestoreTargetContext, readSupabaseLocalContext } from '../scripts/local-data-cli.mjs'

const localStatus = `
API_URL="http://127.0.0.1:55321"
ANON_KEY="local-anon"
SERVICE_ROLE_KEY="local-service-role"
DB_URL="postgresql://postgres:postgres@127.0.0.1:55322/postgres"
`

async function projectRoot() {
  const root = await mkdtemp(join(tmpdir(), 'wf-local-status-'))
  await mkdir(join(root, 'supabase'))
  await writeFile(join(root, 'supabase/config.toml'), 'project_id = "wf-local-test"\n')
  return root
}

test('local context resolves the labelled Supabase database container and returns no secrets', async () => {
  const root = await projectRoot()
  const calls = []
  const run = async (command, args) => {
    calls.push([command, args])
    if (command === 'npx') return { stdout: localStatus }
    return { stdout: 'abc123\tpublic.ecr.aws/supabase/postgres:17.6.1.132\nother\tpostgres:17\n' }
  }

  assert.deepEqual(await readSupabaseLocalContext({ run, root }), {
    projectId: 'wf-local-test',
    apiUrl: 'http://127.0.0.1:55321',
    dbUrl: 'postgresql://postgres:postgres@127.0.0.1:55322/postgres',
    containerId: 'abc123',
  })
  assert.equal(calls.length, 2)
  assert.match(calls[1][1].join(' '), /com\.supabase\.cli\.project=wf-local-test/)
})

test('local context rejects remote or incomplete status before container discovery without leaking values', async () => {
  const root = await projectRoot()
  for (const output of [
    localStatus.replace('http://127.0.0.1:55321', 'https://remote.supabase.co'),
    localStatus.replace('DB_URL="postgresql://postgres:postgres@127.0.0.1:55322/postgres"', ''),
    localStatus.replace('SERVICE_ROLE_KEY="local-service-role"', ''),
  ]) {
    let calls = 0
    const run = async () => { calls += 1; return { stdout: output } }
    await assert.rejects(() => readSupabaseLocalContext({ run, root }), (error) => {
      assert.doesNotMatch(error.message, /postgres:postgres|local-service-role|remote\.supabase\.co/)
      return true
    })
    assert.equal(calls, 1)
  }
})

test('restore target binds the supplied loopback database URL to the labelled Docker container', async () => {
  const root = await projectRoot()
  const environment = {
    LOCAL_RESTORE_PROJECT_ID: 'wf-recovery-target',
    LOCAL_RESTORE_DATABASE_URL: 'postgresql://postgres:private@127.0.0.1:56322/postgres',
  }
  const calls = []
  const run = async (command, args) => {
    calls.push([command, args])
    if (args[0] === 'ps') return { stdout: 'target123\tpublic.ecr.aws/supabase/postgres:17.6.1.132\n' }
    if (args[0] === 'inspect') return { stdout: '127.0.0.1\t56322\n' }
    throw new Error(`Unexpected command: ${command} ${args.join(' ')}`)
  }
  assert.deepEqual(await readRestoreTargetContext({ run, root, environment }), {
    projectId: 'wf-recovery-target',
    dbUrl: environment.LOCAL_RESTORE_DATABASE_URL,
    containerId: 'target123',
  })
  assert.equal(calls.length, 2)

  const mismatchRun = async (_command, args) => args[0] === 'ps'
    ? { stdout: 'target123\tpublic.ecr.aws/supabase/postgres:17.6.1.132\n' }
    : { stdout: '127.0.0.1\t57322\n' }
  await assert.rejects(() => readRestoreTargetContext({ run: mismatchRun, root, environment }), /URL|contenedor|puerto/i)
  await assert.rejects(() => readRestoreTargetContext({ run, root, environment: { ...environment, LOCAL_RESTORE_DATABASE_URL: 'postgresql://postgres:private@127.0.0.1:56322/other' } }), /postgres/i)
})

test('database status includes every public table and only required Auth identities', async () => {
  const db = {
    async query(sql) {
      if (sql.includes('information_schema.tables')) return { rows: [
        { schema: 'auth', name: 'identities' },
        { schema: 'auth', name: 'users' },
        { schema: 'public', name: 'clients' },
        { schema: 'public', name: 'expenses' },
        { schema: 'public', name: 'invoices' },
      ] }
      if (sql.includes('schema_migrations')) return { rows: [{ version: '202610280006' }] }
      if (sql.includes('count(*)')) return { rows: [{ count: sql.includes('clients') ? '2' : '1' }] }
      if (sql.includes('from public.clients')) return { rows: [{ id: 'client-demo', email: 'cliente.demo@local.test' }] }
      if (sql.includes('from public.invoices')) return { rows: [{ id: 'proposal-demo', document_type: 'proposal', recipient_email: 'prueba@local.test' }] }
      if (sql.includes('from public.expenses')) return { rows: [{ id: 'expense-demo', supplier: 'Prueba local WF-Panel', concept: 'Material · prueba local' }] }
      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const status = await collectLocalDataStatus({ db })
  assert.deepEqual(status.migrations, ['202610280006'])
  assert.deepEqual(status.tables, [
    { schema: 'auth', name: 'identities', count: 1 },
    { schema: 'auth', name: 'users', count: 1 },
    { schema: 'public', name: 'clients', count: 2 },
    { schema: 'public', name: 'expenses', count: 1 },
    { schema: 'public', name: 'invoices', count: 1 },
  ])
  assert.deepEqual(status.demoSnapshot.clients, [{ id: 'client-demo', email: 'cliente.demo@local.test' }])
})

test('formatted status exposes counts and candidate ids but no credentials or private record contents', () => {
  const output = formatLocalDataStatus({
    context: { projectId: 'wf-local-test', apiUrl: 'http://127.0.0.1:55321', dbUrl: 'postgresql://postgres:secret@127.0.0.1/postgres', containerId: 'abc' },
    status: {
      migrations: ['202610280006'],
      tables: [{ schema: 'public', name: 'invoices', count: 3 }],
      demoSnapshot: {
        clients: [{ id: 'client-demo', email: 'cliente.demo@local.test' }],
        billingDocuments: [{ id: 'proposal-demo', document_type: 'proposal', recipient_email: 'prueba@local.test', amount: 75 }],
        expenses: [{ id: 'expense-demo', supplier: 'Prueba local WF-Panel', concept: 'Material privado · prueba local', amount: 12.5 }],
      },
    },
  })

  assert.match(output, /public\.invoices: 3/)
  assert.match(output, /client-demo/)
  assert.match(output, /proposal-demo/)
  assert.match(output, /expense-demo/)
  assert.doesNotMatch(output, /postgresql:|secret|cliente\.demo@|prueba@|Material privado|75|12\.5/)
})
