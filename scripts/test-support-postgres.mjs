import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { mkdtemp, cp, mkdir, rm, open, readFile, unlink } from 'node:fs/promises'
import { createHash, randomUUID } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const cli = fileURLToPath(new URL('../node_modules/.bin/supabase', import.meta.url))
const env = { ...process.env, SUPABASE_TELEMETRY_DISABLED: 'true', DO_NOT_TRACK: '1' }
let workspace
const project = 'wf-studio-support-test'
const projectLabel = 'com.supabase.cli.project'
const ownerLabel = 'wf.studio.support-test.owner'
const owner = randomUUID()
let lock, lockPath, networkId
let databaseVolume
let canClaimDatabaseVolume = false
let claimedResources = false

function run(command, args, { capture = false, extraEnv = {}, cwd = workspace } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env: { ...env, ...extraEnv }, stdio: capture ? ['ignore', 'pipe', 'pipe'] : ['ignore', 'inherit', 'inherit'] })
    let output = ''
    if (capture) child.stdout.on('data', chunk => { output += chunk })
    // Captured CLI status can contain credentials; never relay its output/errors.
    if (capture) child.stderr.resume()
    child.on('error', () => reject(new Error('Unable to run local database test command')))
    child.on('close', code => code === 0 ? resolve(output) : reject(new Error(`Local database test command failed: ${args.join(' ')} (exit ${code})`)))
  })
}

const lines = output => output.trim().split('\n').filter(Boolean)
const docker = args => run('docker', args, { capture: true, cwd: root })

async function resources(kind) {
  const format = kind === 'volume' ? '{{.Name}}' : '{{.ID}} {{.Names}}'
  const listArgs = kind === 'container' ? ['--all', '--no-trunc'] : kind === 'network' ? ['--no-trunc'] : []
  const [all, labeled] = await Promise.all([
    docker([kind, 'ls', ...listArgs, '--format', kind === 'network' ? '{{.ID}} {{.Name}}' : format]),
    docker([kind, 'ls', ...listArgs, '--filter', `label=${projectLabel}=${project}`, '--format', kind === 'volume' ? '{{.Name}}' : '{{.ID}}']),
  ])
  const names = lines(all).filter(line => line.split(' ').at(-1).endsWith(`_${project}`)).map(line => line.split(' ')[0])
  const ids = [...new Set([...names, ...lines(labeled).map(line => line.split(' ')[0])])]
  if (!ids.length) return []
  const output = await docker([kind, 'inspect', ...ids])
  try { return JSON.parse(output) }
  catch { throw new Error('Invalid local Docker resource response') }
}

async function inventory() {
  const [containers, volumes, networks] = await Promise.all(['container', 'volume', 'network'].map(resources))
  // Preflight found no project resources. The CLI must create the DB volume
  // itself, otherwise it selects backup startup and skips fresh initialization.
  // Claim it once, only through the DB container on this invocation's network.
  const db = containers.find(container => container.Name === `/supabase_db_${project}` && ownsContainer(container))
  const mounted = db?.Mounts?.some(mount => mount.Type === 'volume' && mount.Name === `supabase_db_${project}`)
  const volume = volumes.find(item => item.Name === `supabase_db_${project}`)
  if (canClaimDatabaseVolume && !databaseVolume && mounted && volume?.Labels?.[projectLabel] === project && typeof volume.CreatedAt === 'string') {
    databaseVolume = { name: volume.Name, createdAt: volume.CreatedAt }
    canClaimDatabaseVolume = false
  }
  return { containers, volumes, networks }
}

function ownsContainer(container) {
  return Boolean(networkId) && container.Config?.Labels?.[projectLabel] === project &&
    Object.values(container.NetworkSettings?.Networks ?? {}).some(network => network.NetworkID === networkId)
}

function ownsVolume(volume) {
  return volume.Labels?.[ownerLabel] === owner ||
    (databaseVolume && volume.Name === databaseVolume.name && volume.CreatedAt === databaseVolume.createdAt && volume.Labels?.[projectLabel] === project)
}

function sameVolumeIdentity(expected, current) {
  return expected.Name === current.Name && typeof expected.CreatedAt === 'string' &&
    expected.CreatedAt === current.CreatedAt && ownsVolume(current)
}

function allOwned(state) {
  return state.containers.every(ownsContainer) &&
    state.volumes.every(ownsVolume) && state.networks.every(resource => resource.Labels?.[ownerLabel] === owner)
}

async function requireOwnedStack() {
  const state = await inventory()
  if (!allOwned(state) || !state.containers.some(container => container.Name === `/supabase_db_${project}`)) {
    throw new Error('Support stack ownership check failed')
  }
}

async function cleanupOwnedResources(state) {
  // Immutable container/network IDs prevent a replacement resource becoming a
  // deletion target. Volumes require our label or the recorded DB-volume
  // identity and are never forced; a replacement volume is not adopted.
  let succeeded = true
  for (const container of state.containers.filter(ownsContainer)) {
    try { await docker(['container', 'rm', '--force', container.Id]) }
    catch { console.error('Unable to remove owned support container'); succeeded = false }
  }
  for (const volume of state.volumes.filter(ownsVolume)) {
    try {
      const current = JSON.parse(await docker(['volume', 'inspect', volume.Name]))?.[0]
      if (!current || !sameVolumeIdentity(volume, current)) {
        console.error('Support volume changed during cleanup; preserving current volume')
        succeeded = false
        continue
      }
      await docker(['volume', 'rm', volume.Name])
    } catch { console.error('Unable to remove owned support volume'); succeeded = false }
  }
  for (const network of state.networks.filter(resource => resource.Labels?.[ownerLabel] === owner)) {
    try { await docker(['network', 'rm', network.Id]) }
    catch { console.error('Unable to remove owned support network'); succeeded = false }
  }
  return succeeded
}

try {
  const daemon = (await docker(['info', '--format', '{{.ID}}'])).trim()
  if (!daemon) throw new Error('Local Docker daemon identity unavailable')
  const key = createHash('sha256').update(daemon).digest('hex').slice(0, 24)
  // Shared across checkouts and TMPDIR settings on the macOS/Linux Docker host.
  lockPath = join(process.platform === 'win32' ? tmpdir() : '/tmp', `${project}-${key}.runner.lock`)
  try { lock = await open(lockPath, 'wx', 0o600) }
  catch (error) {
    if (error.code === 'EEXIST') throw new Error('Support runner lock already held; refusing concurrent run')
    throw new Error('Unable to acquire support runner lock')
  }
  await lock.writeFile(owner)
  const existing = await inventory()
  if (Object.values(existing).some(items => items.length)) throw new Error('Pre-existing support test resources detected; refusing to start')
  workspace = await mkdtemp(join(tmpdir(), 'wf-studio-support-test-'))
  await mkdir(join(workspace, 'supabase'))
  await cp(new URL('../supabase/config.toml', import.meta.url), join(workspace, 'supabase/config.toml'))
  // Preserve every applied migration byte-for-byte. Bootstrap prerequisites live
  // only in this disposable workspace, never in production migration history.
  await cp(new URL('../supabase/migrations/', import.meta.url), join(workspace, 'supabase/migrations'), { recursive: true })
  await cp(new URL('../tests/fixtures/support-postgres/', import.meta.url), join(workspace, 'supabase/migrations'), { recursive: true })
  const labels = ['--label', `${projectLabel}=${project}`, '--label', `${ownerLabel}=${owner}`]
  claimedResources = true
  const networkName = `${project}-${owner}`
  networkId = (await docker(['network', 'create', ...labels, networkName])).trim()
  for (const kind of ['storage', 'config']) {
    const name = `supabase_${kind}_${project}`
    await docker(['volume', 'create', ...labels, name])
    const volumes = await resources('volume')
    if (volumes.some(volume => volume.Labels?.[ownerLabel] !== owner)) throw new Error('Support volume ownership check failed')
  }
  canClaimDatabaseVolume = true
  await run(cli, ['start', '--network-id', networkName], { capture: true })
  await requireOwnedStack()
  const statusOutput = await run(cli, ['status', '--output', 'json'], { capture: true })
  let status
  try { status = JSON.parse(statusOutput) }
  catch { throw new Error('Invalid local database status') }
  const databaseUrl = status.DB_URL
  if (typeof databaseUrl !== 'string' || !databaseUrl.startsWith('postgresql://')) throw new Error('Local test database unavailable')
  await requireOwnedStack()
  await run(process.execPath, ['--test', 'tests/support-session-postgres.test.mjs'], { cwd: root, extraEnv: { WF_SUPPORT_TEST_DATABASE_URL: databaseUrl } })
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Local database tests failed')
  process.exitCode = 1
} finally {
  try {
    if (claimedResources) {
      const state = await inventory()
      if (!allOwned(state)) {
        console.error('Foreign support resources detected; cleaning exact owned resources only')
        process.exitCode = 1
      }
      if (!await cleanupOwnedResources(state)) process.exitCode = 1
    }
  } catch { console.error('Unable to clean owned support test resources'); process.exitCode = 1 }
  finally {
    if (workspace) await rm(workspace, { recursive: true, force: true })
    if (lock) {
      try {
        if (await readFile(lockPath, 'utf8') === owner) await unlink(lockPath)
      } finally { await lock.close() }
    }
  }
}
