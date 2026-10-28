import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile, realpath, stat } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path'

const loopbackHosts = new Set(['localhost', '127.0.0.1', '::1'])

function parseLocalUrl(value, protocols) {
  let parsed
  try {
    parsed = new URL(String(value))
  } catch {
    throw new Error('La URL local no es válida.')
  }
  const hostname = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (!protocols.has(parsed.protocol) || !loopbackHosts.has(hostname)) {
    throw new Error('El destino debe ser una URL local de loopback.')
  }
  return parsed
}

export function assertLoopbackHttpUrl(value) {
  return parseLocalUrl(value, new Set(['http:', 'https:']))
}

export function assertLoopbackDatabaseUrl(value) {
  return parseLocalUrl(value, new Set(['postgres:', 'postgresql:']))
}

export async function resolveConfinedBackupPath(root, candidate) {
  const rootPath = await realpath(root)
  const requested = resolve(rootPath, candidate)
  let resolvedPath
  try {
    resolvedPath = await realpath(requested)
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
    const parentPath = await realpath(dirname(requested))
    resolvedPath = join(parentPath, basename(requested))
  }
  const child = relative(rootPath, resolvedPath)
  if (child === '..' || child.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) || isAbsolute(child)) {
    throw new Error('La ruta queda fuera del directorio privado de copias.')
  }
  return resolvedPath
}

export function classifyKnownDemoRecords(snapshot) {
  const candidates = []
  for (const client of snapshot.clients ?? []) {
    if (client.email?.trim().toLowerCase() === 'cliente.demo@local.test') {
      candidates.push({ entity: 'client', id: client.id, reason: 'cliente de validación local' })
    }
  }
  for (const document of snapshot.billingDocuments ?? []) {
    if (document.document_type === 'proposal' && document.recipient_email?.trim().toLowerCase() === 'prueba@local.test') {
      candidates.push({ entity: 'billing_document', id: document.id, reason: 'propuesta de validación local' })
    }
  }
  for (const expense of snapshot.expenses ?? []) {
    if (expense.supplier === 'Prueba local WF-Panel' && expense.concept?.toLowerCase().includes('prueba local')) {
      candidates.push({ entity: 'expense', id: expense.id, reason: 'gasto de validación local' })
    }
  }
  return candidates
}

export async function sha256File(path) {
  const hash = createHash('sha256')
  await new Promise((resolvePromise, reject) => {
    const stream = createReadStream(path)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', resolvePromise)
    stream.on('error', reject)
  })
  return hash.digest('hex')
}

export function createBackupManifest({ createdAt, projectId, migrationVersions, tables, dump }) {
  return {
    format: 'wf-panel-local-backup',
    version: 1,
    createdAt,
    projectId,
    migrationVersions: [...migrationVersions].sort(),
    tables: [...tables]
      .map(({ schema, name, count }) => ({ schema, name, count }))
      .sort((left, right) => `${left.schema}.${left.name}`.localeCompare(`${right.schema}.${right.name}`)),
    dump: {
      file: dump.file,
      size: dump.size,
      sha256: dump.sha256,
    },
  }
}

function assertManifestShape(manifest) {
  if (manifest?.format !== 'wf-panel-local-backup' || manifest.version !== 1) throw new Error('El manifiesto no es compatible.')
  if (!Number.isFinite(Date.parse(manifest.createdAt)) || typeof manifest.projectId !== 'string' || !manifest.projectId) throw new Error('El manifiesto no es válido.')
  if (!Array.isArray(manifest.migrationVersions) || !manifest.migrationVersions.every((value) => typeof value === 'string')) throw new Error('El historial de migraciones no es válido.')
  if (!Array.isArray(manifest.tables) || !manifest.tables.every((table) => typeof table?.schema === 'string' && typeof table?.name === 'string' && Number.isSafeInteger(table?.count) && table.count >= 0)) throw new Error('El contrato de tablas no es válido.')
  if (typeof manifest.dump?.file !== 'string' || isAbsolute(manifest.dump.file) || typeof manifest.dump?.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(manifest.dump.sha256) || !Number.isSafeInteger(manifest.dump?.size) || manifest.dump.size < 0) throw new Error('La referencia del volcado no es válida.')
}

function assertPrivateFile(file, metadata) {
  if ((metadata.mode & 0o077) !== 0) throw new Error(`El archivo ${file} debe ser privado (0600).`)
}

export async function verifyBackupManifest({ root, manifestPath }) {
  const safeManifestPath = await resolveConfinedBackupPath(root, manifestPath)
  const manifestMetadata = await stat(safeManifestPath)
  assertPrivateFile('manifest.json', manifestMetadata)
  const manifest = JSON.parse(await readFile(safeManifestPath, 'utf8'))
  assertManifestShape(manifest)

  const dumpPath = await resolveConfinedBackupPath(root, join(dirname(safeManifestPath), manifest.dump.file))
  const dumpMetadata = await stat(dumpPath)
  assertPrivateFile(manifest.dump.file, dumpMetadata)
  if (dumpMetadata.size !== manifest.dump.size) throw new Error('El tamaño del volcado no coincide con el manifiesto.')
  if (await sha256File(dumpPath) !== manifest.dump.sha256) throw new Error('El checksum del volcado no coincide con el manifiesto.')
  return manifest
}
