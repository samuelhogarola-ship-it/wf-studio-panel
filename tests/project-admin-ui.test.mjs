import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadProjectModule, database, boundary, project, capability, client, projectId } from './helpers/project-harness.mjs';

const render = element => renderToStaticMarkup(element);
function setup(seed = {}) {
  const b = boundary(database(seed));
  return relative => loadProjectModule(relative, b.mocks);
}

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
        validated_at: project.created_at,
      },
      { ...capability, id: 'domains', capability_key: 'domains', state: 'available' },
    ],
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
  const load = setup();
  const { ProjectToolGrid } = load('src/components/admin/project-tool-grid.tsx');
  const workspaceProject = {
    ...project,
    capabilities: [
      {
        ...capability,
        state: 'active',
        launch_url: 'https://admin.webfuengirola.com/paneladmin/blogger/example',
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
      validated_at: project.created_at,
    }],
  });
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

test('access preview includes only assigned visible projects and exact dynamic links', async () => {
  const load = setup({ clients: [{ ...client, portal_mode: 'dynamic' }], client_projects: [project, { ...project, id: 'other', slug: 'foreign', name: 'Foreign', client_id: 'foreign-client' }], project_capabilities: [{ ...capability, capability_key: 'invoices', state: 'active' }] });
  const Page = load('src/app/paneladmin/(protected)/proyectos/[id]/page.tsx').default;
  const html = render(await Page({ params: Promise.resolve({ id: projectId }) }));
  assert.match(html, /Vista previa/);
  assert.match(html, /href="\/cliente\/facturas"/);
  assert.doesNotMatch(html, /Foreign|\/cliente\/informes/);
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
        validated_at: '2026-10-20T10:00:00Z',
      },
      { ...capability, id: 'analytics', capability_key: 'analytics', state: 'available' },
    ],
  }, {
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
