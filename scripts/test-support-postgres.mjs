import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { mkdtemp, cp, mkdir, rm, open, readFile, readdir, unlink, writeFile } from 'node:fs/promises'
import { createHash, randomUUID } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const root = fileURLToPath(new URL('../', import.meta.url))
const env = { ...process.env, SUPABASE_TELEMETRY_DISABLED: 'true', DO_NOT_TRACK: '1' }
const project = 'wf-studio-support-test'
const projectLabel = 'com.supabase.cli.project'
const ownerLabel = 'wf.studio.support-test.owner'
const postgresImage = 'postgres:17.6-alpine'
const owner = randomUUID()
const databasePassword = randomUUID()
let workspace, containerId, lock, lockPath

function run(command, args, { capture = false, extraEnv = {}, cwd = workspace, safeArgs = args, input } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env: { ...env, ...extraEnv }, stdio: capture ? [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'] : ['ignore', 'inherit', 'inherit'] })
    let output = ''
    let errorOutput = ''
    if (input !== undefined) child.stdin.end(input)
    if (capture) child.stdout.on('data', chunk => { output += chunk })
    if (capture) child.stderr.on('data', chunk => { errorOutput += chunk })
    child.on('error', () => reject(new Error('Unable to run local database test command')))
    child.on('close', code => {
      if (code === 0) return resolve(output)
      const diagnostic = errorOutput
        .replaceAll(databasePassword, '[redacted]')
        .replace(/POSTGRES_PASSWORD=\S+/g, 'POSTGRES_PASSWORD=[redacted]')
        .replace(/postgres(?:ql)?:\/\/\S+/gi, 'postgresql://[redacted]')
        .replace(/private-credential(?:-sentinel)?|leaksecret/gi, '[redacted]')
        .trim()
      const suffix = diagnostic ? `: ${diagnostic.slice(0, 500)}` : ''
      reject(new Error(`Local database test command failed: ${safeArgs.join(' ')} (exit ${code})${suffix}`))
    })
  })
}

const docker = (args, safeArgs = args) => run('docker', args, { capture: true, cwd: root, safeArgs })

async function waitForDatabase() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      await docker(['container', 'exec', containerId, 'pg_isready', '-U', 'supabase_admin', '-h', '127.0.0.1'], ['container', 'status'])
      return
    } catch {
      if (attempt === 59) throw new Error('Local database did not become ready')
      await delay(250)
    }
  }
}

try {
  const daemon = (await docker(['info', '--format', '{{.ID}}'])).trim()
  if (!daemon) throw new Error('Local Docker daemon identity unavailable')
  const key = createHash('sha256').update(daemon).digest('hex').slice(0, 24)
  lockPath = join(process.platform === 'win32' ? tmpdir() : '/tmp', `${project}-${key}.runner.lock`)
  try { lock = await open(lockPath, 'wx', 0o600) }
  catch (error) {
    if (error.code === 'EEXIST') throw new Error('Support runner lock already held; refusing concurrent run')
    throw new Error('Unable to acquire support runner lock')
  }
  await lock.writeFile(owner)

  workspace = await mkdtemp(join(tmpdir(), 'wf-studio-support-test-'))
  await mkdir(join(workspace, 'supabase'))
  await cp(new URL('../supabase/config.toml', import.meta.url), join(workspace, 'supabase/config.toml'))
  // Preserve applied history byte-for-byte; replay prerequisites exist only in
  // this disposable workspace and are never written to production migrations.
  await cp(new URL('../supabase/migrations/', import.meta.url), join(workspace, 'supabase/migrations'), { recursive: true })
  await cp(new URL('../tests/fixtures/support-postgres/', import.meta.url), join(workspace, 'supabase/migrations'), { recursive: true })

  const cidPath = join(workspace, 'postgres.cid')
  const labels = ['--label', `${projectLabel}=${project}`, '--label', `${ownerLabel}=${owner}`]
  try {
    await docker([
      'container', 'run', '--detach', '--rm', '--cidfile', cidPath,
      ...labels,
      '--tmpfs', '/var/lib/postgresql/data:rw,exec',
      '--publish', '127.0.0.1::5432',
      '--env', `POSTGRES_PASSWORD=${databasePassword}`,
      '--env', 'POSTGRES_DB=postgres',
      postgresImage,
    ], ['container', 'start'])
  } finally {
    try {
      const candidate = (await readFile(cidPath, 'utf8')).trim()
      if (/^[a-f0-9]{64}$/.test(candidate)) containerId = candidate
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
  }
  if (!containerId) throw new Error('Local database container identity unavailable')

  await waitForDatabase()
  await docker([
    'container', 'exec', '--env', `PGPASSWORD=${databasePassword}`, containerId,
    'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1',
    '-c', `create role supabase_admin with login superuser password '${databasePassword}'`,
  ], ['container', 'bootstrap'])
  const portOutput = await docker(['container', 'port', containerId, '5432/tcp'], ['container', 'status'])
  const port = portOutput.trim().match(/127\.0\.0\.1:(\d+)$/)?.[1]
  if (!port) throw new Error('Local database port unavailable')
  const databaseUrl = `postgresql://supabase_admin:${encodeURIComponent(databasePassword)}@127.0.0.1:${port}/postgres?sslmode=disable`

  const migrationFiles = (await readdir(join(workspace, 'supabase/migrations')))
    .filter(file => file.endsWith('.sql'))
    .sort()
  const migrationSql = (await Promise.all(migrationFiles.map(file => readFile(join(workspace, 'supabase/migrations', file), 'utf8')))).join('\n\n')
  const migrationPath = join(workspace, 'support-test-migrations.sql')
  await writeFile(migrationPath, migrationSql)
  await docker(['cp', migrationPath, `${containerId}:/tmp/support-test-migrations.sql`], ['copy', 'migrations'])
  await run('docker', [
    'container', 'exec', '--env', `PGPASSWORD=${databasePassword}`, containerId,
    'psql', '-U', 'supabase_admin', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1',
    '-c', "set statement_timeout = '30s'; set lock_timeout = '5s'",
    '-f', '/tmp/support-test-migrations.sql',
  ], {
    capture: true,
    safeArgs: ['container', 'migrate'],
  })
  await run(process.execPath, ['--test', 'tests/support-session-postgres.test.mjs'], { cwd: root, extraEnv: { WF_SUPPORT_TEST_DATABASE_URL: databaseUrl } })
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Local database tests failed')
  process.exitCode = 1
} finally {
  if (containerId) {
    try { await docker(['container', 'rm', '--force', containerId]) }
    catch { console.error('Unable to remove owned support container'); process.exitCode = 1 }
  }
  if (workspace) await rm(workspace, { recursive: true, force: true })
  if (lock) {
    try {
      if (await readFile(lockPath, 'utf8') === owner) await unlink(lockPath)
    } finally { await lock.close() }
  }
}
