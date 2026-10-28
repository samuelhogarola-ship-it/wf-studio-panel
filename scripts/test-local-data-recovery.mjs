import { execFile } from 'node:child_process'
import { cp, mkdir, mkdtemp, open, readFile, rm, unlink, writeFile } from 'node:fs/promises'
import net from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import { createLocalBackup } from './local-data-backup.mjs'
import { collectLocalDataStatus, createLocalDataDb } from './local-data-db.mjs'
import { readSupabaseLocalContext } from './local-data-cli.mjs'
import { collectRecoveryStatus, emptyDisposableTarget, restoreLocalBackup, validateRestoreRequest } from './local-data-restore.mjs'
import { verifyBackupManifest } from './local-data-safety.mjs'

const exec = promisify(execFile)
const defaultRoot = fileURLToPath(new URL('../', import.meta.url))

async function defaultRun(command, args, options = {}) {
  return exec(command, args, {
    cwd: options.cwd ?? defaultRoot,
    env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: 'true', DO_NOT_TRACK: '1' },
    maxBuffer: 10 * 1024 * 1024,
  })
}

function replaceConfigValue(config, section, key, value) {
  const pattern = new RegExp(`(\\[${section}\\][\\s\\S]*?^${key}\\s*=\\s*)[^\\r\\n]+`, 'm')
  if (!pattern.test(config)) throw new Error(`Falta ${section}.${key} en la configuración local.`)
  return config.replace(pattern, `$1${value}`)
}

export function buildRecoveryConfig(sourceConfig, { projectId, apiPort, databasePort, shadowPort }) {
  let config = sourceConfig.replace(/^\s*project_id\s*=\s*"[^"]+"\s*$/m, `project_id = "${projectId}"`)
  config = replaceConfigValue(config, 'api', 'port', apiPort)
  config = replaceConfigValue(config, 'db', 'port', databasePort)
  return replaceConfigValue(config, 'db', 'shadow_port', shadowPort)
}

export async function withRecoveryDrillLock(lockPath, operation) {
  await mkdir(dirname(lockPath), { recursive: true, mode: 0o700 })
  let handle
  try {
    handle = await open(lockPath, 'wx', 0o600)
  } catch (error) {
    if (error?.code === 'EEXIST') throw new Error('Ya hay un ensayo de recuperación en curso.')
    throw error
  }
  try {
    return await operation()
  } finally {
    await handle.close()
    await unlink(lockPath).catch(() => {})
  }
}

export async function withDisposableSupabase({ workspace, run = defaultRun }, operation) {
  await run('npx', ['supabase', 'start', '--workdir', workspace], { cwd: workspace })
  try {
    return await operation()
  } finally {
    await run('npx', ['supabase', 'stop', '--workdir', workspace, '--no-backup'], { cwd: workspace }).catch(() => {})
  }
}

async function reserveLoopbackPort() {
  const server = net.createServer()
  await new Promise((resolvePromise, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolvePromise)
  })
  const port = server.address().port
  await new Promise((resolvePromise, reject) => server.close((error) => error ? reject(error) : resolvePromise()))
  return port
}

async function allocateRecoveryPorts() {
  const ports = new Set()
  while (ports.size < 3) ports.add(await reserveLoopbackPort())
  const [apiPort, databasePort, shadowPort] = ports
  return { apiPort, databasePort, shadowPort }
}

export async function runRecoveryDrill({ root = defaultRoot, run = defaultRun, now = () => new Date() } = {}) {
  const lockPath = resolve(root, 'storage/.local-data-recovery.lock')
  return withRecoveryDrillLock(lockPath, async () => {
    const sourceContext = await readSupabaseLocalContext({ run, root })
    const sourceDb = createLocalDataDb(sourceContext.dbUrl)
    await sourceDb.connect()
    let workspace
    try {
      const readSourceStatus = () => collectLocalDataStatus({ db: sourceDb })
      const sourceStatus = await readSourceStatus()
      const backupRoot = resolve(root, 'storage/local-backups')
      const backup = await createLocalBackup({ context: sourceContext, status: sourceStatus, backupRoot, run, now, readStatus: readSourceStatus })
      const backupManifest = await verifyBackupManifest({ root: backupRoot, manifestPath: backup.manifestPath })

      workspace = await mkdtemp(join(tmpdir(), 'wf-panel-recovery-'))
      await mkdir(join(workspace, 'supabase'), { mode: 0o700 })
      await cp(resolve(root, 'supabase/migrations'), join(workspace, 'supabase/migrations'), { recursive: true })
      const sourceConfig = await readFile(resolve(root, 'supabase/config.toml'), 'utf8')
      const ports = await allocateRecoveryPorts()
      const projectId = `wf-recovery-${process.pid}-${Date.now()}`
      await writeFile(join(workspace, 'supabase/config.toml'), buildRecoveryConfig(sourceConfig, { projectId, ...ports }), { mode: 0o600 })

      return await withDisposableSupabase({ workspace, run }, async () => {
        const targetContext = await readSupabaseLocalContext({ run, root: workspace })
        const targetDb = createLocalDataDb(targetContext.dbUrl)
        await targetDb.connect()
        try {
          const initialTargetStatus = await collectLocalDataStatus({ db: targetDb })
          await emptyDisposableTarget({ db: targetDb, status: initialTargetStatus })
          const targetStatus = await collectLocalDataStatus({ db: targetDb })
          validateRestoreRequest({
            source: sourceContext,
            target: targetContext,
            manifest: backupManifest,
            confirmation: '--confirm-local-restore',
            targetStatus,
          })
          await restoreLocalBackup({
            manifestPath: backup.manifestPath,
            backupRoot,
            targetContext,
            run,
            readTargetStatus: () => collectRecoveryStatus({ db: targetDb }),
          })
          return { manifestPath: backup.manifestPath, projectId: targetContext.projectId }
        } finally {
          await targetDb.close()
        }
      })
    } finally {
      await sourceDb.close()
      if (workspace) await rm(workspace, { recursive: true, force: true })
    }
  })
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runRecoveryDrill()
    .then((result) => process.stdout.write(`Ensayo de recuperación correcto: ${result.projectId}\n`))
    .catch(() => {
      console.error('El ensayo local de recuperación no se completó.')
      process.exitCode = 1
    })
}
