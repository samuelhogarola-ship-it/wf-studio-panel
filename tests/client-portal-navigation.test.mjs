import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPortalNavigation } from '../src/lib/projects/portal-navigation.mjs';

const capability = (capability_key, state = 'active', extra = {}) => ({ capability_key, state, ...extra });
const project = (extra = {}) => ({
  id: 'p1', slug: 'first-site', name: 'First Site', domain: 'example.com', status: 'active',
  client_access_enabled: true, capabilities: [], ...extra,
});
const dynamic = (projects, locale = 'es') => buildPortalNavigation({ mode: 'dynamic', projects, locale });

test('legacy preserves every existing navigation destination, order and localized label', () => {
  const hrefs = ['/cliente/informes', '/cliente/actualizaciones', '/cliente/fotografias',
    '/cliente/dashboard', '/cliente/servicios', '/cliente/pendientes', '/cliente/facturas',
    '/cliente/historial', '/cliente/mensajeria'];
  for (const [locale, labels] of [
    ['es', ['Informes', 'Actualizaciones', 'Fotografías', 'Resumen', 'Servicios', 'Pendientes', 'Facturas', 'Historial', 'Mensajería']],
    ['en', ['Reports', 'Updates', 'Photos', 'Overview', 'Services', 'Pending', 'Invoices', 'History', 'Messages']],
  ]) {
    const items = buildPortalNavigation({ mode: 'legacy', projects: [project()], locale });
    assert.deepEqual(items.map(item => item.href), hrefs);
    assert.deepEqual(items.map(item => item.label), labels);
  }
});

test('empty dynamic navigation keeps only overview, pending actions and messages', () => {
  assert.deepEqual(dynamic([]).map(item => item.href), ['/cliente/dashboard', '/cliente/pendientes', '/cliente/mensajeria']);
});

test('only active capabilities on active client-visible projects contribute items', () => {
  const items = dynamic([
    project({ capabilities: [capability('invoices', 'available'), capability('blogger', 'unavailable'), capability('analytics')] }),
    project({ id: 'archived', status: 'archived', capabilities: [capability('invoices')] }),
    project({ id: 'draft', status: 'draft', capabilities: [capability('invoices')] }),
    project({ id: 'hidden', client_access_enabled: false, capabilities: [capability('invoices')] }),
  ]);
  assert.deepEqual(items.map(item => item.href), ['/cliente/dashboard', '/cliente/pendientes', '/cliente/mensajeria', '/cliente/proyectos/first-site/estadisticas']);
});

test('deduplicates client-owned invoices and reports/packs across projects', () => {
  const caps = [capability('invoices'), capability('bonuses_reports')];
  const items = dynamic([project({ capabilities: caps }), project({ id: 'p2', slug: 'second-site', capabilities: caps })]);
  assert.deepEqual(items.slice(3).map(item => item.href), [
    '/cliente/facturas', '/cliente/bonos', '/cliente/packs', '/cliente/historial', '/cliente/informes',
  ]);
  assert.equal(new Set(items.map(item => item.id)).size, items.length);
});

test('Blogger preserves validated direct URLs and statistics identify each project', () => {
  const url = 'https://www.example.com/admin/blog/?next=%2fposts#edit';
  const items = dynamic([
    project({ capabilities: [capability('blogger', 'active', { launch_url: url, validated_at: '2026-10-17T10:00:00Z' }), capability('analytics')] }),
    project({ id: 'p2', slug: 'second/site', name: 'Second Site', capabilities: [capability('analytics')] }),
  ]);
  assert.deepEqual(items.slice(3).map(({ href, label, projectId }) => ({ href, label, projectId })), [
    { href: url, label: 'Blogger · First Site', projectId: 'p1' },
    { href: '/cliente/proyectos/first-site/estadisticas', label: 'Estadísticas · First Site', projectId: 'p1' },
    { href: '/cliente/proyectos/second%2Fsite/estadisticas', label: 'Estadísticas · Second Site', projectId: 'p2' },
  ]);
});

test('hides missing, unvalidated and unsafe Blogger destinations', () => {
  for (const extra of [{}, { launch_url: 'https://example.com/admin' },
    { launch_url: 'http://example.com/admin', validated_at: 'today' },
    { launch_url: 'https://foreign.com/admin', validated_at: 'today' }]) {
    assert.equal(dynamic([project({ capabilities: [capability('blogger', 'active', extra)] })]).length, 3);
  }
});

test('localizes dynamic services and tools and ignores unknown capability keys/states', () => {
  const caps = ['products', 'domains', 'hosting', 'invoices', 'bonuses_reports', 'analytics'].map(key => capability(key));
  caps.push(capability('unknown'), capability('blogger', 'unexpected'));
  const projects = [project({ capabilities: caps })];
  assert.deepEqual(dynamic(projects).map(item => item.label), [
    'Resumen', 'Pendientes', 'Mensajería', 'Facturas', 'Bonos', 'Packs', 'Historial', 'Informes',
    'Productos · First Site', 'Dominios · First Site', 'Hosting · First Site', 'Estadísticas · First Site',
  ]);
  assert.deepEqual(dynamic(projects, 'en').map(item => item.label), [
    'Overview', 'Pending', 'Messages', 'Invoices', 'Hours', 'Packs', 'History', 'Reports',
    'Products · First Site', 'Domains · First Site', 'Hosting · First Site', 'Statistics · First Site',
  ]);
  assert.deepEqual(dynamic(projects).slice(8, 11).map(item => item.href), [
    '/cliente/proyectos/first-site#products', '/cliente/proyectos/first-site#domains', '/cliente/proyectos/first-site#hosting',
  ]);
});

test('returns fresh immutable serializable data without freezing or exposing input metadata', () => {
  const projects = [project({ capabilities: [capability('invoices', 'active', { metadata: { secret: 'never-copy' } })] })];
  const before = structuredClone(projects);
  const items = dynamic(projects);
  assert.deepEqual(JSON.parse(JSON.stringify(items)), items);
  assert.ok(Object.isFrozen(items));
  assert.ok(items.every(Object.isFrozen));
  assert.throws(() => { items[0].label = 'changed'; }, TypeError);
  assert.deepEqual(projects, before);
  assert.equal(Object.isFrozen(projects[0]), false);
  assert.equal(JSON.stringify(items).includes('never-copy'), false);
  assert.notEqual(dynamic(projects), items);
});

test('fails closed for invalid modes instead of granting legacy navigation', () => {
  assert.throws(() => buildPortalNavigation({ mode: 'typo', projects: [], locale: 'es' }), /mode/i);
});
