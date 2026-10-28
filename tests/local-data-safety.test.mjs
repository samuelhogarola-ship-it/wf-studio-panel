import test from 'node:test'
import assert from 'node:assert/strict'
import { chmod, mkdtemp, mkdir, realpath, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  assertLoopbackDatabaseUrl,
  assertLoopbackHttpUrl,
  classifyKnownDemoRecords,
  createBackupManifest,
  resolveConfinedBackupPath,
  sha256File,
  verifyBackupManifest,
} from '../scripts/local-data-safety.mjs'

test('local data URLs accept exact loopback hosts only', () => {
  for (const value of ['http://localhost:54321', 'http://127.0.0.1:54321', 'http://[::1]:54321']) {
    assert.equal(assertLoopbackHttpUrl(value).port, '54321')
  }
  for (const value of ['postgresql://postgres:secret@localhost:54322/postgres', 'postgres://postgres:secret@127.0.0.1:54322/postgres', 'postgresql://postgres:secret@[::1]:54322/postgres']) {
    assert.equal(assertLoopbackDatabaseUrl(value).pathname, '/postgres')
  }

  for (const value of ['http://127.0.0.1.evil.example:54321', 'https://supabase.example.com', 'file:///tmp/database']) {
    assert.throws(() => assertLoopbackHttpUrl(value), /local/i)
  }
  for (const value of ['postgresql://postgres:secret@db.example.com:54322/postgres', 'https://127.0.0.1:54322/postgres']) {
    assert.throws(() => assertLoopbackDatabaseUrl(value), /local/i)
  }
})

test('backup paths stay inside the real backup root', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'wf-local-data-path-'))
  const root = join(parent, 'backups')
  const outside = join(parent, 'outside')
  await mkdir(root)
  await mkdir(outside)
  await mkdir(join(root, 'safe'))
  await symlink(outside, join(root, 'linked-outside'))

  assert.equal(await resolveConfinedBackupPath(root, 'safe/manifest.json'), join(await realpath(root), 'safe', 'manifest.json'))
  await assert.rejects(() => resolveConfinedBackupPath(root, '../outside/dump.backup'), /fuera/i)
  await assert.rejects(() => resolveConfinedBackupPath(root, 'linked-outside/dump.backup'), /fuera/i)
})

test('demo classification is exact and excludes the local admin and historical placeholders', () => {
  const candidates = classifyKnownDemoRecords({
    clients: [
      { id: 'client-demo', email: 'cliente.demo@local.test' },
      { id: 'local-admin', email: 'admin@wf-panel.local' },
      { id: 'other-test', email: 'real.person@local.test' },
    ],
    billingDocuments: [
      { id: 'proposal-demo', document_type: 'proposal', recipient_email: 'prueba@local.test' },
      { id: 'invoice-1', document_type: 'invoice', recipient_email: 'facturacion-no-disponible+wf001@wf-panel.local' },
      { id: 'invoice-2', document_type: 'invoice', recipient_email: 'facturacion-no-disponible+wf002@wf-panel.local' },
      { id: 'invoice-3', document_type: 'invoice', recipient_email: 'facturacion-no-disponible+wf003@wf-panel.local' },
    ],
    expenses: [
      { id: 'expense-demo', supplier: 'Prueba local WF-Panel', concept: 'Material de clase · prueba local' },
      { id: 'expense-real', supplier: 'Proveedor real', concept: 'Servicio real' },
    ],
  })

  assert.deepEqual(candidates, [
    { entity: 'client', id: 'client-demo', reason: 'cliente de validación local' },
    { entity: 'billing_document', id: 'proposal-demo', reason: 'propuesta de validación local' },
    { entity: 'expense', id: 'expense-demo', reason: 'gasto de validación local' },
  ])
})

test('backup manifests verify private files by size and checksum without serializing secrets', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'wf-local-data-manifest-'))
  const root = join(parent, 'backups')
  const backup = join(root, '2026-10-28T12-00-00-000Z')
  await mkdir(backup, { recursive: true, mode: 0o700 })
  const dumpPath = join(backup, 'wf-panel.dump')
  const manifestPath = join(backup, 'manifest.json')
  await writeFile(dumpPath, 'database-backup', { mode: 0o600 })
  const checksum = await sha256File(dumpPath)
  const manifest = createBackupManifest({
    createdAt: '2026-10-28T12:00:00.000Z',
    projectId: 'wf-studio-support-test',
    migrationVersions: ['202610280006'],
    tables: [
      { schema: 'auth', name: 'users', count: 2 },
      { schema: 'public', name: 'clients', count: 1 },
    ],
    dump: { file: 'wf-panel.dump', size: 15, sha256: checksum },
    dbUrl: 'postgresql://postgres:secret@127.0.0.1/postgres',
    serviceKey: 'service-role-secret',
    messageBody: 'private message',
  })
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 })

  assert.deepEqual(await verifyBackupManifest({ root, manifestPath }), manifest)
  const serialized = JSON.stringify(manifest)
  assert.doesNotMatch(serialized, /secret|private message|postgresql:\/\//i)

  await chmod(dumpPath, 0o644)
  await assert.rejects(() => verifyBackupManifest({ root, manifestPath }), /privado/i)
  await chmod(dumpPath, 0o600)
  await writeFile(dumpPath, 'database-backuX', { mode: 0o600 })
  await assert.rejects(() => verifyBackupManifest({ root, manifestPath }), /checksum/i)
})
