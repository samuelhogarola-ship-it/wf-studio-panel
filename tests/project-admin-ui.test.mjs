import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadProjectModule, database, boundary, project, capability, client, projectId, form } from './helpers/project-harness.mjs';

const render = element => renderToStaticMarkup(element);
function setup(seed = {}, extra = {}) {
  const b = boundary(database(seed), extra);
  return relative => loadProjectModule(relative, b.mocks);
}

const configuredAnalytics = {
  '@/lib/analytics/umami-core.mjs': {
    getConfiguredUmamiSites: () => [{
      key: 'example',
      domain: 'example.com',
      websiteId: 'example-runtime-id',
      source: 'personal',
    }],
    getUmamiConnections: () => ({
      personal: { baseUrl: 'https://stats.example.test', password: 'runtime-secret' },
    }),
  },
};

const configuredBloggerRuntime = {
  '@/lib/sites/registry.mjs': {
    getSites: () => [{ key: 'example', name: 'Example', domain: 'example.com' }],
    getSiteByKey: () => ({ key: 'example', name: 'Example', domain: 'example.com', blogger: { enabled: true, runtime: 'central-multisite' } }),
  },
  '@/lib/blogger/editor.mjs': {
    getBloggerEditorTarget: () => ({ kind: 'iframe', href: '/blogger/editor/index.html?siteKey=example' }),
  },
};
const configuredBlogger = {
  ...configuredBloggerRuntime,
  '@/lib/locale': { getLocale: async () => 'en' },
};

test('inventory renders database projects, search/filter controls and manual registration', async () => {
  const load = setup();
  const Page = load('src/app/paneladmin/(protected)/proyectos/page.tsx').default;
  const html = render(await Page({ searchParams: Promise.resolve({ q: 'Example', status: 'active' }) }));
  assert.match(html, /Example/);
  assert.match(html, /example\.com/);
  assert.match(html, /Ana/);
  assert.match(html, /Managed/);
  assert.match(html, /name="q"/);
  for (const name of ['client', 'status', 'capability']) assert.match(html, new RegExp(`name="${name}"`));
  assert.match(html, new RegExp(`/paneladmin/proyectos/${projectId}`));
  assert.match(html, /Registrar proyecto/);
});

test('inventory turns arbitrary database projects into capability-driven launch cards with favorite controls', async () => {
  const catalogProject = {
    ...project,
    name: 'North Star Bakery',
    slug: 'north-star-bakery',
    domain: 'northstar.example',
  };
  const load = setup({
    client_projects: [catalogProject],
    admin_project_favorites: [{ admin_user_id: 'admin-id', project_id: projectId, position: 1, created_at: project.created_at }],
    project_capabilities: [
      {
        ...capability,
        state: 'active',
        launch_url: 'https://admin.webfuengirola.com/paneladmin/blogger/north-star-bakery',
        metadata: { provisioning_confirmed: true },
        validated_at: project.created_at,
      },
      { ...capability, id: 'domains', capability_key: 'domains', state: 'available' },
    ],
  }, {
    '@/lib/sites/registry.mjs': {
      getSites: () => [{ key: 'north-star-bakery', name: 'North Star Bakery', domain: 'northstar.example' }],
      getSiteByKey: () => ({ key: 'north-star-bakery', name: 'North Star Bakery', domain: 'northstar.example', blogger: { enabled: true, runtime: 'central-multisite' } }),
    },
    '@/lib/blogger/editor.mjs': {
      getBloggerEditorTarget: () => ({ kind: 'iframe', href: '/blogger/editor/index.html?siteKey=north-star-bakery' }),
    },
  });
  const Page = load('src/app/paneladmin/(protected)/proyectos/page.tsx').default;

  const html = render(await Page({ searchParams: Promise.resolve({}) }));
  const card = html.slice(html.indexOf('North Star Bakery'), html.indexOf('Registrar proyecto'));

  assert.match(card, /data-capability-badge="blogger"[^>]*data-state="active"/);
  assert.match(card, /data-capability-badge="domains"[^>]*data-state="available"/);
  assert.match(card, /href="https:\/\/northstar\.example"[^>]*>Sitio web/);
  assert.match(card, /href="\/paneladmin\/blogger\/north-star-bakery"[^>]*>Blogger/);
  assert.match(card, /Quitar de Inicio/);
});

test('project tool grid labels every state and disables incomplete tools', () => {
  const load = setup({}, configuredBloggerRuntime);
  const { ProjectToolGrid } = load('src/components/admin/project-tool-grid.tsx');
  const workspaceProject = {
    ...project,
    capabilities: [
      {
        ...capability,
        state: 'active',
        launch_url: 'https://admin.webfuengirola.com/paneladmin/blogger/example',
        metadata: { provisioning_confirmed: true },
        validated_at: project.created_at,
      },
      { ...capability, id: 'domains', capability_key: 'domains', state: 'available' },
      { ...capability, id: 'hosting', capability_key: 'hosting', state: 'unavailable' },
      { ...capability, id: 'analytics', capability_key: 'analytics', state: 'active' },
    ],
  };

  const html = render(React.createElement(ProjectToolGrid, { project: workspaceProject }));

  for (const state of ['active', 'available', 'unavailable', 'misconfigured']) {
    assert.match(html, new RegExp(`data-tool-state="${state}"`));
  }
  assert.match(html, /<article[^>]*data-project-tool=/);
  assert.match(html, /data-project-tool="blogger"[^>]*data-tool-state="active"[\s\S]*href="\/paneladmin\/blogger\/example"/);
  for (const tool of ['domains', 'hosting', 'analytics']) {
    const start = html.lastIndexOf('<article', html.indexOf(`data-project-tool="${tool}"`));
    const toolCard = html.slice(start, html.indexOf('</article>', start));
    assert.match(toolCard, /<button[^>]*disabled/);
  }
});

test('analytics tool links to the exact project route only when active and correctly configured', () => {
  const configuredBoundary = boundary(database(), configuredAnalytics);
  const configuredLoad = relative => loadProjectModule(relative, configuredBoundary.mocks);
  const { ProjectToolGrid: ConfiguredGrid } = configuredLoad('src/components/admin/project-tool-grid.tsx');
  const analyticsCapability = { ...capability, id: 'analytics', capability_key: 'analytics' };
  const analyticsProject = { ...project, analytics_registry_key: 'example' };

  const activeHtml = render(React.createElement(ConfiguredGrid, {
    project: { ...analyticsProject, capabilities: [{ ...analyticsCapability, state: 'active' }] },
  }));
  const availableHtml = render(React.createElement(ConfiguredGrid, {
    project: { ...analyticsProject, capabilities: [{ ...analyticsCapability, state: 'available' }] },
  }));
  const archivedHtml = render(React.createElement(ConfiguredGrid, {
    project: { ...analyticsProject, status: 'archived', capabilities: [{ ...analyticsCapability, state: 'active' }] },
  }));
  const archivedAnalyticsStart = archivedHtml.lastIndexOf('<article', archivedHtml.indexOf('data-project-tool="analytics"'));
  const archivedAnalyticsCard = archivedHtml.slice(archivedAnalyticsStart, archivedHtml.indexOf('</article>', archivedAnalyticsStart));

  assert.match(activeHtml, new RegExp(`data-project-tool="analytics"[\\s\\S]*href="/paneladmin/proyectos/${projectId}/estadisticas"`));
  assert.doesNotMatch(availableHtml, /href="[^"]*\/estadisticas"/);
  assert.match(archivedAnalyticsCard, /data-tool-state="unavailable"/);
  assert.match(archivedAnalyticsCard, /<button[^>]*disabled/);
  assert.doesNotMatch(archivedAnalyticsCard, /href="[^"]*\/estadisticas"/);

  const misconfiguredBoundary = boundary(database(), {
    '@/lib/analytics/umami-core.mjs': {
      getConfiguredUmamiSites: () => [],
      getUmamiConnections: () => ({}),
    },
  });
  const misconfiguredLoad = relative => loadProjectModule(relative, misconfiguredBoundary.mocks);
  const { ProjectToolGrid: MisconfiguredGrid } = misconfiguredLoad('src/components/admin/project-tool-grid.tsx');
  const misconfiguredHtml = render(React.createElement(MisconfiguredGrid, {
    project: { ...analyticsProject, capabilities: [{ ...analyticsCapability, state: 'active' }] },
  }));

  assert.match(misconfiguredHtml, /data-project-tool="analytics"[^>]*data-tool-state="misconfigured"/);
  assert.doesNotMatch(misconfiguredHtml, /href="[^"]*\/estadisticas"/);
});

test('active domains and hosting render disabled actions instead of dead workspace fragments', () => {
  const load = setup();
  const { ProjectToolGrid } = load('src/components/admin/project-tool-grid.tsx');
  const workspaceProject = {
    ...project,
    capabilities: [
      { ...capability, id: 'domains', capability_key: 'domains', state: 'active' },
      { ...capability, id: 'hosting', capability_key: 'hosting', state: 'active' },
    ],
  };

  const html = render(React.createElement(ProjectToolGrid, { project: workspaceProject }));

  for (const tool of ['domains', 'hosting']) {
    const start = html.lastIndexOf('<article', html.indexOf(`data-project-tool="${tool}"`));
    const toolCard = html.slice(start, html.indexOf('</article>', start));
    assert.match(toolCard, /data-tool-state="active"/);
    assert.match(toolCard, /<button[^>]*disabled/);
    assert.match(toolCard, /Sin acceso operativo/);
    assert.doesNotMatch(toolCard, new RegExp(`href="[^"]*#${tool}"`));
  }
});

test('detail renders seven capability cards, provisioning warnings and attributable audit transitions', async () => {
  const load = setup({ project_capability_audit: [{ id: 'audit', project_id: projectId, capability_key: 'blogger', actor_id: 'admin-actor', operation: 'UPDATE', old_record: { state: 'available' }, new_record: { state: 'active' }, created_at: project.created_at }] });
  const Page = load('src/app/paneladmin/(protected)/proyectos/[id]/page.tsx').default;
  const html = render(await Page({ params: Promise.resolve({ id: projectId }) }));
  for (const key of ['products', 'domains', 'hosting', 'invoices', 'bonuses_reports', 'blogger', 'analytics']) assert.match(html, new RegExp(`data-capability="${key}"`));
  assert.match(html, /admin-actor/);
  assert.match(html, /available.*active/);
  assert.match(html, /UPDATE/);
  assert.match(html, /2026/);
  assert.match(html, /validaci[oó]n/i);
  assert.match(html, /anal[ií]tica/i);
});

test('detail prioritizes identity and operational work before access, warnings, configuration and audit', async () => {
  const load = setup({
    admin_project_favorites: [{ admin_user_id: 'admin-id', project_id: projectId, position: 1, created_at: project.created_at }],
    project_capabilities: [{
      ...capability,
      state: 'active',
      launch_url: 'https://admin.webfuengirola.com/paneladmin/blogger/example',
      metadata: { provisioning_confirmed: true },
      validated_at: project.created_at,
    }],
  }, configuredBloggerRuntime);
  const Page = load('src/app/paneladmin/(protected)/proyectos/[id]/page.tsx').default;

  const html = render(await Page({ params: Promise.resolve({ id: projectId }) }));
  const sections = ['identity', 'tools', 'client-access', 'warnings', 'configuration', 'audit'];
  const positions = sections.map(section => html.indexOf(`data-workspace-section="${section}"`));

  assert.ok(positions.every(position => position >= 0), `missing workspace section: ${positions}`);
  assert.deepEqual(positions, [...positions].sort((left, right) => left - right));
  assert.match(html.slice(positions[0], positions[1]), /Example[\s\S]*example\.com[\s\S]*Quitar de Inicio/);
  assert.match(html.slice(positions[1], positions[2]), /href="https:\/\/example\.com"[^>]*>Sitio web/);
  assert.match(html.slice(positions[1], positions[2]), /href="\/paneladmin\/blogger\/example"[^>]*>Blogger/);
  assert.match(html, /<details[^>]*data-workspace-section="configuration"[^>]*>[\s\S]*Configuración del proyecto/);
});

test('new catalog and workspace controls respect the selected administrator locale', async () => {
  const b = boundary(database());
  const load = relative => loadProjectModule(relative, {
    ...b.mocks,
    '@/lib/locale': { getLocale: async () => 'en' },
  });
  const CatalogPage = load('src/app/paneladmin/(protected)/proyectos/page.tsx').default;
  const DetailPage = load('src/app/paneladmin/(protected)/proyectos/[id]/page.tsx').default;

  const catalog = render(await CatalogPage({ searchParams: Promise.resolve({}) }));
  const detail = render(await DetailPage({ params: Promise.resolve({ id: projectId }) }));

  assert.match(catalog, />Open project</);
  assert.match(detail, /Operational project/);
  assert.match(detail, />Tools</);
  assert.match(detail, /Configuration warnings/);
});

test('access preview includes only assigned visible projects and universal account links', async () => {
  const load = setup({ clients: [{ ...client, portal_mode: 'dynamic' }], client_projects: [project, { ...project, id: 'other', slug: 'foreign', name: 'Foreign', client_id: 'foreign-client' }], project_capabilities: [{ ...capability, capability_key: 'invoices', state: 'active' }] });
  const Page = load('src/app/paneladmin/(protected)/proyectos/[id]/page.tsx').default;
  const html = render(await Page({ params: Promise.resolve({ id: projectId }) }));
  assert.match(html, /Vista previa/);
  for (const href of ['dashboard', 'proyectos', 'informes', 'actualizaciones', 'fotografias', 'servicios', 'pendientes', 'facturas', 'historial', 'mensajeria']) {
    assert.match(html, new RegExp(`href="/cliente/${href}"`));
  }
  assert.doesNotMatch(html, /Foreign/);
  assert.match(html, /Invitar cliente/);
});

test('forms expose explicit capability state, provisioning and separate assignment/access/mode actions', () => {
  const load = setup();
  const { ProjectCapabilitiesForm } = load('src/components/admin/project-capabilities-form.tsx');
  const { ProjectClientAccessForm } = load('src/components/admin/project-client-access-form.tsx');
  const capabilities = render(React.createElement(ProjectCapabilitiesForm, { project, locale: 'en' }));
  assert.equal((capabilities.match(/data-capability=/g) ?? []).length, 7);
  for (const state of ['unavailable', 'available', 'active']) assert.match(capabilities, new RegExp(`value="${state}"`));
  assert.match(capabilities, /name="provisioning_confirmed"/);
  const access = render(React.createElement(ProjectClientAccessForm, { project, clients: [client], locale: 'en' }));
  for (const field of ['client_id', 'enabled', 'portal_mode']) assert.match(access, new RegExp(`name="${field}"`));
  assert.match(access, /dynamic/);
});

test('project form renders the four product tier choices', () => {
  const load = setup();
  const { ProjectForm } = load('src/components/admin/project-form.tsx');
  const html = render(React.createElement(ProjectForm, { project, locale: 'es' }));

  const select = html.slice(html.indexOf('name="product_tier"'), html.indexOf('</select>', html.indexOf('name="product_tier"')));
  assert.match(select, /value=""[^>]*>Por confirmar<\/option>/);
  assert.match(select, /value="lite">Lite<\/option>/);
  assert.match(select, /value="express">Express<\/option>/);
  assert.match(select, /value="pro">Pro<\/option>/);
});

test('project action accepts only exact product tiers and persists an empty choice as null', async () => {
  for (const [value, expected] of [['', null], ['lite', 'lite'], ['express', 'express'], ['pro', 'pro']]) {
    const db = database({ client_projects: [] });
    const load = relative => loadProjectModule(relative, boundary(db).mocks);
    const { upsertProjectAction } = load('src/lib/actions/projects.ts');
    const result = await upsertProjectAction({}, form({
      slug: `tier-${value || 'null'}`,
      name: 'Tier project',
      domain: 'example.com',
      status: 'draft',
      product_tier: value,
    }));

    assert.ok(result.success, `expected ${value || 'empty'} to be accepted`);
    const write = db.calls.find(call => call.table === 'client_projects' && call.operation === 'insert');
    assert.equal(write.payload.product_tier, expected);
  }

  const db = database({ client_projects: [] });
  const load = relative => loadProjectModule(relative, boundary(db).mocks);
  const { upsertProjectAction } = load('src/lib/actions/projects.ts');
  const result = await upsertProjectAction({}, form({
    slug: 'tier-enterprise',
    name: 'Tier project',
    domain: 'example.com',
    status: 'draft',
    product_tier: 'enterprise',
  }));

  assert.ok(result.error);
  assert.equal(db.calls.some(call => call.table === 'client_projects' && ['insert', 'update'].includes(call.operation)), false);
});

test('capability controls show their own configuration validation result', () => {
  const load = setup();
  const { ProjectCapabilitiesForm } = load('src/components/admin/project-capabilities-form.tsx');
  const html = render(React.createElement(ProjectCapabilitiesForm, {
    project,
    capabilities: [
      { ...capability, capability_key: 'blogger', launch_url: 'https://admin.webfuengirola.com/paneladmin/blogger/example' },
      { ...capability, id: 'analytics', capability_key: 'analytics' },
    ],
    validationIssues: { blogger: 'blogger', analytics: null },
    locale: 'en',
  }));
  const blogger = html.slice(html.indexOf('data-capability="blogger"'), html.indexOf('data-capability="analytics"'));
  const analytics = html.slice(html.indexOf('data-capability="analytics"'));

  assert.match(blogger, /data-capability-validation="invalid"/);
  assert.match(blogger, /Blogger: missing destination, validation or provisioning confirmation/);
  assert.match(analytics, /data-capability-validation="valid"/);
  assert.match(analytics, /Configuration ready/);
});

test('project detail supplies default-row validation to all seven controls when capability rows are absent', async () => {
  const load = setup({ project_capabilities: [] });
  const Page = load('src/app/paneladmin/(protected)/proyectos/[id]/page.tsx').default;
  const html = render(await Page({ params: Promise.resolve({ id: projectId }) }));
  const blogger = html.slice(html.indexOf('data-capability="blogger"'), html.indexOf('data-capability="analytics"'));
  const analytics = html.slice(html.indexOf('data-capability="analytics"'));

  assert.equal((html.match(/data-capability-validation=/g) ?? []).length, 7);
  assert.equal((html.match(/data-capability-validation="invalid"/g) ?? []).length, 2);
  assert.match(blogger, /data-capability-validation="invalid"/);
  assert.match(analytics, /data-capability-validation="invalid"/);
});

test('project detail does not show Blogger ready when saved provisioning confirmation is absent', async () => {
  const load = setup({
    project_capabilities: [{
      ...capability,
      state: 'active',
      launch_url: 'https://admin.webfuengirola.com/paneladmin/blogger/example',
      validated_at: project.created_at,
      metadata: {},
    }],
  }, configuredBlogger);
  const Page = load('src/app/paneladmin/(protected)/proyectos/[id]/page.tsx').default;
  const html = render(await Page({ params: Promise.resolve({ id: projectId }) }));
  const blogger = html.slice(html.indexOf('data-capability="blogger"'), html.indexOf('data-capability="analytics"'));

  assert.match(blogger, /data-capability-validation="invalid"/);
  assert.match(blogger, /Blogger: missing destination, validation or provisioning confirmation/);
  assert.doesNotMatch(blogger, /Configuration ready/);
});

test('unknown project detail returns a non-revealing 404', async () => {
  const load = setup();
  const Page = load('src/app/paneladmin/(protected)/proyectos/[id]/page.tsx').default;
  await assert.rejects(() => Page({ params: Promise.resolve({ id: 'unknown' }) }), /^Error: 404$/);
});

test('administrator home renders favorite projects as validated launcher cards above product panels', async () => {
  const favorite = {
    admin_user_id: 'admin-id',
    project_id: projectId,
    position: 1,
    created_at: '2026-10-20T10:00:00Z',
  };
  const load = setup({
    admin_project_favorites: [favorite],
    project_capabilities: [
      {
        ...capability,
        state: 'active',
        launch_url: 'https://admin.webfuengirola.com/paneladmin/blogger/example',
        metadata: { provisioning_confirmed: true },
        validated_at: '2026-10-20T10:00:00Z',
      },
      { ...capability, id: 'analytics', capability_key: 'analytics', state: 'available' },
    ],
  }, {
    ...configuredBloggerRuntime,
    react: { ...React, useActionState: () => [{}, () => {}, false] },
  });
  const Page = load('src/app/paneladmin/(protected)/inicio/page.tsx').default;

  const html = render(await Page());
  const favoriteSection = html.slice(html.indexOf('Favoritos'), html.indexOf('WF-Studio'));

  assert.ok(html.indexOf('Favoritos') < html.indexOf('WF-Studio'));
  assert.match(favoriteSection, /Example/);
  assert.match(favoriteSection, /example\.com/);
  assert.match(favoriteSection, /Ana/);
  assert.match(favoriteSection, /Activo/);
  assert.match(favoriteSection, /Acceso habilitado/);
  assert.match(favoriteSection, new RegExp(`href="/paneladmin/proyectos/${projectId}"[^>]*>Abrir proyecto`));
  assert.match(favoriteSection, /href="\/paneladmin\/blogger\/example"[^>]*>Blogger/);
  assert.match(favoriteSection, /href="https:\/\/example\.com"[^>]*>Sitio web/);
  assert.doesNotMatch(favoriteSection, /Estadísticas/);
  assert.match(favoriteSection, /Quitar de Inicio/);
  assert.match(favoriteSection, /href="\/paneladmin\/proyectos"[^>]*>Ver todos los proyectos/);
});

test('administrator home empty favorites state points to the canonical Projects catalog', async () => {
  const load = setup({}, {
    react: { ...React, useActionState: () => [{}, () => {}, false] },
  });
  const Page = load('src/app/paneladmin/(protected)/inicio/page.tsx').default;

  const html = render(await Page());

  assert.match(html, /Todavía no tienes proyectos favoritos/);
  assert.match(html, /Añade proyectos desde el catálogo para tener sus herramientas a mano\./);
  assert.match(html, /href="\/paneladmin\/proyectos"[^>]*>Ver todos los proyectos/);
});
