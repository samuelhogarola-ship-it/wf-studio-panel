import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadProjectModule, database, project, capability, client, clientId, otherClientId } from './helpers/project-harness.mjs';

const protectedRoot = 'src/app/cliente/(protected)';
const accountTables = new Set(['packs', 'pack_summary', 'activities', 'invoices', 'client_resources', 'pending_items']);
const second = { ...project, id: 'second', slug: 'second-site', name: 'Second Site', domain: 'second.example' };
const pack = (id, pack_type = 'tasks') => ({ id, client_id: clientId, name: id, pack_type, status: 'active', purchase_date: '2026-10-01', renewal_date: '2027-10-01', price: 100, notes: null, minutes_total: 60, paid: true });
const invoice = (id, owner = clientId) => ({ id, client_id: owner, number: id, concept: id, amount: 100, payment_method: 'transfer', status: 'pending', notes: null, issued_at: '2026-10-01', paid_at: null });
const cap = (key, extra = {}) => ({ ...capability, id: key, capability_key: key, state: 'active', ...extra });
const render = element => renderToStaticMarkup(element);

// Exercise real routes, repositories, navigation and components. Only the session,
// remote database and Next request/navigation boundaries are replaced.
function setup({ mode = 'dynamic', projects = [project], capabilities = [], locale = 'es', seed = {}, denied = false, pathname = '/cliente/dashboard', identityRole = 'client', viewerMode = 'client', configuredAnalytics = false, configuredBlogger = false, localeRead } = {}) {
  const db = database({ client_projects: projects, project_capabilities: capabilities, ...seed });
  const identity = { userId: 'session-client', email: client.email, role: identityRole, client: { ...client, portal_mode: mode } };
  const supportIdentity = { userId: 'support-admin', email: 'support@example.com', role: 'admin' };
  const viewer = viewerMode === 'support'
    ? { mode: 'support', identity: supportIdentity, client: { ...client, portal_mode: mode }, supportSessionId: 'support-session', expiresAt: '2099-10-23T10:15:00.000Z', returnPath: `/paneladmin/clientes/${client.id}` }
    : { mode: 'client', identity, client: identity.client };
  const mocks = {
    '@/lib/auth': {
      requireClientAccess: async () => {
        if (denied) throw new Error('redirect:/cliente');
        if (viewerMode === 'support') throw new Error('ordinary client guard must not authorize support');
        return identity;
      },
      getOptionalIdentity: async () => identity,
    },
    '@/lib/support/portal-viewer': {
      requirePortalViewer: async () => { if (denied) throw new Error('redirect:/cliente'); return viewer; },
      requireClientMutationAccess: async () => { if (viewerMode === 'support') throw new Error('support_readonly'); return viewer; },
      getOptionalSupportViewer: async () => viewerMode === 'support' ? viewer : null,
    },
    '@/lib/supabase/server': { createSupabaseServerClient: async () => db },
    '@/lib/supabase/admin': { getSupabaseAdminClient: () => db },
    '@/lib/actions/messages': { sendRequestAction: async () => ({}) },
    '@/lib/locale': { getLocale: localeRead ?? (async () => locale) },
    ...(configuredAnalytics ? { '@/lib/analytics/umami-core.mjs': {
      getConfiguredUmamiSites: () => [{ key: 'example', domain: 'example.com', websiteId: 'website-id', source: 'personal' }],
      getUmamiConnections: () => ({ personal: { baseUrl: 'https://stats.example.net', password: 'server-secret' } }),
    } } : {}),
    ...(configuredBlogger ? {
      '@/lib/sites/registry.mjs': {
        getSiteByKey: () => ({ key: 'example', name: 'Example', domain: 'example.com', blogger: { enabled: true, runtime: 'central-multisite' } }),
      },
      '@/lib/blogger/editor.mjs': {
        getBloggerEditorTarget: () => ({ kind: 'iframe', href: '/blogger/editor/index.html?siteKey=example' }),
      },
    } : {}),
    'next/navigation': {
      redirect(url) { throw new Error(`redirect:${url}`); },
      notFound() { throw new Error('404'); },
      usePathname: () => pathname,
      useRouter: () => ({ refresh() {} }),
    },
  };
  function load(relative) {
    assert.ok(existsSync(new URL(`../${relative}`, import.meta.url)), `Missing required route/component: ${relative}`);
    return loadProjectModule(relative, mocks);
  }
  const page = (route, props = {}) => load(`${protectedRoot}/${route}/page.tsx`).default({ searchParams: Promise.resolve({}), ...props });
  return { db, load, page, identity };
}

test('the shared portal loader returns support metadata without the opaque cookie', async () => {
  const s = setup({ viewerMode: 'support' });
  const context = await s.load('src/lib/data/projects.ts').getClientPortalContext();

  assert.equal(context.viewerMode, 'support');
  assert.equal(context.supportSessionId, 'support-session');
  assert.equal(context.supportExpiresAt, '2099-10-23T10:15:00.000Z');
  assert.equal(context.returnPath, `/paneladmin/clientes/${client.id}`);
  assert.equal(context.client.id, client.id);
  assert.equal(JSON.stringify(context).includes('__Host-wf_support_preview'), false);
})

test('support layout displays the selected client email without exposing the administrator email', async () => {
  const s = setup({ viewerMode: 'support' });
  const context = await s.load('src/lib/data/projects.ts').getClientPortalContext();
  const Layout = s.load(`${protectedRoot}/layout.tsx`).default;
  const element = await Layout({ children: 'Support preview' });
  const html = render(element);

  assert.equal(context.client.email, client.email);
  assert.equal(context.email, undefined);
  assert.equal(element.props.clientEmail, client.email);
  assert.match(html, new RegExp(client.email));
  assert.doesNotMatch(html, /support@example\.com/);
})

test('every protected client page resolves through PortalViewer for both clients and support administrators', async () => {
  const capabilities = [
    cap('analytics'),
    cap('blogger', { launch_url: 'https://example.com/admin/blogger/', validated_at: project.created_at, metadata: { provisioning_confirmed: true } }),
  ];
  const routes = [
    'actualizaciones', 'bonos', 'dashboard', 'facturas', 'fotografias', 'historial', 'informes', 'pagos',
    'mensajeria', 'packs', 'pendientes', 'proyectos', 'servicios',
  ];
  for (const viewerMode of ['client', 'support']) {
    const s = setup({ viewerMode, projects: [{ ...project, analytics_registry_key: 'example' }], capabilities, configuredAnalytics: true, configuredBlogger: true });
    for (const route of routes) assert.ok(render(await s.page(route)).length > 0, `${viewerMode}: ${route}`);
    for (const route of ['proyectos/[slug]', 'proyectos/[slug]/estadisticas', 'proyectos/[slug]/blogger']) {
      assert.ok(render(await s.page(route, { params: Promise.resolve({ slug: project.slug }) })).length > 0, `${viewerMode}: ${route}`);
    }
  }
})

test('support project resolution drops reassigned, inactive, archived and client-hidden projects on the next request', async () => {
  const visible = { ...project, id: 'visible', slug: 'visible' };
  const candidates = [
    visible,
    { ...project, id: 'reassigned', slug: 'reassigned', client_id: otherClientId },
    { ...project, id: 'inactive', slug: 'inactive', status: 'inactive' },
    { ...project, id: 'archived', slug: 'archived', status: 'archived' },
    { ...project, id: 'hidden', slug: 'hidden', client_access_enabled: false },
  ];
  const s = setup({ viewerMode: 'support', projects: candidates });

  const context = await s.load('src/lib/data/projects.ts').getClientPortalContext();

  assert.deepEqual(context.projects.map(candidate => candidate.slug), ['visible']);
  for (const slug of ['reassigned', 'inactive', 'archived', 'hidden']) {
    assert.equal(await s.load('src/lib/data/projects.ts').getAccessibleClientProject(slug), null);
  }
})

test('an administrator without support is rejected by every protected client page before data reads', async () => {
  const routes = ['actualizaciones', 'bonos', 'dashboard', 'facturas', 'fotografias', 'historial', 'informes', 'mensajeria', 'pagos', 'packs', 'pendientes', 'proyectos', 'servicios'];
  for (const route of routes) {
    const s = setup({ viewerMode: 'support', denied: true });
    await assert.rejects(() => s.page(route), { message: 'redirect:/cliente' });
    assert.deepEqual(s.db.calls, []);
  }
})

test('entry sends every active client to Inicio and preserves the administrator destination', async () => {
  for (const [options, destination] of [[{ mode: 'legacy' }, '/cliente/dashboard'], [{ mode: 'dynamic' }, '/cliente/dashboard'], [{ identityRole: 'admin' }, '/paneladmin/inicio']]) {
    const s = setup(options);
    await assert.rejects(() => s.load('src/app/cliente/page.tsx').default({}), { message: `redirect:${destination}` });
  }
});

test('project index renders the universal selector for one project in either historical mode', async () => {
  for (const mode of ['legacy', 'dynamic']) {
    const html = render(await setup({ mode, locale: 'en' }).page('proyectos'));
    assert.match(html, /Example/);
    assert.match(html, /To confirm/);
    assert.match(html, /href="\/cliente\/proyectos\/example"/);
  }
});

test('multiple projects render tiered workspace cards with active tool summaries only', async () => {
  const html = render(await setup({
    projects: [
      { ...project, product_tier: 'pro', analytics_registry_key: 'example' },
      { ...second, product_tier: 'express' },
      { ...second, id: 'foreign', slug: 'foreign', name: 'Foreign Site', client_id: otherClientId, product_tier: 'lite' },
    ],
    capabilities: [
      cap('analytics'),
      cap('blogger', { launch_url: 'https://example.com/admin/blogger/', validated_at: project.created_at, metadata: { provisioning_confirmed: true, secret: 'never-render' } }),
      cap('analytics', { id: 'second-analytics', project_id: second.id }),
      cap('blogger', { id: 'second-blogger', project_id: second.id, state: 'available' }),
      cap('hosting', { id: 'second-hosting', project_id: second.id, state: 'unavailable' }),
      cap('analytics', { id: 'foreign-analytics', project_id: 'foreign' }),
    ],
    configuredAnalytics: true,
    configuredBlogger: true,
    locale: 'en',
  }).page('proyectos'));
  for (const value of ['Example', 'example.com', 'Second Site', 'second.example', 'Choose a project']) assert.ok(html.includes(value), value);
  for (const slug of ['example', 'second-site']) assert.match(html, new RegExp(`href="/cliente/proyectos/${slug}"`));
  const firstCard = html.slice(html.indexOf('Example'), html.indexOf('Second Site'));
  const secondCard = html.slice(html.indexOf('Second Site'));
  for (const value of ['Pro', 'Statistics', 'Blogger']) assert.match(firstCard, new RegExp(value));
  assert.match(secondCard, /Express/);
  assert.doesNotMatch(secondCard, /Statistics|Blogger/);
  assert.doesNotMatch(html, /Foreign Site|never-render|\/estadisticas|\/blogger/);
  assert.doesNotMatch(html, /<select|disabled|useEffect/);
});

test('zero projects render a controlled empty state with baseline actions and no account data reads', async () => {
  const s = setup({ projects: [], locale: 'en' });
  const html = render(await s.page('proyectos'));
  assert.match(html, /No accessible projects/);
  for (const href of ['pendientes', 'mensajeria']) assert.match(html, new RegExp(`href="/cliente/${href}"`));
  assert.doesNotMatch(html, /\/cliente\/(facturas|servicios|informes|bonos|packs|historial)/);
  assert.deepEqual(s.db.calls.filter(call => accountTables.has(call.table)), []);
});

test('dashboard renders the shared account summary without redirecting for either historical mode', async () => {
  for (const mode of ['legacy', 'dynamic']) {
    const s = setup({ mode, projects: [] });
    const html = render(await s.page('dashboard'));
    assert.match(html, /Hola, Ana/);
    assert.match(html, /href="\/cliente\/servicios\?new=1"/);
    assert.ok(s.db.calls.some(call => call.table === 'invoices'));
  }
});

test('server layout provides identical desktop/mobile actions, labels and accessible current state', async () => {
  const s = setup({ configuredBlogger: true, capabilities: [cap('invoices'), cap('blogger', { launch_url: 'https://example.com/admin/blogger/', validated_at: project.created_at, metadata: { provisioning_confirmed: true, secret: 'never-serialize' } })] });
  const Layout = s.load(`${protectedRoot}/layout.tsx`).default;
  const element = await Layout({ children: React.createElement('p', null, 'Page content') });
  assert.ok(Array.isArray(element.props.navigation), 'layout must pass precomputed navigation');
  assert.doesNotMatch(JSON.stringify({ ...element.props, children: null }), /never-serialize|analytics_registry_key|hosting_management_url/);
  const html = render(element);
  const navs = [...html.matchAll(/<nav\b[^>]*>([\s\S]*?)<\/nav>/g)].map(match => match[1]);
  assert.equal(navs.length, 2);
  const actions = nav => [...nav.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/g)].map(match => [match[1], match[2].replace(/<[^>]*>/g, '')]);
  const expected = [['/cliente/dashboard', 'Inicio'], ['/cliente/proyectos', 'Webs'], ['/cliente/informes', 'Informes'], ['/cliente/actualizaciones', 'Actualizaciones'], ['/cliente/fotografias', 'Fotografías'], ['/cliente/servicios', 'Servicios'], ['/cliente/pendientes', 'Pendientes'], ['/cliente/facturas', 'Facturas'], ['/cliente/pagos', 'Pagos'], ['/cliente/historial', 'Historial'], ['/cliente/mensajeria', 'Mensajería']];
  assert.deepEqual(actions(navs[0]), expected);
  assert.deepEqual(actions(navs[1]), expected);
  assert.equal((html.match(/aria-current="page"/g) ?? []).length, 2);
});

test('shell consumes supplied navigation without generating extra actions or duplicate href keys', () => {
  const s = setup({ pathname: '/cliente/proyectos/example' });
  const Shell = s.load('src/components/layout/client-shell.tsx').ClientShell;
  const html = render(React.createElement(Shell, { clientName: 'Ana', clientEmail: client.email, navigation: [{ id: 'one', href: '/cliente/proyectos/example#domains', label: 'Domains · Example' }], children: 'Content' }));
  assert.equal((html.match(/href="\/cliente\//g) ?? []).length, 2);
  assert.equal((html.match(/Domains · Example/g) ?? []).length, 2);
  assert.doesNotMatch(html, /aria-current="page"/);
});

test('both historical modes retain the exact universal account navigation on both screen sizes', async () => {
  for (const mode of ['legacy', 'dynamic']) {
    const s = setup({ mode, projects: [] });
    const html = render(await s.load(`${protectedRoot}/layout.tsx`).default({ children: 'Universal' }));
    for (const href of ['dashboard', 'proyectos', 'informes', 'actualizaciones', 'fotografias', 'servicios', 'pendientes', 'facturas', 'pagos', 'historial', 'mensajeria']) {
      assert.equal((html.match(new RegExp(`href="/cliente/${href}"`, 'g')) ?? []).length, 2, `${mode}: ${href}`);
    }
  }
});

test('all account pages retain access without project capabilities in either historical mode', async () => {
  for (const mode of ['legacy', 'dynamic']) {
    for (const route of ['facturas', 'bonos', 'packs', 'historial', 'informes', 'servicios', 'fotografias', 'actualizaciones']) {
      const s = setup({ mode, projects: [] });
      assert.ok(render(await s.page(route)).length > 0, `${mode}: ${route}`);
    }
  }
});

test('universal account routes remain RLS-scoped to the authenticated client', async () => {
  const s = setup({ mode: 'dynamic', projects: [], seed: {
    invoices: [invoice('Own invoice'), invoice('Foreign invoice', otherClientId)],
    packs: [pack('Own service'), { ...pack('Foreign service'), client_id: otherClientId }],
  } });
  const invoices = render(await s.page('facturas'));
  assert.match(invoices, /Own invoice/);
  assert.doesNotMatch(invoices, /Foreign invoice/);
  const services = render(await s.page('servicios'));
  assert.match(services, /Own service/);
  assert.doesNotMatch(services, /Foreign service/);
});

test('legacy clients can open assigned projects while project tools stay capability-gated', async () => {
  const overview = render(await setup({ mode: 'legacy' }).page('proyectos/[slug]', { params: Promise.resolve({ slug: 'example' }) }));
  assert.match(overview, /Example/);
  const blogger = setup({ mode: 'legacy' });
  await assert.rejects(() => blogger.page('proyectos/[slug]/blogger', { params: Promise.resolve({ slug: 'example' }) }), { message: '404' });
});

test('Blogger route authorizes only through the accessible project lookup', async () => {
  const activeBlogger = { ...capability, capability_key: 'blogger', state: 'active' };
  const Page = loadProjectModule(`${protectedRoot}/proyectos/[slug]/blogger/page.tsx`, {
    '@/lib/data/projects': {
      getAccessibleClientProject: async slug => slug === project.slug
        ? { ...project, capabilities: [activeBlogger] }
        : null,
      getClientPortalContext: async () => { throw new Error('duplicate portal context read'); },
    },
    '@/lib/sites/registry.mjs': {
      getSiteByKey: () => ({ key: project.slug, name: project.name, domain: project.domain, blogger: { enabled: true } }),
    },
    '@/lib/blogger/editor.mjs': {
      getBloggerEditorTarget: () => ({ kind: 'iframe', href: '/blogger/editor/index.html?siteKey=example' }),
    },
  }).default;

  const html = render(await Page({ params: Promise.resolve({ slug: project.slug }) }));
  assert.match(html, /Blogger · Example/);
});

test('project routes still hide archived, client-hidden and foreign projects in either historical mode', async () => {
  for (const mode of ['legacy', 'dynamic']) {
    const s = setup({ mode, projects: [project, { ...second, slug: 'archived', status: 'archived' }, { ...second, slug: 'hidden', client_access_enabled: false }, { ...second, slug: 'foreign', client_id: otherClientId }] });
    for (const slug of ['unknown', 'archived', 'hidden', 'foreign']) {
      await assert.rejects(() => s.page('proyectos/[slug]', { params: Promise.resolve({ slug }) }), { message: '404' });
    }
  }
});

test('invoices and closed packs aggregate by authenticated client, regardless of selected website', async () => {
  const s = setup({ projects: [project, second], capabilities: [cap('invoices'), cap('bonuses_reports')], seed: {
    invoices: [invoice('Invoice A'), invoice('Invoice B'), invoice('Foreign invoice', otherClientId)],
    packs: [pack('Pack A'), pack('Pack B'), { ...pack('Foreign pack'), client_id: otherClientId }, pack('Hours only', 'hours')],
  } });
  const invoices = render(await s.page('facturas', { searchParams: Promise.resolve({ project: 'second-site' }) }));
  for (const value of ['Invoice A', 'Invoice B']) assert.match(invoices, new RegExp(value));
  assert.doesNotMatch(invoices, /Foreign invoice/);
  const packs = render(await s.page('packs'));
  assert.match(packs, /Pack A/);
  assert.match(packs, /Pack B/);
  assert.doesNotMatch(packs, /Foreign pack|Hours only|Próximamente/);
});

test('services retain all authenticated client categories independent of project capabilities', async () => {
  const s = setup({ capabilities: [cap('domains')], seed: { packs: [pack('Allowed domain', 'domain'), pack('Hidden hosting', 'hosting'), pack('Hidden hours', 'hours'), pack('Hidden tasks'), pack('Hidden product', 'service')] } });
  const html = render(await s.page('servicios'));
  for (const name of ['Allowed domain', 'Hidden hosting', 'Hidden hours', 'Hidden tasks', 'Hidden product']) assert.match(html, new RegExp(name));
});

test('project overview identifies its website and opens Blogger inside the authorized portal', async () => {
  const s = setup({ configuredBlogger: true, capabilities: [cap('blogger', { launch_url: 'https://example.com/admin/blogger/', validated_at: project.created_at, metadata: { provisioning_confirmed: true } })], locale: 'en' });
  const html = render(await s.page('proyectos/[slug]', { params: Promise.resolve({ slug: 'example' }) }));
  assert.match(html, /Example/);
  assert.match(html, /example\.com/);
  assert.match(html, /href="https:\/\/example\.com"/);
  assert.match(html, /Blogger/);
  assert.match(html, /href="\/cliente\/proyectos\/example\/blogger"/);
  assert.doesNotMatch(html, /\/cliente\/(facturas|packs|bonos|historial|informes|servicios)/);
});

test('project overview omits available, unavailable, invalid and unsupported raw capabilities', async () => {
  const s = setup({ capabilities: [
    cap('blogger', { launch_url: 'https://foreign.example/admin', validated_at: project.created_at }),
    cap('analytics'),
    cap('products'),
    cap('domains', { state: 'available' }),
    cap('hosting', { state: 'unavailable' }),
  ] });
  const html = render(await s.page('proyectos/[slug]', { params: Promise.resolve({ slug: 'example' }) }));
  assert.doesNotMatch(html, /foreign\.example|estadisticas|#products|#domains|#hosting/);
  assert.match(html, /\/cliente\/pendientes/);
  assert.match(html, /\/cliente\/mensajeria/);
});

test('project statistics destination identifies the selected website without exposing server configuration', async () => {
  const s = setup({ configuredAnalytics: true, projects: [{ ...project, analytics_registry_key: 'example' }], capabilities: [cap('analytics')], locale: 'en' });
  const html = render(await s.page('proyectos/[slug]', { params: Promise.resolve({ slug: 'example' }) }));
  assert.match(html, /href="\/cliente\/proyectos\/example\/estadisticas"/);
  assert.match(html, /Statistics.*Example/);
  assert.doesNotMatch(html, /website-id|server-secret|stats\.example\.net|UMAMI/);
});

test('project overview presents pending actions and entitled aggregate account alerts', async () => {
  const s = setup({ capabilities: [cap('invoices'), cap('bonuses_reports')], seed: {
    pending_items: [{ id: 'pending', client_id: clientId, title: 'Send details', status: 'pending' }],
    invoices: [invoice('Invoice A'), invoice('Invoice B')], packs: [pack('Pack A')],
  } });
  const html = render(await s.page('proyectos/[slug]', { params: Promise.resolve({ slug: 'example' }) }));
  assert.match(html, /\/cliente\/pendientes/);
  assert.match(html, /200/);
  assert.match(html, /Pack A/);
  assert.match(html, /2027/);
});

const renewalRecords = [
  pack('Domain renewal', 'domain'), pack('Hosting renewal', 'hosting'),
  pack('Service renewal', 'service'), pack('Subscription renewal', 'subscription'),
  pack('Membership renewal', 'membership'), pack('Hours renewal', 'hours'), pack('Closed pack renewal', 'tasks'),
];
const overviewSummary = html => {
  const section = html.match(/<section aria-labelledby="account-heading"[^>]*>([\s\S]*?)<\/section>/);
  assert.ok(section, 'overview must render the account summary');
  return section[1];
};

for (const [key, visible] of [
  ['domains', ['Domain renewal']],
  ['hosting', ['Hosting renewal']],
  ['products', ['Service renewal', 'Subscription renewal', 'Membership renewal']],
]) {
  test(`overview loads entitled ${key} renewals without hours/reports access`, async () => {
    const s = setup({ capabilities: [cap(key)], seed: { packs: renewalRecords } });
    const summary = overviewSummary(render(await s.page('proyectos/[slug]', { params: Promise.resolve({ slug: 'example' }) })));
    for (const record of renewalRecords) assert.equal(summary.includes(record.name), visible.includes(record.name), record.name);
    assert.match(summary, /2027-10-01/);
    assert.match(summary, /href="\/cliente\/servicios"/);
    assert.doesNotMatch(summary, /href="\/cliente\/(bonos|packs)"/);
    assert.ok(s.db.calls.some(call => call.table === 'packs'));
  });

  test(`overview filters ${key} renewals by matching active capability even while hours data is loaded`, async () => {
    for (const state of ['active', 'available', 'unavailable']) {
      const s = setup({ capabilities: [cap('bonuses_reports'), cap(key, { state })], seed: { packs: renewalRecords } });
      const summary = overviewSummary(render(await s.page('proyectos/[slug]', { params: Promise.resolve({ slug: 'example' }) })));
      for (const record of renewalRecords) {
        const expected = ['Hours renewal', 'Closed pack renewal'].includes(record.name) || (state === 'active' && visible.includes(record.name));
        assert.equal(summary.includes(record.name), expected, `${state}: ${record.name}`);
      }
      // Other service categories must not inflate the hours or closed-pack totals.
      assert.match(summary, /href="\/cliente\/bonos"[^>]*>[^<]*1/);
      assert.match(summary, /href="\/cliente\/packs"[^>]*>[^<]*1/);
    }
  });
}

test('overview renewals aggregate by client across accessible projects, regardless of selected website', async () => {
  const s = setup({ projects: [project, second], capabilities: ['domains', 'hosting', 'products'].map(key => cap(key, { project_id: second.id })), seed: {
    packs: [pack('First site domain', 'domain'), pack('Second site domain', 'domain'), pack('Shared hosting', 'hosting'), pack('Account subscription', 'subscription'),
      { ...pack('Foreign domain', 'domain'), client_id: otherClientId }, { ...pack('Inactive hosting', 'hosting'), status: 'inactive' }],
  } });
  for (const slug of ['example', 'second-site']) {
    const summary = overviewSummary(render(await s.page('proyectos/[slug]', { params: Promise.resolve({ slug }) })));
    for (const name of ['First site domain', 'Second site domain', 'Shared hosting', 'Account subscription']) assert.ok(summary.includes(name), `${slug}: ${name}`);
    assert.doesNotMatch(summary, /Foreign domain|Inactive hosting/);
  }
});

test('overview skips all service reads without an accessible active configured service capability', async () => {
  const cases = [
    { capabilities: [] },
    { capabilities: [cap('invoices')] },
    { capabilities: ['domains', 'hosting', 'products'].map(key => cap(key, { state: 'available' })) },
    { capabilities: ['domains', 'hosting', 'products'].map(key => cap(key, { state: 'unavailable' })) },
    { capabilities: [cap('hosting', { launch_url: 'https://foreign.example/hosting' })] },
    ...[{ status: 'archived' }, { client_access_enabled: false }, { client_id: otherClientId }].map(overrides => ({
      projects: [project, { ...second, ...overrides }], capabilities: ['domains', 'hosting', 'products'].map(key => cap(key, { project_id: second.id })),
    })),
  ];
  for (const options of cases) {
    const s = setup({ ...options, seed: { packs: renewalRecords } });
    const summary = overviewSummary(render(await s.page('proyectos/[slug]', { params: Promise.resolve({ slug: 'example' }) })));
    assert.doesNotMatch(summary, /renewal/);
    assert.deepEqual(s.db.calls.filter(call => ['packs', 'activities', 'pack_summary'].includes(call.table)), []);
  }
});

test('overview authorizes the selected project before reading any entitled service data', async () => {
  const options = { capabilities: ['domains', 'hosting', 'products', 'bonuses_reports'].map(key => cap(key)), seed: { packs: renewalRecords } };
  const unauthenticated = setup({ ...options, denied: true });
  await assert.rejects(() => unauthenticated.page('proyectos/[slug]', { params: Promise.resolve({ slug: 'example' }) }), { message: 'redirect:/cliente' });
  assert.deepEqual(unauthenticated.db.calls, []);
  const s = setup({ ...options, projects: [project, { ...second, slug: 'archived', status: 'archived' }, { ...second, slug: 'hidden', client_access_enabled: false }, { ...second, slug: 'foreign', client_id: otherClientId }] });
  for (const slug of ['unknown', 'archived', 'hidden', 'foreign']) {
    await assert.rejects(() => s.page('proyectos/[slug]', { params: Promise.resolve({ slug }) }), { message: '404' });
  }
  assert.deepEqual(s.db.calls.filter(call => accountTables.has(call.table)), []);
});

test('account capability destinations stay in the aggregate portal even if an external launch URL is stored', async () => {
  const s = setup({ capabilities: [cap('invoices', { launch_url: 'https://example.com/invoices/' }), cap('bonuses_reports', { launch_url: 'https://example.com/packs/' })] });
  const html = render(await s.page('proyectos/[slug]', { params: Promise.resolve({ slug: 'example' }) }));
  assert.doesNotMatch(html, /href="https:\/\/example.com\/(invoices|packs)\//);
  assert.match(html, /href="\/cliente\/bonos"/);
});

test('active hour packs link to the hours account page from project overview', async () => {
  const s = setup({ capabilities: [cap('bonuses_reports')], seed: { packs: [pack('Active hours', 'hours')] } });
  const html = render(await s.page('proyectos/[slug]', { params: Promise.resolve({ slug: 'example' }) }));
  assert.match(html, /href="\/cliente\/bonos"[^>]*>[^<]*1/);
  assert.match(html, /Active hours/);
});

test('layout starts authorized project reads while the independent locale read is pending', async () => {
  const locale = Promise.withResolvers();
  const s = setup({ localeRead: () => locale.promise });
  const promise = s.load(`${protectedRoot}/layout.tsx`).default({ children: 'Content' });
  try {
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(s.db.calls.some(call => call.table === 'client_projects'), 'project read must not wait for locale');
  } finally {
    locale.resolve('en');
    await promise;
  }
});

test('unknown, archived, client-hidden and foreign slugs all return the same non-revealing 404', async () => {
  const s = setup({ projects: [project, { ...second, slug: 'archived', status: 'archived' }, { ...second, slug: 'hidden', client_access_enabled: false }, { ...second, slug: 'foreign', client_id: otherClientId }] });
  for (const slug of ['unknown', 'archived', 'hidden', 'foreign']) {
    await assert.rejects(() => s.page('proyectos/[slug]', { params: Promise.resolve({ slug }) }), { message: '404' });
  }
  assert.deepEqual(s.db.calls.filter(call => accountTables.has(call.table)), []);
});

test('server routes authenticate even without their parent layout', async () => {
  for (const route of ['proyectos', 'proyectos/[slug]', 'dashboard', 'facturas', 'bonos', 'packs', 'historial', 'informes', 'servicios']) {
    const s = setup({ denied: true });
    await assert.rejects(() => s.page(route, { params: Promise.resolve({ slug: 'example' }) }), { message: 'redirect:/cliente' });
    assert.deepEqual(s.db.calls, []);
  }
});
