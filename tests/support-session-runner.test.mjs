import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, copyFile, writeFile, readFile, rm, chmod } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

test('database runner reports the failing phase, hides credentials and always stops its stack', async () => {
  for (const fail of ['', 'start', 'db reset', 'status', 'test', 'malformed', 'stop']) {
    const root = await mkdtemp(join(tmpdir(), 'wf-support-runner-'))
    try {
      await Promise.all(['scripts', 'node_modules/.bin', 'tests/fixtures/support-postgres', 'supabase/migrations'].map(dir => mkdir(join(root, dir), { recursive: true })))
      await copyFile(new URL('../scripts/test-support-postgres.mjs', import.meta.url), join(root, 'scripts/test-support-postgres.mjs'))
      await writeFile(join(root, 'supabase/config.toml'), 'project_id = "wf-studio-support-test"\n')
      await writeFile(join(root, 'supabase/migrations/202610230001_original.sql'), '-- original migration bytes\n')
      await writeFile(join(root, 'tests/fixtures/support-postgres/202606210002_test_compat.sql'), '-- test-only prerequisites\n')
      const cli = join(root, 'node_modules/.bin/supabase')
      await writeFile(cli, `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
if (process.env.SUPABASE_TELEMETRY_DISABLED !== 'true' || process.env.DO_NOT_TRACK !== '1') process.exit(9);
fs.appendFileSync(process.env.WF_RUNNER_CALLS_PATH, JSON.stringify({ args, cwd: process.cwd() }) + '\\n');
if (process.cwd() === process.env.WF_RUNNER_SOURCE_ROOT) { console.error('must use disposable stack workspace'); process.exit(8); }
if (fs.readFileSync('supabase/migrations/202610230001_original.sql', 'utf8') !== '-- original migration bytes\\n') process.exit(7);
if (!fs.existsSync('supabase/migrations/202606210002_test_compat.sql')) process.exit(6);
if (args.join(' ').startsWith(process.env.WF_RUNNER_FAIL) && process.env.WF_RUNNER_FAIL && process.env.WF_RUNNER_FAIL !== 'test') { console.error('private-credential-sentinel'); process.exit(2); }
if (args[0] === 'status') console.log(process.env.WF_RUNNER_FAIL === 'malformed' ? 'leaksecret' : JSON.stringify({ DB_URL: 'postgresql://private-credential-sentinel@127.0.0.1/test' }));
if (args[0] === 'start') console.log('private-credential-sentinel');
`)
      await chmod(cli, 0o755)
      await writeFile(join(root, 'tests/support-session-postgres.test.mjs'), `import test from 'node:test'; import assert from 'node:assert/strict'; test('receives database URL in memory', () => { assert.ok(process.env.WF_SUPPORT_TEST_DATABASE_URL.includes('private-credential-sentinel')); assert.notEqual(process.env.WF_RUNNER_FAIL, 'test'); });`)
      const env = { ...process.env, WF_RUNNER_FAIL: fail, WF_RUNNER_CALLS_PATH: join(root, 'calls.jsonl'), WF_RUNNER_SOURCE_ROOT: root }
      // The subprocess is a fresh test runner, not a worker of this node:test run.
      delete env.NODE_TEST_CONTEXT
      const result = spawnSync(process.execPath, ['scripts/test-support-postgres.mjs'], { cwd: root, env, encoding: 'utf8' })
      assert.equal(result.status, fail ? 1 : 0, `scenario ${fail || 'success'}: ${result.stderr}`)
      assert.doesNotMatch(result.stdout + result.stderr, /private-credential|leaksecret/)
      const records = (await readFile(join(root, 'calls.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line))
      const calls = records.map(record => record.args)
      await assert.rejects(readFile(join(records[0].cwd, 'supabase/config.toml')), { code: 'ENOENT' })
      assert.equal(await readFile(join(root, 'supabase/migrations/202610230001_original.sql'), 'utf8'), '-- original migration bytes\n')
      assert.deepEqual(calls[0], ['start'])
      assert.deepEqual(calls.at(-1), ['stop', '--no-backup'])
      if (!fail || fail === 'test') {
        assert.deepEqual(calls[1], ['db', 'reset', '--local', '--no-seed'])
        assert.deepEqual(calls[2], ['status', '--output', 'json'])
      }
      if (['start', 'db reset', 'status'].includes(fail)) assert.match(result.stderr, new RegExp(`failed.*${fail}`))
    } finally { await rm(root, { recursive: true, force: true }) }
  }
})
