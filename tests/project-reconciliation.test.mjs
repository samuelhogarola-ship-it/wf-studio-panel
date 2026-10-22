import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { reconcileProjectsWithRegistry } from '../src/lib/projects/reconciliation.mjs';
import { boundary, database, loadProjectModule, project } from './helpers/project-harness.mjs';

const sites = [
  { key: 'sportmassagefuengirola', name: 'Sport Massage Fuengirola', domain: 'sportmassagefuengirola.com' },
  { key: 'agama', name: 'aGama', domain: 'agama.com.mx' },
  { key: 'samuelcoachdealeman', name: 'Samuel Coach', domain: 'samuelcoachdealeman.com' },
];

const projectFor = (site, overrides = {}) => ({
  id: `project-${site.key}`,
  name: site.name,
  slug: site.key,
  domain: site.domain,
  analytics_registry_key: site.key,
  client_id: null,
  client_access_enabled: false,
  capabilities: [],
  ...overrides,
});

test('reports each missing flagship registered site as a project warning', () => {
  for (const missingSite of sites) {
    const projects = sites.filter(site => site !== missingSite).map(site => projectFor(site));
    const issues = reconcileProjectsWithRegistry(projects, sites);

    assert.deepEqual(issues, [{
      kind: 'missing-project',
      siteKey: missingSite.key,
      message: `El sitio registrado ${missingSite.name} (${missingSite.domain}) no tiene proyecto.`,
    }]);
  }
});

test('matches unkeyed projects by normalized domains and tolerates www differences', () => {
  const projects = sites.map(site => projectFor(site, {
    analytics_registry_key: null,
    domain: `www.${site.domain.toUpperCase()}`,
  }));

  assert.deepEqual(reconcileProjectsWithRegistry(projects, sites), []);
});

test('reports unknown registry keys and keyed domain mismatches without mutating project data', () => {
  const assignments = { owner: 'client-1' };
  const capabilities = [{ capability_key: 'blogger', state: 'active' }];
  const projects = [
    projectFor(sites[0], { client_id: assignments.owner, capabilities }),
    projectFor(sites[1], { domain: 'wrong.example.com' }),
    projectFor({ key: 'retired-site', name: 'Retired', domain: 'retired.example.com' }),
  ];
  const before = structuredClone(projects);

  const issues = reconcileProjectsWithRegistry(projects, sites);

  assert.deepEqual(issues.map(issue => ({
    kind: issue.kind,
    projectId: issue.projectId,
    siteKey: issue.siteKey,
  })), [
    { kind: 'domain-mismatch', projectId: 'project-agama', siteKey: 'agama' },
    { kind: 'missing-registry-site', projectId: 'project-retired-site', siteKey: 'retired-site' },
    { kind: 'missing-project', projectId: undefined, siteKey: 'samuelcoachdealeman' },
  ]);
  assert.deepEqual(projects, before);
  assert.equal(projects[0].client_id, assignments.owner);
  assert.equal(projects[0].capabilities, capabilities);
});

test('the administrator catalog appends reconciliation warnings without database writes', async () => {
  const db = database({ client_projects: [project] });
  const load = relative => loadProjectModule(relative, boundary(db).mocks);
  const Page = load('src/app/paneladmin/(protected)/proyectos/page.tsx').default;

  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));

  assert.match(html, /data-project-registry-issues/);
  assert.match(html, /Avisos del registro de sitios/);
  assert.ok(db.calls.length > 0);
  assert.ok(db.calls.every(call => call.operation === 'select'));
});
