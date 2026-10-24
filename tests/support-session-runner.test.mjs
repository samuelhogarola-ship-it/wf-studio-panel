import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { runnerFixture, waitForFile } from './helpers/support-runner-harness.mjs'

test('database runner uses one tmpfs Postgres container and preserves failure privacy', async () => {
  for (const fail of ['', 'start', 'migration', 'status', 'test', 'cleanup']) {
    const fixture = await runnerFixture()
    try {
      const result = await fixture.start({ WF_RUNNER_FAIL: fail }).done
      assert.equal(result.status, fail ? 1 : 0, `scenario ${fail || 'success'}: ${result.stderr}`)
      assert.doesNotMatch(result.stdout + result.stderr, /private-credential|leaksecret/)
      const calls = await fixture.calls()
      const dockerCalls = calls.filter(call => call.docker).map(call => call.docker)
      assert.equal(await readFile(join(fixture.root, 'supabase/migrations/202610230001_original.sql'), 'utf8'), '-- original migration bytes\n')
      assert.equal(dockerCalls.some(args => args[0] === 'volume'), false, `scenario ${fail || 'success'} used Docker volumes`)
      const start = dockerCalls.find(args => args[0] === 'container' && args[1] === 'run')
      assert.ok(start)
      assert.ok(start.includes('--rm'))
      assert.deepEqual(start.slice(start.indexOf('--tmpfs'), start.indexOf('--tmpfs') + 2), ['--tmpfs', '/var/lib/postgresql/data:rw,exec'])
      assert.deepEqual(start.slice(start.indexOf('--publish'), start.indexOf('--publish') + 2), ['--publish', '127.0.0.1::5432'])
      assert.equal(start.includes('POSTGRES_USER=postgres'), false)
      assert.equal(start.at(-1), 'postgres:17.6-alpine')
      if (!['start', 'status'].includes(fail)) {
        const migrate = dockerCalls.find(args => args[0] === 'container' && args[1] === 'exec' && args.includes('--interactive'))
        assert.ok(migrate)
        assert.ok(migrate.includes('ON_ERROR_STOP=1'))
        assert.deepEqual(migrate.slice(-2), ['-f', '-'])
      }
      const cleanup = dockerCalls.find(args => args[0] === 'container' && args[1] === 'rm')
      if (fail === 'start') assert.equal(cleanup, undefined)
      else assert.deepEqual(cleanup, ['container', 'rm', '--force', 'd'.repeat(64)])
      const state = await fixture.state()
      assert.deepEqual(state.volumes, [])
      assert.deepEqual(state.networks, [])
      assert.deepEqual(state.containers.map(item => item.Id), fail === 'cleanup' ? ['d'.repeat(64)] : [])
    } finally { await fixture.cleanup() }
  }
})

test('test-only bootstrap supplies service-owned database prerequisites without changing migration history', async () => {
  const sql = await readFile(new URL('./fixtures/support-postgres/000000000000_test_prerequisites.sql', import.meta.url), 'utf8')
  assert.match(sql, /set role supabase_admin/i)
  assert.match(sql, /create or replace function auth\.jwt\(\)/i)
  assert.match(sql, /create table storage\.buckets/i)
  assert.match(sql, /grant (?:usage|insert|select).*postgres/is)
  assert.match(sql, /reset role;\s*$/i)
})

test('a replacement injected at the former inspect-to-remove point survives because no volume surface exists', async () => {
  const fixture = await runnerFixture()
  try {
    const result = await fixture.start({ WF_RUNNER_EXACT_VOLUME_RACE: '1' }).done
    assert.equal(result.status, 0, result.stderr)
    const state = await fixture.state()
    assert.deepEqual(state.containers, [], 'the invocation container must not leak')
    assert.deepEqual(state.networks, [])
    assert.deepEqual(state.volumes.map(item => item.Name), ['foreign-current-volume'])
    assert.deepEqual((await fixture.calls()).filter(call => call.docker?.[0] === 'volume'), [])
  } finally { await fixture.cleanup() }
})

test('pre-existing resources cannot collide with the isolated container and are preserved', async () => {
  const label = { 'com.supabase.cli.project': 'wf-studio-support-test' }
  for (const resource of [
    { containers: [{ Id: 'foreign-running', Name: '/supabase_db_wf-studio-support-test', State: 'running', Config: { Labels: label } }] },
    { containers: [{ Id: 'foreign-stopped', Name: '/supabase_db_wf-studio-support-test', State: 'exited', Config: { Labels: {} } }] },
    { volumes: [{ Name: 'supabase_db_wf-studio-support-test', Labels: {} }] },
    { volumes: [{ Name: 'arbitrary-volume-name', Labels: label }] },
  ]) {
    const fixture = await runnerFixture()
    const state = { containers: [], volumes: [], networks: [], ...resource }
    try {
      await fixture.seed(state)
      const result = await fixture.start().done
      assert.equal(result.status, 0, result.stderr)
      assert.deepEqual(await fixture.state(), state)
    } finally { await fixture.cleanup() }
  }
})

test('concurrent runners from different checkouts cannot reset or stop the first invocation', async () => {
  const first = await runnerFixture()
  const second = await runnerFixture(first.stateRoot)
  const gate = join(first.root, 'start-gate')
  const running = first.start({ WF_RUNNER_GATE: gate })
  try {
    await waitForFile(`${gate}.ready`)
    const before = await first.state()
    const collision = await second.start({ TMPDIR: second.root }).done
    assert.equal(collision.status, 1)
    assert.match(collision.stderr, /support.*runner.*lock|runner.*already/i)
    assert.deepEqual((await second.calls()).filter(call => call.args), [])
    assert.deepEqual(await first.state(), before)
  } finally {
    await writeFile(`${gate}.release`, 'release')
    const result = await running.done
    await second.cleanup()
    await first.cleanup()
    assert.equal(result.status, 0, result.stderr)
  }
})

test('cleanup by immutable container ID preserves a foreign container appearing later', async () => {
  const fixture = await runnerFixture()
  try {
    const result = await fixture.start({ WF_RUNNER_FOREIGN: '1' }).done
    assert.equal(result.status, 0, result.stderr)
    const state = await fixture.state()
    assert.deepEqual(state.containers.map(item => item.Id), ['foreign-new'])
    assert.deepEqual(state.volumes, [])
    assert.deepEqual(state.networks, [])
    assert.deepEqual((await fixture.calls()).filter(call => call.docker?.[0] === 'volume'), [])
  } finally { await fixture.cleanup() }
})

test('cleanup refusal does not mask the primary test failure', async () => {
  const fixture = await runnerFixture()
  try {
    const result = await fixture.start({ WF_RUNNER_FAIL: 'test', WF_RUNNER_REFUSE_CLEANUP: '1' }).done
    assert.equal(result.status, 1)
    assert.match(result.stderr, /Local database test command failed: --test tests\/support-session-postgres\.test\.mjs/)
    assert.match(result.stderr, /Unable to remove owned support container/)
    const state = await fixture.state()
    assert.deepEqual(state.containers.map(item => item.Id), ['d'.repeat(64)])
    assert.deepEqual(state.volumes, [])
    assert.deepEqual(state.networks, [])
  } finally { await fixture.cleanup() }
})
