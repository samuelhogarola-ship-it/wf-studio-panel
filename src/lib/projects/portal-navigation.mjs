import { validateProjectDestination } from './model.mjs';

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
  const items = ['dashboard', 'pendientes', 'mensajeria'].map(accountItem);
  if (visible.some(project => hasActive(project, 'invoices'))) items.push(accountItem('facturas'));
  if (visible.some(project => hasActive(project, 'bonuses_reports'))) {
    items.push(...['bonos', 'packs', 'historial', 'informes'].map(accountItem));
  }

  for (const project of visible) {
    const base = `/cliente/proyectos/${encodeURIComponent(project.slug)}`;
    for (const key of ['products', 'domains', 'hosting', 'blogger', 'analytics']) {
      if (!hasActive(project, key)) continue;
      let href = key === 'analytics' ? `${base}/estadisticas` : `${base}#${key}`;
      if (key === 'blogger') {
        const capability = project.capabilities.find(capability =>
          capability.capability_key === key && capability.state === 'active');
        if (!capability.validated_at || !validateProjectDestination(capability.launch_url, project.domain, true)) continue;
        href = capability.launch_url;
      }
      items.push({
        id: `${project.id}:${key}`, href, label: `${text[key]} · ${project.name}`,
        projectId: project.id, projectSlug: project.slug, capability: key,
      });
    }
  }
  return freeze(items);
}
