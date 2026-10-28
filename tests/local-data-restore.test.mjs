import test from 'node:test'
import assert from 'node:assert/strict'
import { chmod, mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createBackupManifest, sha256File } from '../scripts/local-data-safety.mjs'
import { assertRestoredState, emptyDisposableTarget, restoreLocalBackup, validateRestoreRequest } from '../scripts/local-data-restore.mjs'
import { buildRecoveryConfig, withDisposableSupabase, withRecoveryDrillLock } from '../scripts/test-local-data-recovery.mjs'

const source = { projectId: 'wf-panel-source', dbUrl: 'postgresql://postgres:secret@127.0.0.1:55322/postgres' }
const target = { projectId: 'wf-panel-recovery', dbUrl: 'postgresql://postgres:other@127.0.0.1:56322/postgres', containerId: 'target-db' }
const manifest = {
  projectId: source.projectId,
  migrationVersions: ['202610280005', '202610280006'],
  tables: [
    { schema: 'auth', name: 'identities', count: 1 },
    { schema: 'auth', name: 'users', count: 1 },
    { schema: 'public', name: 'clients', count: 2 },
    { schema: 'public', name: 'invoices', count: 3 },
  ],
}
const emptyTargetStatus = {
  migrations: [...manifest.migrationVersions],
  tables: manifest.tables.map((table) => ({ ...table, count: 0 })),
}

test('restore validation rejects every unsafe destination before destructive work', () => {
  const valid = {
    source,
    target,
    manifest,
    confirmation: '--confirm-local-restore',
    targetStatus: emptyTargetStatus,
  }
  const rejected = [
    [{ ...valid, confirmation: undefined }, /confirmación/i],
    [{ ...valid, confirmation: '--yes' }, /confirmación/i],
    [{ ...valid, target: { ...target, dbUrl: 'postgresql://remote.example.com/postgres' } }, /local|loopback/i],
    [{ ...valid, target: { ...target, projectId: source.projectId } }, /distinto/i],
    [{ ...valid, target: { ...target, dbUrl: source.dbUrl } }, /distinto/i],
    [{ ...valid, manifest: { ...manifest, projectId: 'some-other-source' } }, /origen/i],
    [{ ...valid, targetStatus: { ...emptyTargetStatus, migrations: ['202610280005'] } }, /migraciones/i],
    [{ ...valid, targetStatus: { ...emptyTargetStatus, tables: emptyTargetStatus.tables.map((table) => table.name === 'clients' ? { ...table, count: 1 } : table) } }, /vacío/i],
    [{ ...valid, targetStatus: { ...emptyTargetStatus, tables: emptyTargetStatus.tables.slice(1) } }, /tablas/i],
  ]
  for (const [request, pattern] of rejected) assert.throws(() => validateRestoreRequest(request), pattern)
  assert.equal(validateRestoreRequest(valid), true)
})

test('restore verifies the dump before invoking Docker and then uses only the target container', async () => {
  const backupRoot = await mkdtemp(join(tmpdir(), 'wf-local-restore-'))
  const backupDirectory = join(backupRoot, '2026-10-28T14-00-00-000Z')
  await mkdir(backupDirectory, { mode: 0o700 })
  const dumpPath = join(backupDirectory, 'wf-panel.dump')
  const manifestPath = join(backupDirectory, 'manifest.json')
  await writeFile(dumpPath, 'valid-pg-archive', { mode: 0o600 })
  const backupManifest = createBackupManifest({
    createdAt: '2026-10-28T14:00:00.000Z',
    projectId: source.projectId,
    migrationVersions: manifest.migrationVersions,
    tables: manifest.tables,
    dump: { file: 'wf-panel.dump', size: Buffer.byteLength('valid-pg-archive'), sha256: '0'.repeat(64) },
  })
  await writeFile(manifestPath, JSON.stringify(backupManifest), { mode: 0o600 })
  await chmod(manifestPath, 0o600)
  let calls = []
  const run = async (command, args) => { calls.push([command, args]); return { stdout: '' } }
  await assert.rejects(() => restoreLocalBackup({ manifestPath, targetContext: target, run }), /checksum/i)
  assert.equal(calls.length, 0)

  backupManifest.dump.sha256 = await sha256File(dumpPath)
  await writeFile(manifestPath, JSON.stringify(backupManifest), { mode: 0o600 })
  calls = []
  await restoreLocalBackup({ manifestPath, targetContext: target, run })
  assert.ok(calls.every(([, args]) => !args.join(' ').includes('secret')))
  assert.ok(calls.every(([, args]) => !args.join(' ').includes(source.projectId)))
  const copyCall = calls.find(([, args]) => args[0] === 'cp')
  assert.match(copyCall[1][2], /^target-db:\/tmp\/wf-panel-restore-/)
  const restoreCall = calls.find(([, args]) => args.includes('pg_restore'))
  assert.equal(restoreCall[1][1], target.containerId)
  assert.ok(restoreCall[1].includes('--data-only'))
  assert.ok(restoreCall[1].includes('--exit-on-error'))
  assert.equal(restoreCall[1][restoreCall[1].indexOf('-U') + 1], 'supabase_admin')
})

test('restored state must match the manifest and billing invariants', () => {
  const restored = {
    migrations: [...manifest.migrationVersions],
    tables: manifest.tables.map((table) => ({ ...table })),
    invariants: { proposalsWithPaymentLinks: 0, immutableDocumentTypeTrigger: true, numberingFunctions: 2 },
  }
  assert.equal(assertRestoredState({ manifest, status: restored }), true)
  assert.throws(() => assertRestoredState({ manifest, status: { ...restored, tables: restored.tables.map((table) => table.name === 'clients' ? { ...table, count: 1 } : table) } }), /recuentos/i)
  assert.throws(() => assertRestoredState({ manifest, status: { ...restored, invariants: { ...restored.invariants, proposalsWithPaymentLinks: 1 } } }), /propuesta/i)
  assert.throws(() => assertRestoredState({ manifest, status: { ...restored, invariants: { ...restored.invariants, immutableDocumentTypeTrigger: false } } }), /inmutable/i)
  assert.throws(() => assertRestoredState({ manifest, status: { ...restored, invariants: { ...restored.invariants, numberingFunctions: 1 } } }), /numeración/i)
})

test('disposable target cleanup truncates only the explicit recovery contract', async () => {
  const queries = []
  const db = { query: async (sql) => { queries.push(sql); return { rows: [] } } }
  await emptyDisposableTarget({ db, status: emptyTargetStatus })
  assert.deepEqual(queries.slice(0, 2).map((sql) => sql.toLowerCase()), ['begin', 'set local session_replication_role = replica'])
  const truncate = queries.find((sql) => /truncate table/i.test(sql))
  assert.match(truncate, /"auth"\."users"/)
  assert.match(truncate, /"public"\."clients"/)
  assert.match(truncate, /cascade/i)
  assert.doesNotMatch(truncate, /restart identity|supabase_migrations|sessions|refresh_tokens/i)
  assert.equal(queries.at(-1).toLowerCase(), 'commit')
})

test('disposable recovery config has a unique identity and isolated loopback ports', () => {
  const sourceConfig = `project_id = "wf-source"\n[api]\nport = 55321\n[db]\nport = 55322\nshadow_port = 55320\n`
  const config = buildRecoveryConfig(sourceConfig, {
    projectId: 'wf-recovery-test-123',
    apiPort: 56321,
    databasePort: 56322,
    shadowPort: 56320,
  })
  assert.match(config, /project_id = "wf-recovery-test-123"/)
  assert.match(config, /\[api\][\s\S]*port = 56321/)
  assert.match(config, /\[db\][\s\S]*port = 56322[\s\S]*shadow_port = 56320/)
  assert.doesNotMatch(config, /wf-source|55321|55322|55320/)
})

test('recovery drill owns one lock and always stops only its disposable stack', async () => {
  const root = await mkdtemp(join(tmpdir(), 'wf-recovery-runner-'))
  const lockPath = join(root, 'recovery.lock')
  let nestedAttempted = false
  await withRecoveryDrillLock(lockPath, async () => {
    await assert.rejects(() => withRecoveryDrillLock(lockPath, async () => {}), /curso|ejecución/i)
    nestedAttempted = true
  })
  assert.equal(nestedAttempted, true)
  await withRecoveryDrillLock(lockPath, async () => {})

  const workspace = join(root, 'owned-workspace')
  const calls = []
  const run = async (command, args) => { calls.push([command, args]); return { stdout: '' } }
  await assert.rejects(() => withDisposableSupabase({ workspace, run }, async () => { throw new Error('drill failed') }), /drill failed/)
  assert.deepEqual(calls.map(([, args]) => args), [
    ['supabase', 'start', '--workdir', workspace],
    ['supabase', 'stop', '--workdir', workspace, '--no-backup'],
  ])
  assert.ok(calls.every(([, args]) => !args.join(' ').includes('postgresql://')))
})
