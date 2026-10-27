import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPortalNavigation } from '../src/lib/projects/portal-navigation.mjs';

const capability = (capability_key, state = 'active', extra = {}) => ({ capability_key, state, ...extra });
const project = (extra = {}) => ({
  id: 'p1', slug: 'first-site', name: 'First Site', domain: 'example.com', status: 'active',
  client_access_enabled: true, capabilities: [], ...extra,
});
const navigation = (mode, projects, locale = 'es') => buildPortalNavigation({ mode, projects, locale });

test('historical modes expose the same universal account navigation with Inicio and Webs first', () => {
  const hrefs = ['/cliente/dashboard', '/cliente/proyectos', '/cliente/informes',
    '/cliente/actualizaciones', '/cliente/fotografias', '/cliente/servicios',
    '/cliente/pendientes', '/cliente/facturas', '/cliente/pagos', '/cliente/historial', '/cliente/mensajeria'];
  for (const [locale, labels] of [
    ['es', ['Inicio', 'Webs', 'Informes', 'Actualizaciones', 'Fotografías', 'Servicios', 'Pendientes', 'Facturas', 'Pagos', 'Historial', 'Mensajería']],
    ['en', ['Home', 'Websites', 'Reports', 'Updates', 'Photos', 'Services', 'Pending', 'Invoices', 'Payments', 'History', 'Messages']],
  ]) {
    const legacy = navigation('legacy', [project()], locale);
    const dynamic = navigation('dynamic', [project()], locale);
    assert.deepEqual(legacy, dynamic);
    assert.deepEqual(legacy.map(item => item.href), hrefs);
    assert.deepEqual(legacy.map(item => item.label), labels);
    assert.deepEqual(legacy.slice(0, 2).map(item => item.id), ['dashboard', 'projects']);
  }
});

test('zero projects still includes the universal Webs destination', () => {
  for (const mode of ['legacy', 'dynamic']) {
    assert.equal(navigation(mode, []).find(item => item.id === 'projects')?.href, '/cliente/proyectos');
  }
});

test('active reports capability adds only the existing global bonus and pack routes', () => {
  const caps = [capability('invoices'), capability('bonuses_reports')];
  const items = navigation('dynamic', [project({ capabilities: caps }), project({ id: 'p2', slug: 'second-site', capabilities: caps })]);
  assert.equal(items.filter(item => item.id === 'bonos').length, 1);
  assert.equal(items.filter(item => item.id === 'packs').length, 1);
  assert.equal(new Set(items.map(item => item.id)).size, items.length);
});

test('active misconfigured reports capability hides bonus and pack routes in both historical modes', () => {
  const configured = project({
    capabilities: [capability('bonuses_reports')],
    configurationIssues: { bonuses_reports: 'destination' },
  });
  for (const mode of ['legacy', 'dynamic']) {
    const items = navigation(mode, [configured]);
    assert.equal(items.some(item => item.id === 'bonos'), false);
    assert.equal(items.some(item => item.id === 'packs'), false);
    assert.deepEqual(items.slice(0, 2).map(item => item.id), ['dashboard', 'projects']);
  }
});

test('project-specific tools are never flattened into universal navigation', () => {
  const items = navigation('dynamic', [project({ capabilities: [
    capability('products'), capability('domains'), capability('hosting'), capability('blogger', 'active', {
      launch_url: 'https://admin.webfuengirola.com/paneladmin/blogger/first-site', validated_at: '2026-10-17T10:00:00Z',
    }), capability('analytics'),
  ] })]);
  assert.equal(items.filter(item => item.href.startsWith('/cliente/proyectos/')).length, 0);
  assert.equal(items.some(item => item.projectId || item.projectSlug || item.capability), false);
});

test('returns fresh immutable serializable data without freezing or exposing input metadata', () => {
  const projects = [project({ capabilities: [capability('invoices', 'active', { metadata: { secret: 'never-copy' } })] })];
  const before = structuredClone(projects);
  const items = navigation('dynamic', projects);
  assert.deepEqual(JSON.parse(JSON.stringify(items)), items);
  assert.ok(Object.isFrozen(items));
  assert.ok(items.every(Object.isFrozen));
  assert.throws(() => { items[0].label = 'changed'; }, TypeError);
  assert.deepEqual(projects, before);
  assert.equal(Object.isFrozen(projects[0]), false);
  assert.equal(JSON.stringify(items).includes('never-copy'), false);
  assert.notEqual(navigation('dynamic', projects), items);
});

test('fails closed for invalid modes instead of granting legacy navigation', () => {
  assert.throws(() => buildPortalNavigation({ mode: 'typo', projects: [], locale: 'es' }), /mode/i);
});

test('Sport Massage gets the approved focused English sidebar with project tools in place', () => {
  const sport = project({
    slug: 'sportmassagefuengirola',
    name: 'Sport Massage',
    domain: 'sportmassagefuengirola.com',
    capabilities: [
      capability('domains'),
      capability('bonuses_reports'),
      capability('analytics'),
      capability('blogger'),
      capability('invoices'),
    ],
  });

  assert.deepEqual(navigation('dynamic', [sport], 'en'), [
    { id: 'sport-domains', href: '/cliente/proyectos/sportmassagefuengirola#domains', label: 'Domains' },
    { id: 'projects', href: '/cliente/proyectos', label: 'Websites' },
    { id: 'bonos', href: '/cliente/bonos', label: 'Bonuses' },
    { id: 'sport-analytics', href: '/cliente/proyectos/sportmassagefuengirola/estadisticas', label: 'Statistics' },
    { id: 'sport-blogger', href: '/cliente/proyectos/sportmassagefuengirola/blogger', label: 'Blogger' },
    { id: 'help', href: '/cliente/mensajeria?new=1', label: 'Help' },
    { id: 'facturas', href: '/cliente/facturas', label: 'Invoices' },
  ]);
});
