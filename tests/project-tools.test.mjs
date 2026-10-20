import test from 'node:test';
import assert from 'node:assert/strict';

import { buildProjectTools } from '../src/lib/projects/tools.mjs';

const capability = (capability_key, state = 'active', extra = {}) => ({
  capability_key,
  state,
  launch_url: null,
  validated_at: null,
  metadata: {},
  ...extra,
});

const project = (extra = {}) => ({
  id: '11111111-1111-4111-8111-111111111111',
  client_id: '22222222-2222-4222-8222-222222222222',
  slug: 'first-site',
  name: 'First Site',
  domain: 'example.com',
  status: 'active',
  client_access_enabled: true,
  hosting_label: 'Managed',
  hosting_management_url: null,
  analytics_registry_key: 'first-site',
  capabilities: [],
  ...extra,
});

const byId = tools => Object.fromEntries(tools.map(tool => [tool.id, tool]));

test('active Blogger uses the authorized internal route and exposes no runtime configuration', () => {
  const input = project({ capabilities: [capability('blogger', 'active', {
    launch_url: 'https://admin.webfuengirola.com/paneladmin/blogger/first-site',
    validated_at: '2026-10-20T10:00:00Z',
    metadata: { token: 'never-render', adapter: 'secret-runtime' },
  })] });

  const tool = byId(buildProjectTools({ project: input, viewer: 'admin' })).blogger;

  assert.deepEqual(tool, {
    id: 'blogger',
    label: 'Blogger',
    href: '/paneladmin/blogger/first-site',
    state: 'active',
    audience: 'both',
  });
  assert.equal(JSON.stringify(tool).includes('never-render'), false);
  assert.equal(JSON.stringify(tool).includes('admin.webfuengirola.com'), false);
});

test('active analytics uses the exact project internal route for each viewer', () => {
  const input = project({ capabilities: [capability('analytics')] });

  assert.equal(byId(buildProjectTools({ project: input, viewer: 'admin' })).analytics.href,
    '/paneladmin/proyectos/11111111-1111-4111-8111-111111111111/estadisticas');
  assert.equal(byId(buildProjectTools({ project: input, viewer: 'client' })).analytics.href,
    '/cliente/proyectos/first-site/estadisticas');
});

test('available and unavailable tools remain visible but cannot launch for administrators', () => {
  const tools = byId(buildProjectTools({
    project: project({ capabilities: [
      capability('domains', 'available', { launch_url: 'https://example.com/private' }),
      capability('hosting', 'unavailable'),
    ] }),
    viewer: 'admin',
  }));

  assert.deepEqual({ state: tools.domains.state, href: tools.domains.href }, { state: 'available', href: null });
  assert.deepEqual({ state: tools.hosting.state, href: tools.hosting.href }, { state: 'unavailable', href: null });
});

test('configuration issues fail closed and are visible only to administrators', () => {
  const input = project({ capabilities: [capability('analytics')] });
  const configurationIssues = { analytics: 'Falta la configuración del registro de analítica.' };

  const adminTool = byId(buildProjectTools({ project: input, viewer: 'admin', configurationIssues })).analytics;
  const clientTools = buildProjectTools({ project: input, viewer: 'client', configurationIssues });

  assert.deepEqual(adminTool, {
    id: 'analytics',
    label: 'Estadísticas',
    href: null,
    state: 'misconfigured',
    audience: 'both',
    warning: 'Falta la configuración del registro de analítica.',
  });
  assert.equal(clientTools.some(tool => tool.id === 'analytics'), false);
});

test('configuration and assignment tools are inspectable by administrators only', () => {
  const input = project({ capabilities: [
    capability('domains', 'available'),
    capability('hosting', 'unavailable'),
  ] });

  const adminTools = byId(buildProjectTools({ project: input, viewer: 'admin' }));
  const clientTools = buildProjectTools({ project: input, viewer: 'client' });

  assert.equal(adminTools.client.audience, 'admin');
  assert.equal(adminTools.client.href, '/paneladmin/clientes/22222222-2222-4222-8222-222222222222');
  assert.ok(adminTools.domains);
  assert.ok(adminTools.hosting);
  assert.equal(clientTools.some(tool => ['client', 'domains', 'hosting'].includes(tool.id)), false);
});

test('clients receive only active permitted tools on active client-visible projects', () => {
  const capabilities = [
    capability('blogger', 'active', {
      launch_url: 'https://example.com/admin/blogger/',
      validated_at: '2026-10-20T10:00:00Z',
    }),
    capability('analytics'),
    capability('invoices'),
    capability('bonuses_reports'),
    capability('domains', 'available'),
  ];
  const visible = buildProjectTools({ project: project({ capabilities }), viewer: 'client' });

  assert.deepEqual(visible.map(tool => tool.id), ['website', 'blogger', 'analytics', 'invoices', 'reports', 'bonuses']);
  assert.ok(visible.every(tool => tool.state === 'active' && tool.href));
  assert.deepEqual(buildProjectTools({ project: project({ status: 'archived', capabilities }), viewer: 'client' }), []);
  assert.deepEqual(buildProjectTools({ project: project({ client_access_enabled: false, capabilities }), viewer: 'client' }), []);
});

test('invalid Blogger configuration is disabled for administrators and omitted for clients', () => {
  const input = project({ capabilities: [capability('blogger', 'active', {
    launch_url: 'https://evil.example/admin',
    validated_at: '2026-10-20T10:00:00Z',
  })] });

  const adminTool = byId(buildProjectTools({ project: input, viewer: 'admin' })).blogger;
  assert.equal(adminTool.state, 'misconfigured');
  assert.equal(adminTool.href, null);
  assert.ok(adminTool.warning);
  assert.equal(buildProjectTools({ project: input, viewer: 'client' }).some(tool => tool.id === 'blogger'), false);
});

test('rejects unknown viewers instead of defaulting to administrator visibility', () => {
  assert.throws(() => buildProjectTools({ project: project(), viewer: 'owner' }), /viewer/i);
});
