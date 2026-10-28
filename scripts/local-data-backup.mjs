import { randomUUID } from 'node:crypto'
import { chmod, mkdir, rename, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import { createBackupManifest, resolveConfinedBackupPath, sha256File, verifyBackupManifest } from './local-data-safety.mjs'

function sameDataContract(left, right) {
  return JSON.stringify({ migrations: left.migrations, tables: left.tables }) === JSON.stringify({ migrations: right.migrations, tables: right.tables })
}

export async function createLocalBackup({ context, status, backupRoot, run, now = () => new Date(), readStatus = async () => status }) {
  await mkdir(backupRoot, { recursive: true, mode: 0o700 })
  await chmod(backupRoot, 0o700)
  const folderName = now().toISOString().replaceAll(':', '-').replaceAll('.', '-')
  const backupDirectory = join(backupRoot, folderName)
  await mkdir(backupDirectory, { mode: 0o700 })

  const dumpPath = join(backupDirectory, 'wf-panel.dump')
  const manifestPath = join(backupDirectory, 'manifest.json')
  const containerDumpPath = `/tmp/wf-panel-backup-${randomUUID()}.dump`
  try {
    await run('docker', [
      'exec', context.containerId,
      'pg_dump', '-U', 'postgres', '-d', 'postgres',
      '--format=custom', '--data-only', '--no-owner', '--no-privileges', '--no-blobs',
      '--table=public.*', '--table=auth.users', '--table=auth.identities',
      `--file=${containerDumpPath}`,
    ])
    await run('docker', ['cp', `${context.containerId}:${containerDumpPath}`, dumpPath])
  } finally {
    await run('docker', ['exec', context.containerId, 'rm', '-f', containerDumpPath]).catch(() => {})
  }
  await chmod(dumpPath, 0o600)

  const statusAfter = await readStatus()
  if (!sameDataContract(status, statusAfter)) throw new Error('Los datos cambiaron durante la copia; vuelve a intentarlo.')
  const dumpMetadata = await stat(dumpPath)
  const manifest = createBackupManifest({
    createdAt: now().toISOString(),
    projectId: context.projectId,
    migrationVersions: status.migrations,
    tables: status.tables,
    dump: {
      file: 'wf-panel.dump',
      size: dumpMetadata.size,
      sha256: await sha256File(dumpPath),
    },
  })
  const temporaryManifest = `${manifestPath}.tmp-${randomUUID()}`
  await writeFile(temporaryManifest, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600, flag: 'wx' })
  await rename(temporaryManifest, manifestPath)
  await chmod(manifestPath, 0o600)
  return { manifestPath, dumpPath }
}

export async function verifyContainerDumpIntegrity({ run, containerId, containerDumpPath, manifest }) {
  const sizeResult = await run('docker', ['exec', containerId, 'stat', '-c', '%s', containerDumpPath])
  const copiedSize = Number(String(sizeResult.stdout).trim())
  if (!Number.isSafeInteger(copiedSize) || copiedSize !== manifest.dump.size) {
    throw new Error('El tamaño del volcado copiado no coincide con el manifiesto.')
  }
  const checksumResult = await run('docker', ['exec', containerId, 'sha256sum', containerDumpPath])
  const copiedChecksum = String(checksumResult.stdout).trim().split(/\s+/)[0]?.toLowerCase()
  if (copiedChecksum !== manifest.dump.sha256) throw new Error('El checksum del volcado copiado no coincide con el manifiesto.')
}

export async function verifyLocalBackup({ manifestPath, backupRoot, run, context }) {
  const manifest = await verifyBackupManifest({ root: backupRoot, manifestPath })
  const dumpPath = await resolveConfinedBackupPath(backupRoot, join(dirname(manifestPath), manifest.dump.file))
  const containerDumpPath = `/tmp/wf-panel-verify-${randomUUID()}.dump`
  try {
    await run('docker', ['cp', dumpPath, `${context.containerId}:${containerDumpPath}`])
    await verifyContainerDumpIntegrity({ run, containerId: context.containerId, containerDumpPath, manifest })
    await run('docker', ['exec', context.containerId, 'pg_restore', '--list', containerDumpPath])
  } finally {
    await run('docker', ['exec', context.containerId, 'rm', '-f', containerDumpPath]).catch(() => {})
  }
  return manifest
}
