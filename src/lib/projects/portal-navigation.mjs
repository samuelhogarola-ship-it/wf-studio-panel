import { buildProjectTools } from './tools.mjs';

const labels = {
  es: {
    dashboard: 'Resumen', informes: 'Informes', actualizaciones: 'Actualizaciones',
    fotografias: 'Fotografías', servicios: 'Servicios', pendientes: 'Pendientes',
    facturas: 'Facturas', historial: 'Historial', mensajeria: 'Mensajería',
    bonos: 'Bonos', packs: 'Packs', products: 'Productos', domains: 'Dominios',
    hosting: 'Hosting', blogger: 'Blogger', analytics: 'Estadísticas',
  },
  en: {
    dashboard: 'Overview', informes: 'Reports', actualizaciones: 'Updates',
    fotografias: 'Photos', servicios: 'Services', pendientes: 'Pending',
    facturas: 'Invoices', historial: 'History', mensajeria: 'Messages',
    bonos: 'Hours', packs: 'Packs', products: 'Products', domains: 'Domains',
    hosting: 'Hosting', blogger: 'Blogger', analytics: 'Statistics',
  },
};

/** Pure presentation only: callers must load projects through authorized data access. */
export function buildPortalNavigation({ mode, projects = [], locale = 'es' }) {
  if (mode !== 'legacy' && mode !== 'dynamic') throw new TypeError('Invalid portal mode');
  const text = locale === 'en' ? labels.en : labels.es;
  const accountItem = key => ({ id: key, href: `/cliente/${key}`, label: text[key] });
  const freeze = items => Object.freeze(items.map(item => Object.freeze(item)));

  if (mode === 'legacy') {
    return freeze(['informes', 'actualizaciones', 'fotografias', 'dashboard', 'servicios',
      'pendientes', 'facturas', 'historial', 'mensajeria'].map(accountItem));
  }

  const visible = projects.filter(project => project.status === 'active' && project.client_access_enabled === true);
  const hasActive = (project, key) => (project.capabilities ?? []).some(capability =>
    capability.capability_key === key && capability.state === 'active');
  const projectTools = new Map(visible.map(project => [
    project.id,
    new Map(buildProjectTools({ project, viewer: 'client' }).map(tool => [tool.id, tool])),
  ]));
  const items = ['dashboard', 'pendientes', 'mensajeria'].map(accountItem);
  if (visible.some(project => projectTools.get(project.id).has('invoices'))) items.push(accountItem('facturas'));
  if (visible.some(project => projectTools.get(project.id).has('reports'))) {
    items.push(...['bonos', 'packs', 'historial', 'informes'].map(accountItem));
  }

  for (const project of visible) {
    const base = `/cliente/proyectos/${encodeURIComponent(project.slug)}`;
    for (const key of ['products', 'domains', 'hosting', 'blogger', 'analytics']) {
      const tool = projectTools.get(project.id).get(key);
      if (key === 'products' ? !hasActive(project, key) : !tool) continue;
      const href = key === 'products' ? `${base}#${key}` : tool.href;
      items.push({
        id: `${project.id}:${key}`, href, label: `${text[key]} · ${project.name}`,
        projectId: project.id, projectSlug: project.slug, capability: key,
      });
    }
  }
  return freeze(items);
}
