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
