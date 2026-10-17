import test from 'node:test';
import assert from 'node:assert/strict';
import { loadProjectModule, database, boundary, form, project, client, capability, projectId, clientId, otherClientId } from './helpers/project-harness.mjs';

function setup(seed, extra, failures) {
  const db = database(seed, failures);
  const b = boundary(db, extra);
  return { db, ...b, data: () => loadProjectModule('src/lib/data/projects.ts', b.mocks), actions: () => loadProjectModule('src/lib/actions/projects.ts', b.mocks) };
}
const writes = db => db.calls.filter(call => call.operation !== 'select');
const capabilityForm = values => form({ project_id: projectId, capability_key: 'blogger', state: 'active', launch_url: 'https://example.com/admin/', provisioning_confirmed: 'true', ...values });

// Pause one remote UPDATE before evaluating its predicates against shared rows.
// Both competing requests execute the real server actions on the same database.
function raceSetup(initialProject, matches) {
  const blocked = Promise.withResolvers();
  const release = Promise.withResolvers();
  let paused = false;
  const db = database({ client_projects: [initialProject], clients: [client, { ...client, id: otherClientId }] }, {}, {
    beforeExecute: async call => {
      if (!paused && call.table === 'client_projects' && call.operation === 'update' && matches(call.payload)) {
        paused = true;
        blocked.resolve();
        await release.promise;
      }
    },
  });
  const b = boundary(db);
  return { db, actions: loadProjectModule('src/lib/actions/projects.ts', b.mocks), blocked: blocked.promise, release: release.resolve };
}

test('inventory combines search, client, lifecycle and active capability filters', async () => {
  const s = setup({ client_projects: [project, { ...project, id: 'other', name: 'Other', status: 'draft' }], project_capabilities: [{ ...capability, state: 'active' }] });
  const result = await s.data().getAdminProjects({ query: '  EXAMPLE.COM ', clientId, status: 'active', capability: 'blogger' });
  assert.deepEqual(result.projects.map(p => p.id), [projectId]);
  assert.equal(result.projects[0].client.name, 'Ana');
  assert.deepEqual((await s.data().getAdminProjects({ query: 'no match' })).projects, []);
  assert.deepEqual(s.events.slice(0, 2), ['admin', 'session-db']);
});

test('detail includes capability audit and exact navigation across all assigned projects', async () => {
  const s = setup({ clients: [{ ...client, portal_mode: 'dynamic' }], project_capabilities: [{ ...capability, capability_key: 'invoices', state: 'active' }], project_capability_audit: [{ id: 'audit', project_id: projectId, capability_key: 'blogger', actor_id: 'actor', operation: 'UPDATE', old_record: { state: 'available' }, new_record: { state: 'active' }, created_at: project.created_at }] });
  const detail = await s.data().getAdminProject(projectId);
  assert.equal(detail.audit[0].actor_id, 'actor');
  assert.deepEqual(detail.preview.navigation.map(item => item.href), ['/cliente/dashboard', '/cliente/pendientes', '/cliente/mensajeria', '/cliente/facturas']);
  assert.equal(await s.data().getAdminProject('missing'), null);
});

test('client repository uses session identity and denies guessed, archived, hidden and foreign projects', async () => {
  const s = setup({ client_projects: [project, { ...project, id: 'foreign', slug: 'foreign', client_id: otherClientId }, { ...project, id: 'hidden', slug: 'hidden', client_access_enabled: false }, { ...project, id: 'archived', slug: 'archived', status: 'archived' }], project_capabilities: [{ ...capability, state: 'active', launch_url: 'https://example.com/admin/', validated_at: project.created_at }] });
  assert.deepEqual((await s.data().getClientPortalContext()).projects.map(p => p.slug), ['example']);
  assert.equal((await s.data().getAccessibleClientProject('example')).id, projectId);
  for (const slug of ['foreign', 'hidden', 'archived', 'unknown']) assert.equal(await s.data().getAccessibleClientProject(slug), null);
  assert.equal((await s.data().getActiveClientCapability('example', 'blogger')).capability_key, 'blogger');
  assert.equal(await s.data().clientHasActiveCapability('invoices'), false);
  assert.equal(await s.data().clientHasActiveCapability('blogger'), true);
  assert.ok(!s.events.includes('admin'));
});

test('client capability resolution fails closed for inactive or invalid Blogger configuration', async () => {
  for (const entry of [capability, { ...capability, state: 'active', launch_url: 'https://evil.com', validated_at: project.created_at }]) {
    const s = setup({ project_capabilities: [entry] });
    assert.equal(await s.data().getActiveClientCapability('example', 'blogger'), null);
    assert.equal(await s.data().clientHasActiveCapability('blogger'), false);
  }
});

test('all exported mutations authorize before opening a database or validating input', async () => {
  const s = setup({}, { '@/lib/auth': { requireAdmin: async () => { throw new Error('Denied'); } } });
  const actions = s.actions();
  assert.deepEqual(Object.keys(actions).sort(), ['assignProjectClientAction', 'setClientPortalModeAction', 'setProjectAccessAction', 'upsertProjectAction', 'upsertProjectCapabilityAction']);
  for (const action of Object.values(actions)) await assert.rejects(() => action({}, form({})), /Denied/);
  assert.deepEqual(s.events, []);
  assert.deepEqual(writes(s.db), []);
});

test('registration normalizes slug/domain and never grants access or activates Blogger', async () => {
  const s = setup({ client_projects: [], project_capabilities: [] });
  const result = await s.actions().upsertProjectAction({}, form({ slug: ' NEW-SITE ', name: ' New site ', domain: 'WWW.EXAMPLE.COM', status: 'draft', client_id: otherClientId, client_access_enabled: 'true' }));
  assert.ok(result.success);
  const saved = writes(s.db).find(call => call.table === 'client_projects').payload;
  assert.equal(saved.slug, 'new-site');
  assert.equal(saved.domain, 'example.com');
  assert.equal(saved.client_id, undefined);
  assert.equal(saved.client_access_enabled, undefined);
  assert.deepEqual(
    s.db.tables.project_capabilities.map(row => row.capability_key).sort(),
    ['analytics', 'blogger', 'bonuses_reports', 'domains', 'hosting', 'invoices', 'products'],
  );
  assert.ok(s.db.tables.project_capabilities.every(row =>
    row.state === 'unavailable' && row.launch_url === null && row.validated_at === null && Object.keys(row.metadata).length === 0));
  assert.ok(!writes(s.db).some(call => call.table === 'project_capabilities'), 'defaults are created by the database trigger, not the action');
});

test('active destinations and hosting management reject foreign, repaired, HTTP and credential URLs', async () => {
  for (const url of ['https:///example.com/admin', 'https://evil.com', 'http://example.com', 'https://user@example.com']) {
    const s = setup();
    assert.ok((await s.actions().upsertProjectCapabilityAction({}, capabilityForm({ capability_key: 'hosting', launch_url: url }))).error, url);
    assert.equal(writes(s.db).length, 0);
  }
});

test('Blogger activation needs an editor destination and explicit provisioning confirmation', async () => {
  for (const values of [{ launch_url: '' }, { provisioning_confirmed: '' }, { provisioning_confirmed: 'false' }]) {
    const s = setup();
    assert.ok((await s.actions().upsertProjectCapabilityAction({}, capabilityForm(values))).error);
    assert.equal(writes(s.db).length, 0);
  }
  const s = setup();
  assert.ok((await s.actions().upsertProjectCapabilityAction({}, capabilityForm({ metadata: '{"secret":"ignored"}', validated_at: 'forged' }))).success);
  const saved = writes(s.db)[0].payload;
  assert.equal(saved.metadata.provisioning_confirmed, true);
  assert.equal(saved.metadata.secret, undefined);
  assert.ok(Number.isFinite(Date.parse(saved.validated_at)));
  assert.notEqual(saved.validated_at, 'forged');
});

test('analytics activation requires matching registry domain, website ID and configured connection', async () => {
  const analytics = { getConfiguredUmamiSites: () => [{ key: 'example', domain: 'example.com', websiteId: 'website-id', source: 'personal' }], getUmamiConnections: () => ({ personal: { baseUrl: 'https://stats.example.net', password: 'server-secret' } }) };
  for (const key of [null, 'unknown', 'example']) {
    const s = setup({ client_projects: [{ ...project, analytics_registry_key: key }] });
    assert.ok((await s.actions().upsertProjectCapabilityAction({}, capabilityForm({ capability_key: 'analytics', launch_url: '' }))).error);
    assert.equal(writes(s.db).length, 0);
  }
  for (const overrides of [{}, { getConfiguredUmamiSites: () => [{ key: 'example', domain: 'foreign.com', websiteId: 'id', source: 'personal' }] }, { getConfiguredUmamiSites: () => [{ key: 'example', domain: 'example.com', source: 'personal' }] }, { getUmamiConnections: () => ({ personal: {} }) }]) {
    const s = setup({ client_projects: [{ ...project, analytics_registry_key: 'example' }] }, { '@/lib/analytics/umami-core.mjs': { ...analytics, ...overrides } });
    const result = await s.actions().upsertProjectCapabilityAction({}, capabilityForm({ capability_key: 'analytics', launch_url: '' }));
    assert.equal(Boolean(result.success), Object.keys(overrides).length === 0);
  }
});

test('reassignment is namespace scoped, refuses pending clients and resets portal access', async () => {
  for (const target of [{ ...client, project: 'other' }, { ...client, status: 'pending' }]) {
    const s = setup({ clients: [target] });
    assert.ok((await s.actions().assignProjectClientAction({}, form({ project_id: projectId, client_id: clientId }))).error);
    assert.equal(writes(s.db).length, 0);
  }
  const s = setup({ clients: [client, { ...client, id: otherClientId }] });
  assert.ok((await s.actions().assignProjectClientAction({}, form({ project_id: projectId, client_id: otherClientId }))).success);
  assert.equal(s.db.tables.client_projects[0].client_access_enabled, false);
  assert.equal(s.db.tables.clients[0].portal_mode, 'legacy');
});

test('access cannot be enabled without an assigned active Studio client and active project', async () => {
  for (const patch of [{ client_id: null }, { status: 'draft' }, { status: 'archived' }]) {
    const s = setup({ client_projects: [{ ...project, ...patch }] });
    assert.ok((await s.actions().setProjectAccessAction({}, form({ project_id: projectId, enabled: 'true' }))).error);
    assert.equal(writes(s.db).length, 0);
  }
  const s = setup();
  assert.ok((await s.actions().setProjectAccessAction({}, form({ project_id: projectId, enabled: 'true' }))).success);
});

test('dynamic mode requires at least one assigned active accessible project', async () => {
  for (const rows of [[], [{ ...project, status: 'draft' }], [{ ...project, client_access_enabled: false }], [{ ...project, client_id: otherClientId }]]) {
    const s = setup({ client_projects: rows });
    assert.ok((await s.actions().setClientPortalModeAction({}, form({ client_id: clientId, portal_mode: 'dynamic' }))).error);
    assert.equal(writes(s.db).length, 0);
  }
  const s = setup();
  assert.ok((await s.actions().setClientPortalModeAction({}, form({ client_id: clientId, portal_mode: 'dynamic' }))).success);
  assert.equal(s.db.tables.clients[0].portal_mode, 'dynamic');
});

test('project edits cannot invalidate active destinations or change a stable slug', async () => {
  const s = setup({ project_capabilities: [{ ...capability, state: 'active', launch_url: 'https://example.com/admin/', validated_at: project.created_at }] });
  for (const patch of [{ domain: 'different.com' }, { slug: 'different' }]) {
    assert.ok((await s.actions().upsertProjectAction({}, form({ id: projectId, slug: project.slug, name: project.name, domain: project.domain, status: 'active', ...patch }))).error);
    assert.equal(writes(s.db).length, 0);
  }
});

test('database failures fail closed and never claim a successful mutation', async () => {
  const s = setup({}, {}, { client_projects: 'database unavailable' });
  await assert.rejects(() => s.data().getAdminProjects(), /proyectos|projects/i);
  assert.ok((await s.actions().setProjectAccessAction({}, form({ project_id: projectId, enabled: 'true' }))).error);
});

test('malformed project IDs return absent before issuing a UUID database query', async () => {
  const s = setup();
  assert.equal(await s.data().getAdminProject('not-a-uuid'), null);
  assert.equal(s.db.calls.length, 0);
});

test('client authentication resolves only the session Studio row and retains portal mode', async () => {
  const db = database({ profiles: [{ id: 'user', email: client.email, role: 'client' }], clients: [{ ...client, id: otherClientId, project: 'other' }, { ...client, portal_mode: 'dynamic' }] });
  db.auth = { getUser: async () => ({ data: { user: { id: 'user', email: client.email } } }) };
  const b = boundary(db);
  const auth = loadProjectModule('src/lib/auth.ts', b.mocks);
  const identity = await auth.requireClientAccess();
  assert.equal(identity.client.id, clientId);
  assert.equal(identity.client.portal_mode, 'dynamic');
});

test('administrative reads authorize before accessing the database', async () => {
  const s = setup({}, { '@/lib/auth': { requireAdmin: async () => { throw new Error('Denied'); } } });
  await assert.rejects(() => s.data().getAdminProjects(), /Denied/);
  await assert.rejects(() => s.data().getAdminProject(projectId), /Denied/);
  assert.equal(s.db.calls.length, 0);
});

test('unassignment and access deactivation preserve client mode and published Blogger configuration', async () => {
  const s = setup({ clients: [{ ...client, portal_mode: 'dynamic' }], project_capabilities: [{ ...capability, state: 'active', launch_url: 'https://example.com/admin/', validated_at: project.created_at }] });
  assert.ok((await s.actions().setProjectAccessAction({}, form({ project_id: projectId, enabled: 'false' }))).success);
  assert.ok((await s.actions().assignProjectClientAction({}, form({ project_id: projectId, client_id: '' }))).success);
  assert.equal(s.db.tables.client_projects[0].client_id, null);
  assert.equal(s.db.tables.client_projects[0].client_access_enabled, false);
  assert.equal(s.db.tables.clients[0].portal_mode, 'dynamic');
  assert.equal(s.db.tables.project_capabilities[0].state, 'active');
  assert.equal(s.db.tables.project_capabilities[0].launch_url, 'https://example.com/admin/');
  assert.ok((await s.actions().setClientPortalModeAction({}, form({ client_id: clientId, portal_mode: 'legacy' }))).success);
});

test('internal account capabilities activate without external destinations and invalidate portal layout', async () => {
  const paths = [];
  const s = setup({}, { 'next/cache': { revalidatePath: (...args) => paths.push(args) } });
  assert.ok((await s.actions().upsertProjectCapabilityAction({}, capabilityForm({ capability_key: 'invoices', launch_url: '' }))).success);
  assert.equal(s.db.tables.project_capabilities.find(row => row.capability_key === 'invoices').state, 'active');
  assert.ok(paths.some(args => args[0] === '/cliente' && args[1] === 'layout'));
  assert.ok(!writes(s.db).some(call => call.table === 'project_capability_audit'));
});

test('no-op updates and database write errors do not produce success', async () => {
  for (const failures of [{ project_capabilities: 'write rejected' }, {}]) {
    const s = setup(failures.project_capabilities ? {} : { client_projects: [] }, {}, failures);
    const result = await s.actions().upsertProjectCapabilityAction({}, capabilityForm({ capability_key: 'products', launch_url: '' }));
    assert.ok(result.error);
    assert.equal(result.success, undefined);
  }
});

test('capability changes preserve existing display metadata and ignore arbitrary form metadata', async () => {
  for (const key of ['blogger', 'invoices']) {
    const s = setup({ project_capabilities: [{ ...capability, capability_key: key, metadata: { display_label: 'Existing label' } }] });
    assert.ok((await s.actions().upsertProjectCapabilityAction({}, capabilityForm({ capability_key: key, metadata: '{"display_label":"forged"}' }))).success);
    assert.equal(s.db.tables.project_capabilities[0].metadata.display_label, 'Existing label');
  }
});

test('invalid saved hosting management destinations block activation and client capability reads', async () => {
  const s = setup({ client_projects: [{ ...project, hosting_management_url: 'https://evil.com/manage' }], project_capabilities: [{ ...capability, capability_key: 'hosting', state: 'active' }] });
  assert.ok((await s.actions().upsertProjectCapabilityAction({}, capabilityForm({ capability_key: 'hosting', launch_url: '' }))).error);
  assert.equal(writes(s.db).length, 0);
  assert.equal(await s.data().clientHasActiveCapability('hosting'), false);
});

for (const enabled of [true, false]) {
  test(`stale access ${enabled ? 'enable' : 'disable'} cannot change access after concurrent reassignment`, { timeout: 5000 }, async t => {
    const s = raceSetup({ ...project, client_access_enabled: !enabled }, payload => !('client_id' in payload) && payload.client_access_enabled === enabled);
    t.after(s.release);
    const pending = s.actions.setProjectAccessAction({}, form({ project_id: projectId, enabled }));
    await s.blocked;
    assert.ok((await s.actions.assignProjectClientAction({}, form({ project_id: projectId, client_id: otherClientId }))).success);
    if (!enabled) assert.ok((await s.actions.setProjectAccessAction({}, form({ project_id: projectId, enabled: true }))).success);
    s.release();
    const stale = await pending;
    assert.ok(stale.error, 'the pending access request must reject its stale assignment');
    assert.equal(stale.success, undefined);
    assert.equal(s.db.tables.client_projects[0].client_id, otherClientId);
    assert.equal(s.db.tables.client_projects[0].client_access_enabled, !enabled);
    if (enabled) {
      assert.ok((await s.actions.setProjectAccessAction({}, form({ project_id: projectId, enabled: true }))).success);
      assert.equal(s.db.tables.client_projects[0].client_access_enabled, true);
    }
  });
}

for (const initialOwner of [clientId, null]) {
  test(`stale assignment cannot overwrite concurrent ${initialOwner ? 'unassignment' : 'assignment of an unassigned project'}`, { timeout: 5000 }, async t => {
    const s = raceSetup({ ...project, client_id: initialOwner, client_access_enabled: false }, payload => payload.client_id === otherClientId);
    t.after(s.release);
    const pending = s.actions.assignProjectClientAction({}, form({ project_id: projectId, client_id: otherClientId }));
    await s.blocked;
    const winningOwner = initialOwner ? null : clientId;
    assert.ok((await s.actions.assignProjectClientAction({}, form({ project_id: projectId, client_id: winningOwner ?? '' }))).success);
    s.release();
    const stale = await pending;
    assert.ok(stale.error, 'the pending assignment must reject the changed project');
    assert.equal(stale.success, undefined);
    assert.equal(s.db.tables.client_projects[0].client_id, winningOwner);
    assert.equal(s.db.tables.client_projects[0].client_access_enabled, false);
  });
}

test('stale access is rejected when concurrent ownership changes away and back to the original client', { timeout: 5000 }, async t => {
  const s = raceSetup({ ...project, client_access_enabled: false }, payload => payload.client_access_enabled === true);
  t.after(s.release);
  const pending = s.actions.setProjectAccessAction({}, form({ project_id: projectId, enabled: true }));
  await s.blocked;
  for (const owner of [otherClientId, clientId]) {
    assert.ok((await s.actions.assignProjectClientAction({}, form({ project_id: projectId, client_id: owner }))).success);
  }
  s.release();
  const stale = await pending;
  assert.ok(stale.error, 'matching owner IDs cannot bypass the changed project version');
  assert.equal(stale.success, undefined);
  assert.equal(s.db.tables.client_projects[0].client_id, clientId);
  assert.equal(s.db.tables.client_projects[0].client_access_enabled, false);
});
