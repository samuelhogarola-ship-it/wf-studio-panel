import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { mkdtemp, cp, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const cli = fileURLToPath(new URL('../node_modules/.bin/supabase', import.meta.url))
const env = { ...process.env, SUPABASE_TELEMETRY_DISABLED: 'true', DO_NOT_TRACK: '1' }
let workspace

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

try {
  workspace = await mkdtemp(join(tmpdir(), 'wf-studio-support-test-'))
  await mkdir(join(workspace, 'supabase'))
  await cp(new URL('../supabase/config.toml', import.meta.url), join(workspace, 'supabase/config.toml'))
  // Preserve every applied migration byte-for-byte. Bootstrap prerequisites live
  // only in this disposable workspace, never in production migration history.
  await cp(new URL('../supabase/migrations/', import.meta.url), join(workspace, 'supabase/migrations'), { recursive: true })
  await cp(new URL('../tests/fixtures/support-postgres/', import.meta.url), join(workspace, 'supabase/migrations'), { recursive: true })
  await run(cli, ['start'], { capture: true })
  await run(cli, ['db', 'reset', '--local', '--no-seed'], { capture: true })
  const statusOutput = await run(cli, ['status', '--output', 'json'], { capture: true })
  let status
  try { status = JSON.parse(statusOutput) }
  catch { throw new Error('Invalid local database status') }
  const databaseUrl = status.DB_URL
  if (typeof databaseUrl !== 'string' || !databaseUrl.startsWith('postgresql://')) throw new Error('Local test database unavailable')
  await run(process.execPath, ['--test', 'tests/support-session-postgres.test.mjs'], { cwd: root, extraEnv: { WF_SUPPORT_TEST_DATABASE_URL: databaseUrl } })
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Local database tests failed')
  process.exitCode = 1
} finally {
  if (workspace) {
    try { await run(cli, ['stop', '--no-backup'], { capture: true }) }
    catch { console.error('Unable to stop local support test stack'); process.exitCode = 1 }
    finally { await rm(workspace, { recursive: true, force: true }) }
  }
}
