import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { relative, resolve } from 'node:path'

import { createLocalBackup, verifyLocalBackup } from './local-data-backup.mjs'
import { collectLocalDataStatus, createLocalDataDb } from './local-data-db.mjs'
import { collectRecoveryStatus, restoreLocalBackup, validateRestoreRequest } from './local-data-restore.mjs'
import { assertLoopbackDatabaseUrl, assertLoopbackHttpUrl, classifyKnownDemoRecords } from './local-data-safety.mjs'
import { parseSupabaseEnv } from './setup-local.mjs'

const exec = promisify(execFile)
const defaultRoot = fileURLToPath(new URL('../', import.meta.url))

async function defaultRun(command, args, options = {}) {
  return exec(command, args, {
    cwd: options.cwd ?? defaultRoot,
    env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: 'true', DO_NOT_TRACK: '1' },
    maxBuffer: 10 * 1024 * 1024,
  })
}

function readProjectId(config) {
  const projectId = config.match(/^\s*project_id\s*=\s*"([^"]+)"\s*$/m)?.[1]
  if (!projectId) throw new Error('No se pudo identificar el proyecto Supabase local.')
  return projectId
}

function isSupabasePostgresImage(image) {
  return typeof image === 'string' && (image.startsWith('supabase/postgres:') || image.includes('/supabase/postgres:'))
}

function normalizeHost(value) {
  return String(value).replace(/^\[|\]$/g, '').toLowerCase()
}

function publishedHostMatches(databaseHost, publishedHost) {
  const requested = normalizeHost(databaseHost)
  const published = normalizeHost(publishedHost)
  if (requested === '127.0.0.1') return published === '127.0.0.1' || published === '0.0.0.0'
  if (requested === '::1') return published === '::1' || published === '::'
  return false
}

export async function readSupabaseLocalContext({ run = defaultRun, root = defaultRoot } = {}) {
  const config = await readFile(resolve(root, 'supabase/config.toml'), 'utf8')
  const projectId = readProjectId(config)
  const statusResult = await run('npx', ['supabase', 'status', '-o', 'env'], { cwd: root })
  const values = parseSupabaseEnv(statusResult.stdout)
  if (!values.API_URL || !values.DB_URL || !values.SERVICE_ROLE_KEY) throw new Error('Supabase local no devolvió el contexto requerido.')
  assertLoopbackHttpUrl(values.API_URL)
  assertLoopbackDatabaseUrl(values.DB_URL)

  const containersResult = await run('docker', [
    'ps',
    '--filter', `label=com.supabase.cli.project=${projectId}`,
    '--format', '{{.ID}}\t{{.Image}}',
  ], { cwd: root })
  const containerId = String(containersResult.stdout)
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/))
    .find(([, image]) => isSupabasePostgresImage(image))?.[0]
  if (!containerId) throw new Error('No se encontró el contenedor PostgreSQL del Supabase local.')

  return { projectId, apiUrl: values.API_URL, dbUrl: values.DB_URL, containerId }
}

export function formatLocalDataStatus({ context, status }) {
  const candidates = classifyKnownDemoRecords(status.demoSnapshot)
  const lines = [
    `Proyecto local: ${context.projectId}`,
    `Migraciones aplicadas: ${status.migrations.length}`,
    'Recuentos:',
    ...status.tables.map((table) => `- ${table.schema}.${table.name}: ${table.count}`),
    `Candidatos de validación: ${candidates.length}`,
    ...candidates.map((candidate) => `- ${candidate.entity} ${candidate.id}: ${candidate.reason}`),
  ]
  return `${lines.join('\n')}\n`
}

export async function readRestoreTargetContext({ run = defaultRun, root = defaultRoot, environment = process.env } = {}) {
  const projectId = environment.LOCAL_RESTORE_PROJECT_ID
  const dbUrl = environment.LOCAL_RESTORE_DATABASE_URL
  if (!projectId || !/^[a-z0-9][a-z0-9_-]*$/i.test(projectId) || !dbUrl) throw new Error('Falta definir el destino local de recuperación.')
  const parsedDatabaseUrl = assertLoopbackDatabaseUrl(dbUrl)
  if (normalizeHost(parsedDatabaseUrl.hostname) === 'localhost') throw new Error('La restauración exige una dirección explícita: 127.0.0.1 o ::1.')
  if (parsedDatabaseUrl.pathname !== '/postgres') throw new Error('El destino debe ser la base postgres del contenedor local.')
  if (parsedDatabaseUrl.search || parsedDatabaseUrl.hash) throw new Error('La URL local de restauración no admite parámetros de conexión.')
  const containersResult = await run('docker', [
    'ps',
    '--filter', `label=com.supabase.cli.project=${projectId}`,
    '--format', '{{.ID}}\t{{.Image}}',
  ], { cwd: root })
  const containerId = String(containersResult.stdout)
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/))
    .find(([, image]) => isSupabasePostgresImage(image))?.[0]
  if (!containerId) throw new Error('No se encontró el contenedor PostgreSQL del destino local.')
  const inspectResult = await run('docker', [
    'inspect',
    '--format', '{{range $port := index .NetworkSettings.Ports "5432/tcp"}}{{$port.HostIp}} {{$port.HostPort}}{{"\\n"}}{{end}}',
    containerId,
  ], { cwd: root })
  const expectedPort = parsedDatabaseUrl.port || '5432'
  const publishedPorts = String(inspectResult.stdout)
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/))
    .filter(([, port]) => port)
  if (!publishedPorts.some(([host, port]) => port === expectedPort && publishedHostMatches(parsedDatabaseUrl.hostname, host))) {
    throw new Error('La URL del destino no corresponde a la dirección y puerto publicados por su contenedor.')
  }
  return { projectId, dbUrl, containerId }
}

export async function runLocalDataCli(argv = process.argv.slice(2), dependencies = {}) {
  const command = argv[0]
  if (!['status', 'backup', 'verify', 'restore'].includes(command)) throw new Error('Comando de datos no reconocido.')
  const root = dependencies.root ?? defaultRoot
  const run = dependencies.run ?? defaultRun
  const context = await readSupabaseLocalContext({ run, root })
  const backupRoot = resolve(root, 'storage/local-backups')

  if (command === 'verify') {
    if (!argv[1]) throw new Error('Indica la ruta del manifest.json que quieres verificar.')
    const manifestPath = resolve(root, argv[1])
    await verifyLocalBackup({ manifestPath, backupRoot, run, context })
    return `Copia local válida: ${relative(root, manifestPath)}\n`
  }

  if (command === 'restore') {
    if (!argv[1]) throw new Error('Indica la ruta del manifest.json que quieres restaurar.')
    const manifestPath = resolve(root, argv[1])
    const manifest = await verifyLocalBackup({ manifestPath, backupRoot, run, context })
    const targetContext = await readRestoreTargetContext({ run, root, environment: dependencies.environment })
    const targetDb = dependencies.targetDb ?? createLocalDataDb(targetContext.dbUrl)
    await targetDb.connect?.()
    try {
      const targetStatus = await collectLocalDataStatus({ db: targetDb })
      validateRestoreRequest({ source: context, target: targetContext, manifest, confirmation: argv[2], targetStatus })
      await restoreLocalBackup({
        manifestPath,
        backupRoot,
        targetContext,
        run,
        readTargetStatus: () => collectRecoveryStatus({ db: targetDb }),
      })
      return `Copia restaurada en el destino local desechable: ${targetContext.projectId}\n`
    } finally {
      await targetDb.close?.()
    }
  }

  const db = dependencies.db ?? createLocalDataDb(context.dbUrl)
  await db.connect?.()
  try {
    const readStatus = () => collectLocalDataStatus({ db })
    const status = await readStatus()
    if (command === 'status') return formatLocalDataStatus({ context, status })
    const result = await createLocalBackup({ context, status, backupRoot, run, readStatus })
    return `Copia local creada: ${relative(root, result.manifestPath)}\n`
  } finally {
    await db.close?.()
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runLocalDataCli()
    .then((output) => process.stdout.write(output))
    .catch(() => {
      console.error('No se pudo ejecutar la operación segura de datos locales.')
      process.exitCode = 1
    })
}
