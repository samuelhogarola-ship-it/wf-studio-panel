import { randomUUID } from 'node:crypto'
import { dirname, join } from 'node:path'

import { collectLocalDataStatus } from './local-data-db.mjs'
import { verifyContainerDumpIntegrity } from './local-data-backup.mjs'
import { assertLoopbackDatabaseUrl, resolveConfinedBackupPath, verifyBackupManifest } from './local-data-safety.mjs'

function databaseIdentity(databaseUrl) {
  const parsed = assertLoopbackDatabaseUrl(databaseUrl)
  return `${parsed.hostname.toLowerCase()}:${parsed.port || '5432'}${parsed.pathname}`
}

function migrationContract(versions) {
  return JSON.stringify(versions ?? [])
}

function tableNames(tables) {
  return [...(tables ?? [])].map(({ schema, name }) => `${schema}.${name}`).sort()
}

function tableContract(tables) {
  return [...(tables ?? [])]
    .map(({ schema, name, count }) => ({ schema, name, count }))
    .sort((left, right) => `${left.schema}.${left.name}`.localeCompare(`${right.schema}.${right.name}`))
}

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`
}

export function validateRestoreRequest({ source, target, manifest, confirmation, targetStatus }) {
  if (confirmation !== '--confirm-local-restore') throw new Error('La confirmación exacta de restauración local es obligatoria.')
  const sourceDatabase = databaseIdentity(source.dbUrl)
  const targetDatabase = databaseIdentity(target.dbUrl)
  if (source.projectId === target.projectId || sourceDatabase === targetDatabase || (source.containerId && source.containerId === target.containerId)) throw new Error('El destino de recuperación debe ser distinto del origen activo.')
  if (manifest.projectId !== source.projectId) throw new Error('La copia no pertenece al proyecto de origen activo.')
  if (migrationContract(manifest.migrationVersions) !== migrationContract(targetStatus.migrations)) throw new Error('El historial de migraciones del destino no coincide exactamente.')
  if (JSON.stringify(tableNames(manifest.tables)) !== JSON.stringify(tableNames(targetStatus.tables))) throw new Error('El conjunto de tablas del destino no coincide con la copia.')
  if (targetStatus.tables.some((table) => table.count !== 0)) throw new Error('El destino debe estar vacío antes de restaurar.')
  return true
}

export function assertRestoredState({ manifest, status }) {
  if (migrationContract(manifest.migrationVersions) !== migrationContract(status.migrations)) throw new Error('Las migraciones restauradas no coinciden.')
  if (JSON.stringify(tableContract(manifest.tables)) !== JSON.stringify(tableContract(status.tables))) throw new Error('Los recuentos restaurados no coinciden con el manifiesto.')
  if (status.invariants?.proposalsWithPaymentLinks !== 0) throw new Error('Se encontró una propuesta con enlace de pago.')
  if (status.invariants?.immutableDocumentTypeTrigger !== true) throw new Error('No está instalada la protección inmutable del tipo documental.')
  if (status.invariants?.numberingFunctions !== 2) throw new Error('No están disponibles las dos funciones de numeración.')
  return true
}

export async function collectRecoveryStatus({ db }) {
  const status = await collectLocalDataStatus({ db })
  const [proposalLinks, immutableTrigger, numberingFunctions] = await Promise.all([
    db.query(`
      select count(*)::text as count
      from public.payment_links links
      join public.invoices documents on documents.id = links.invoice_id
      where documents.document_type = 'proposal'
    `),
    db.query(`
      select count(*)::text as count
      from pg_trigger
      where tgname = 'invoices_document_type_immutable' and not tgisinternal
    `),
    db.query(`
      select count(*)::text as count
      from pg_proc procedures
      join pg_namespace namespaces on namespaces.oid = procedures.pronamespace
      where namespaces.nspname = 'public'
        and procedures.proname in ('next_invoice_number', 'next_proposal_number')
    `),
  ])
  return {
    ...status,
    invariants: {
      proposalsWithPaymentLinks: Number(proposalLinks.rows[0]?.count ?? -1),
      immutableDocumentTypeTrigger: Number(immutableTrigger.rows[0]?.count ?? 0) === 1,
      numberingFunctions: Number(numberingFunctions.rows[0]?.count ?? 0),
    },
  }
}

export async function emptyDisposableTarget({ db, status }) {
  const tables = tableNames(status.tables)
  if (tables.length === 0) throw new Error('El destino desechable no expone tablas para vaciar.')
  const qualifiedTables = status.tables
    .map(({ schema, name }) => `${quoteIdentifier(schema)}.${quoteIdentifier(name)}`)
    .join(', ')
  await db.query('begin')
  try {
    await db.query('set local session_replication_role = replica')
    await db.query(`truncate table ${qualifiedTables} cascade`)
    await db.query('commit')
  } catch (error) {
    await db.query('rollback').catch(() => {})
    throw error
  }
}

export async function restoreLocalBackup({ manifestPath, targetContext, run, backupRoot = dirname(dirname(manifestPath)), readTargetStatus }) {
  assertLoopbackDatabaseUrl(targetContext.dbUrl)
  const manifest = await verifyBackupManifest({ root: backupRoot, manifestPath })
  const dumpPath = await resolveConfinedBackupPath(backupRoot, join(dirname(manifestPath), manifest.dump.file))
  const containerDumpPath = `/tmp/wf-panel-restore-${randomUUID()}.dump`
  try {
    await run('docker', ['cp', dumpPath, `${targetContext.containerId}:${containerDumpPath}`])
    await verifyContainerDumpIntegrity({ run, containerId: targetContext.containerId, containerDumpPath, manifest })
    await run('docker', [
      'exec', targetContext.containerId,
      'pg_restore', '--data-only', '--exit-on-error', '--single-transaction', '--disable-triggers', '--no-owner', '--no-privileges',
      '-U', 'supabase_admin', '-d', 'postgres', containerDumpPath,
    ])
  } finally {
    await run('docker', ['exec', targetContext.containerId, 'rm', '-f', containerDumpPath]).catch(() => {})
  }
  if (readTargetStatus) assertRestoredState({ manifest, status: await readTargetStatus() })
  return manifest
}
