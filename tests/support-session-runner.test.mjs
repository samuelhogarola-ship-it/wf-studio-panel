import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { runnerFixture, waitForFile } from './helpers/support-runner-harness.mjs'

test('database runner reports the failing phase, hides credentials and always stops its owned stack', async () => {
  for (const fail of ['', 'start', 'db reset', 'status', 'test', 'malformed', 'stop']) {
    const fixture = await runnerFixture()
    try {
      const result = await fixture.start({ WF_RUNNER_FAIL: fail }).done
      assert.equal(result.status, fail ? 1 : 0, `scenario ${fail || 'success'}: ${result.stderr}`)
      assert.doesNotMatch(result.stdout + result.stderr, /private-credential|leaksecret/)
      const calls = (await fixture.calls()).filter(call => call.args)
      await assert.rejects(readFile(join(calls[0].cwd, 'supabase/config.toml')), { code: 'ENOENT' })
      assert.equal(await readFile(join(fixture.root, 'supabase/migrations/202610230001_original.sql'), 'utf8'), '-- original migration bytes\n')
      assert.equal(calls[0].args[0], 'start')
      assert.deepEqual(calls.at(-1).args, ['stop', '--no-backup'])
      if (!fail || fail === 'test') {
        assert.deepEqual(calls[1].args.slice(0, 4), ['db', 'reset', '--local', '--no-seed'])
        assert.deepEqual(calls[2].args, ['status', '--output', 'json'])
      }
      if (['start', 'db reset', 'status'].includes(fail)) assert.match(result.stderr, new RegExp(`failed.*${fail}`))
      assert.deepEqual(await fixture.state(), { containers: [], volumes: [], networks: [] })
    } finally { await fixture.cleanup() }
  }
})

test('pre-existing running/stopped containers or volumes are never reset or removed', async () => {
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
      assert.equal(result.status, 1, 'must reject an existing stack before starting')
      assert.match(result.stderr, /pre-existing.*support.*resources/i)
      assert.deepEqual((await fixture.calls()).filter(call => call.args), [])
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

test('cleanup removes only this invocation resources when foreign resources appear later', async () => {
  const fixture = await runnerFixture()
  try {
    const result = await fixture.start({ WF_RUNNER_FOREIGN: '1' }).done
    assert.equal(result.status, 1)
    const state = await fixture.state()
    assert.deepEqual(state.containers.map(item => item.Id), ['foreign-new'])
    assert.deepEqual(state.volumes.map(item => item.Name), ['foreign-volume'])
    assert.deepEqual(state.networks, [])
    assert.equal((await fixture.calls()).some(call => call.args?.[0] === 'stop'), false, 'project-wide stop must not touch foreign resources')
  } finally { await fixture.cleanup() }
})

test('a database volume replaced outside the authorized reset is preserved', async () => {
  const fixture = await runnerFixture()
  try {
    const result = await fixture.start({ WF_RUNNER_REPLACE_DB: '1' }).done
    assert.equal(result.status, 1)
    const state = await fixture.state()
    assert.deepEqual(state.containers, [])
    assert.deepEqual(state.volumes.map(item => item.Name), ['supabase_db_wf-studio-support-test'])
    assert.deepEqual(state.networks, [])
    assert.equal((await fixture.calls()).some(call => call.args?.[0] === 'stop'), false)
  } finally { await fixture.cleanup() }
})
