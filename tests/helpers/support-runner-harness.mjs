import { mkdtemp, mkdir, copyFile, writeFile, readFile, rm, chmod } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, delimiter } from 'node:path'
import { spawn } from 'node:child_process'

export async function runnerFixture(shared) {
  const root = await mkdtemp(join(tmpdir(), 'wf-support-ownership-'))
  const stateRoot = shared ?? root
  const stateFile = join(stateRoot, 'docker.json')
  if (!shared) await writeFile(stateFile, JSON.stringify({ containers: [], volumes: [], networks: [] }))
  await Promise.all(['scripts', 'node_modules/.bin', 'tests/fixtures/support-postgres', 'supabase/migrations'].map(dir => mkdir(join(root, dir), { recursive: true })))
  await copyFile(new URL('../../scripts/test-support-postgres.mjs', import.meta.url), join(root, 'scripts/test-support-postgres.mjs'))
  await writeFile(join(root, 'supabase/config.toml'), 'project_id = "wf-studio-support-test"\n')
  await writeFile(join(root, 'supabase/migrations/202610230001_original.sql'), '-- original migration bytes\n')
  await writeFile(join(root, 'tests/fixtures/support-postgres/202606210002_test_compat.sql'), '-- test-only prerequisites\n')
  const driver = `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
const docker = path.basename(process.argv[1]) === 'docker';
const stateFile = process.env.WF_RUNNER_STATE;
const project = 'wf-studio-support-test';
const projectLabel = 'com.supabase.cli.project';
const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
const save = () => fs.writeFileSync(stateFile, JSON.stringify(state));
const log = entry => fs.appendFileSync(process.env.WF_RUNNER_LOG, JSON.stringify(entry) + '\\n');
const labels = () => Object.fromEntries(args.flatMap((arg, i) => arg === '--label' ? [args[i + 1].split('=')] : []));
const matching = items => {
  if (!args.includes('--filter')) return items;
  const filter = args[args.indexOf('--filter') + 1];
  const [key, value] = filter.slice(6).split('=');
  return items.filter(item => item.Labels?.[key] === value || item.Config?.Labels?.[key] === value);
};
if (docker) {
  log({ docker: args });
  if (args[0] === 'info') { console.log(process.env.WF_RUNNER_DAEMON); process.exit(0); }
  const kind = args[0], operation = args[1];
  const key = { container: 'containers', volume: 'volumes', network: 'networks' }[kind];
  if (!key) process.exit(20);
  if (operation === 'ls') {
    for (const item of matching(state[key])) console.log(kind === 'container' ? (args.includes('--filter') ? item.Id : item.Id + ' ' + item.Name.slice(1)) : kind === 'volume' ? item.Name : item.Id + ' ' + item.Name);
  } else if (operation === 'inspect') {
    const names = args.slice(2);
    const items = state[key].filter(item => names.includes(item.Id) || names.includes(item.Name));
    if (items.length !== names.length) process.exit(1);
    if (kind === 'network' && process.env.WF_RUNNER_FOREIGN_BEFORE_RESET && !fs.existsSync(stateFile + '.before-reset')) {
      fs.writeFileSync(stateFile + '.before-reset', 'injected');
      state.networks.push({ Id: 'foreign-before-reset', Name: 'foreign-before-reset', Labels: { [projectLabel]: project } }); save();
    }
    if (kind === 'network' && process.env.WF_RUNNER_FOREIGN_BEFORE_STOP && fs.existsSync(stateFile + '.test-complete') && !fs.existsSync(stateFile + '.before-stop')) {
      fs.writeFileSync(stateFile + '.before-stop', 'injected');
      state.networks.push({ Id: 'foreign-before-stop', Name: 'foreign-before-stop', Labels: { [projectLabel]: project } }); save();
    }
    console.log(JSON.stringify(items));
  } else if (operation === 'create') {
    const name = args.at(-1);
    let item = state[key].find(item => item.Name === name);
    if (!item) { item = { Name: name, Id: kind === 'network' ? 'network-' + name : name, Labels: labels(), ...(kind === 'volume' ? { CreatedAt: new Date().toISOString() } : {}) }; state[key].push(item); save(); }
    console.log(kind === 'network' ? item.Id : item.Name);
  } else if (operation === 'rm') {
    if (kind === 'volume' && process.env.WF_RUNNER_REFUSE_VOLUME_RM) process.exit(22);
    const names = args.slice(2).filter(arg => !arg.startsWith('-'));
    state[key] = state[key].filter(item => !names.includes(item.Id) && !names.includes(item.Name)); save();
    if (kind === 'container' && process.env.WF_RUNNER_REPLACE_VOLUME_DURING_CLEANUP && !fs.existsSync(stateFile + '.cleanup-replacement')) {
      fs.writeFileSync(stateFile + '.cleanup-replacement', 'replaced');
      const volume = state.volumes.find(item => item.Name === 'supabase_db_' + project);
      volume.CreatedAt = new Date(Date.parse(volume.CreatedAt) + 1000).toISOString(); save();
    }
  } else process.exit(21);
  process.exit(0);
}
if (process.env.SUPABASE_TELEMETRY_DISABLED !== 'true' || process.env.DO_NOT_TRACK !== '1') process.exit(9);
log({ args, cwd: process.cwd() });
if (process.cwd() === process.env.WF_RUNNER_SOURCE_ROOT) process.exit(8);
if (fs.readFileSync('supabase/migrations/202610230001_original.sql', 'utf8') !== '-- original migration bytes\\n') process.exit(7);
if (!fs.existsSync('supabase/migrations/202606210002_test_compat.sql')) process.exit(6);
if (args[0] === 'start') {
  if (state.volumes.some(volume => volume.Name === 'supabase_db_' + project)) {
    console.error('pre-created database volume selects backup startup instead of fresh initialization'); process.exit(3);
  }
  const networkName = args[args.indexOf('--network-id') + 1];
  let network = state.networks.find(item => item.Name === networkName);
  if (!network) { network = { Id: 'cli-network-' + networkName, Name: networkName, Labels: { [projectLabel]: project } }; state.networks.push(network); }
  const networkId = network.Id;
  const dbVolume = { Name: 'supabase_db_' + project, CreatedAt: new Date().toISOString(), Labels: { [projectLabel]: project } };
  state.volumes.push(dbVolume);
  state.containers.push({ Id: 'db-' + path.basename(process.cwd()), Name: '/supabase_db_' + project, Config: { Labels: { [projectLabel]: project } }, Mounts: [{ Type: 'volume', Name: dbVolume.Name }], NetworkSettings: { Networks: { owned: { NetworkID: networkId } } } }); save();
  if (process.env.WF_RUNNER_GATE) {
    fs.writeFileSync(process.env.WF_RUNNER_GATE + '.ready', 'ready');
    const wait = setInterval(() => { if (fs.existsSync(process.env.WF_RUNNER_GATE + '.release')) { clearInterval(wait); finish(); } }, 10);
  } else finish();
} else finish();
function finish() {
  if (args.join(' ').startsWith(process.env.WF_RUNNER_FAIL) && process.env.WF_RUNNER_FAIL && process.env.WF_RUNNER_FAIL !== 'test') { console.error('private-credential-sentinel'); process.exit(2); }
  if (args[0] === 'db' && args[1] === 'reset') {
    state.networks = state.networks.filter(item => item.Id !== 'foreign-before-reset');
    const volume = state.volumes.find(item => item.Name === 'supabase_db_' + project);
    volume.CreatedAt = new Date(Date.parse(volume.CreatedAt) + 1000).toISOString(); save();
  }
  if (args[0] === 'status') {
    if (process.env.WF_RUNNER_REPLACE_DB) {
      const volume = state.volumes.find(item => item.Name === 'supabase_db_' + project);
      volume.CreatedAt = new Date(Date.parse(volume.CreatedAt) + 1000).toISOString(); save();
    }
    if (process.env.WF_RUNNER_FOREIGN) {
      state.containers.push({ Id: 'foreign-new', Name: '/supabase_other_' + project, Config: { Labels: { [projectLabel]: project } }, NetworkSettings: { Networks: {} } });
      state.volumes.push({ Name: 'foreign-volume', CreatedAt: new Date().toISOString(), Labels: { [projectLabel]: project } }); save();
    }
    console.log(process.env.WF_RUNNER_FAIL === 'malformed' ? 'leaksecret' : JSON.stringify({ DB_URL: 'postgresql://private-credential-sentinel@127.0.0.1/test' }));
  }
  if (args[0] === 'stop') { state.containers = []; state.volumes = []; state.networks = []; save(); }
}
`
  for (const name of ['docker', 'supabase']) {
    const file = join(root, 'node_modules/.bin', name)
    await writeFile(file, driver)
    await chmod(file, 0o755)
  }
  await writeFile(join(root, 'tests/support-session-postgres.test.mjs'), `import test from 'node:test'; import assert from 'node:assert/strict'; import { writeFileSync } from 'node:fs'; test('receives database URL in memory', () => { assert.ok(process.env.WF_SUPPORT_TEST_DATABASE_URL.includes('private-credential-sentinel')); assert.notEqual(process.env.WF_RUNNER_FAIL, 'test'); writeFileSync(process.env.WF_RUNNER_STATE + '.test-complete', 'complete'); });`)
  const logPath = join(root, 'calls.jsonl')
  const start = (extra = {}) => {
    const env = { ...process.env, PATH: join(root, 'node_modules/.bin') + delimiter + process.env.PATH, WF_RUNNER_STATE: stateFile, WF_RUNNER_DAEMON: stateRoot, WF_RUNNER_LOG: logPath, WF_RUNNER_SOURCE_ROOT: root, ...extra }
    delete env.NODE_TEST_CONTEXT
    const child = spawn(process.execPath, ['scripts/test-support-postgres.mjs'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = '', stderr = ''
    child.stdout.on('data', chunk => { stdout += chunk })
    child.stderr.on('data', chunk => { stderr += chunk })
    const done = new Promise((resolve, reject) => { child.on('error', reject); child.on('close', status => resolve({ status, stdout, stderr })) })
    return { done, child }
  }
  return { root, stateRoot, start,
    state: () => readFile(stateFile, 'utf8').then(JSON.parse),
    seed: state => writeFile(stateFile, JSON.stringify(state)),
    calls: async () => readFile(logPath, 'utf8').then(text => text.trim().split('\n').map(JSON.parse)).catch(error => { if (error.code === 'ENOENT') return []; throw error }),
    cleanup: () => rm(root, { recursive: true, force: true }),
  }
}

export async function waitForFile(path) {
  for (let i = 0; i < 500; i++) {
    try { await readFile(path); return } catch (error) { if (error.code !== 'ENOENT') throw error }
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  throw new Error('Runner did not reach the concurrency barrier')
}
