import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, realpath, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createLocalBackup, verifyLocalBackup } from '../scripts/local-data-backup.mjs'

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

const context = {
  projectId: 'wf-local-test',
  apiUrl: 'http://127.0.0.1:55321',
  dbUrl: 'postgresql://postgres:top-secret@127.0.0.1:55322/postgres',
  containerId: 'db-container-123',
}

const status = {
  migrations: ['202610280006'],
  tables: [
    { schema: 'auth', name: 'identities', count: 2 },
    { schema: 'auth', name: 'users', count: 2 },
    { schema: 'public', name: 'clients', count: 1 },
  ],
  demoSnapshot: { clients: [], billingDocuments: [], expenses: [] },
}

test('local backup creates one private custom archive for public data and bounded Auth identities', async () => {
  const backupRoot = await mkdtemp(join(tmpdir(), 'wf-local-backup-'))
  const calls = []
  const run = async (command, args) => {
    calls.push([command, args])
    if (command === 'docker' && args[0] === 'cp' && args[1].startsWith(`${context.containerId}:`)) {
      await writeFile(args[2], 'custom-pg-archive')
    }
    return { stdout: '' }
  }
  const now = () => new Date('2026-10-28T12:34:56.789Z')

  const result = await createLocalBackup({
    context,
    status,
    backupRoot,
    run,
    now,
    readStatus: async () => status,
  })

  const dumpCall = calls.find(([, args]) => args.includes('pg_dump'))
  assert.ok(dumpCall)
  assert.equal(dumpCall[1][1], context.containerId)
  assert.ok(dumpCall[1].includes('--format=custom'))
  assert.ok(dumpCall[1].includes('--data-only'))
  assert.ok(dumpCall[1].includes('--table=public.*'))
  assert.ok(dumpCall[1].includes('--table=auth.users'))
  assert.ok(dumpCall[1].includes('--table=auth.identities'))
  assert.ok(dumpCall[1].includes('--no-blobs'))
  assert.doesNotMatch(JSON.stringify(calls), /top-secret|refresh_tokens|sessions|mfa/i)

  assert.equal((await stat(join(backupRoot, '2026-10-28T12-34-56-789Z'))).mode & 0o777, 0o700)
  assert.equal((await stat(result.dumpPath)).mode & 0o777, 0o600)
  assert.equal((await stat(result.manifestPath)).mode & 0o777, 0o600)
  const manifest = JSON.parse(await readFile(result.manifestPath, 'utf8'))
  assert.equal(manifest.format, 'wf-panel-local-backup')
  assert.deepEqual(manifest.tables, status.tables)
  assert.equal(manifest.dump.file, 'wf-panel.dump')

  const callsBeforeRetry = calls.length
  await assert.rejects(() => createLocalBackup({ context, status, backupRoot, run, now, readStatus: async () => status }), /exist|existe/i)
  assert.equal(calls.length, callsBeforeRetry)
})

test('backup verification checks integrity before inspecting the PostgreSQL archive', async () => {
  const backupRoot = await mkdtemp(join(tmpdir(), 'wf-local-verify-'))
  const createRun = async (command, args) => {
    if (command === 'docker' && args[0] === 'cp' && args[1].startsWith(`${context.containerId}:`)) await writeFile(args[2], 'custom-pg-archive')
    return { stdout: '' }
  }
  const { manifestPath, dumpPath } = await createLocalBackup({
    context,
    status,
    backupRoot,
    run: createRun,
    now: () => new Date('2026-10-28T13:00:00.000Z'),
    readStatus: async () => status,
  })

  await writeFile(dumpPath, 'tampered-archive', { mode: 0o600 })
  let calls = []
  let copiedContent = ''
  const verifyRun = async (command, args) => {
    calls.push([command, args])
    if (args[0] === 'cp' && !args[1].startsWith(`${context.containerId}:`)) copiedContent = await readFile(args[1], 'utf8')
    if (args.includes('stat')) return { stdout: `${Buffer.byteLength(copiedContent)}\n` }
    if (args.includes('sha256sum')) return { stdout: `${sha256(copiedContent)}  archive.dump\n` }
    return { stdout: '' }
  }
  await assert.rejects(() => verifyLocalBackup({ manifestPath, backupRoot, run: verifyRun, context }), /tamaño|checksum/i)
  assert.equal(calls.length, 0)

  await writeFile(dumpPath, 'custom-pg-archive', { mode: 0o600 })
  const raceCalls = []
  let racedContent = ''
  const raceRun = async (command, args) => {
    raceCalls.push([command, args])
    if (args[0] === 'cp' && !args[1].startsWith(`${context.containerId}:`)) racedContent = 'changed-after-check'
    if (args.includes('stat')) return { stdout: `${Buffer.byteLength(racedContent)}\n` }
    if (args.includes('sha256sum')) return { stdout: `${sha256(racedContent)}  archive.dump\n` }
    return { stdout: '' }
  }
  await assert.rejects(() => verifyLocalBackup({ manifestPath, backupRoot, run: raceRun, context }), /copiado|checksum|tamaño/i)
  assert.equal(raceCalls.some(([, args]) => args.includes('pg_restore')), false)

  calls = []
  const manifest = await verifyLocalBackup({ manifestPath, backupRoot, run: verifyRun, context })
  assert.equal(manifest.projectId, context.projectId)
  const copyCall = calls.find(([, args]) => args[0] === 'cp')
  assert.equal(copyCall[1][1], await realpath(dumpPath))
  assert.match(copyCall[1][2], new RegExp(`^${context.containerId}:/tmp/wf-panel-verify-`))
  const inspectCall = calls.find(([, args]) => args.includes('pg_restore'))
  assert.ok(inspectCall[1].includes('--list'))
})
