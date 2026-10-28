import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { resolve } from 'node:path'

import { collectLocalDataStatus, createLocalDataDb } from './local-data-db.mjs'
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
    .find(([, image]) => image?.startsWith('supabase/postgres:'))?.[0]
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

export async function runLocalDataCli(argv = process.argv.slice(2), dependencies = {}) {
  const command = argv[0]
  if (command !== 'status') throw new Error('Comando de datos no reconocido.')
  const context = await readSupabaseLocalContext({ run: dependencies.run, root: dependencies.root })
  const db = dependencies.db ?? createLocalDataDb(context.dbUrl)
  await db.connect?.()
  try {
    const status = await collectLocalDataStatus({ db })
    return formatLocalDataStatus({ context, status })
  } finally {
    await db.close?.()
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runLocalDataCli()
    .then((output) => process.stdout.write(output))
    .catch(() => {
      console.error('No se pudo leer el estado seguro de los datos locales.')
      process.exitCode = 1
    })
}
