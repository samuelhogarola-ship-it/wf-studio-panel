import { buildProjectTools } from './tools.mjs';

const labels = {
  es: {
    dashboard: 'Inicio', projects: 'Webs', informes: 'Informes', actualizaciones: 'Actualizaciones',
    fotografias: 'Fotografías', servicios: 'Servicios', pendientes: 'Pendientes',
    facturas: 'Facturas', pagos: 'Pagos', historial: 'Historial', mensajeria: 'Mensajería',
    bonos: 'Bonos', packs: 'Packs', products: 'Productos', domains: 'Dominios',
    hosting: 'Hosting', blogger: 'Blogger', analytics: 'Estadísticas',
  },
  en: {
    dashboard: 'Home', projects: 'Websites', informes: 'Reports', actualizaciones: 'Updates',
    fotografias: 'Photos', servicios: 'Services', pendientes: 'Pending',
    facturas: 'Invoices', pagos: 'Payments', historial: 'History', mensajeria: 'Messages',
    bonos: 'Hours', packs: 'Packs', products: 'Products', domains: 'Domains',
    hosting: 'Hosting', blogger: 'Blogger', analytics: 'Statistics',
  },
};

/** Pure presentation only: callers must load projects through authorized data access. */
export function buildPortalNavigation({ mode, projects = [], locale = 'es' }) {
  if (mode !== 'legacy' && mode !== 'dynamic') throw new TypeError('Invalid portal mode');
  const text = locale === 'en' ? labels.en : labels.es;
  const accountItem = key => ({ id: key, href: key === 'projects' ? '/cliente/proyectos' : `/cliente/${key}`, label: text[key] });
  const freeze = items => Object.freeze(items.map(item => Object.freeze(item)));
  const visible = projects.filter(project => project.status === 'active' && project.client_access_enabled === true);
  const projectTools = visible.map(project => buildProjectTools({
    project,
    viewer: 'client',
    configurationIssues: project.configurationIssues,
  }));
  const keys = ['dashboard', 'projects', 'informes', 'actualizaciones', 'fotografias', 'servicios'];
  if (projectTools.some(tools => tools.some(tool => tool.id === 'reports'))) keys.push('bonos', 'packs');
  keys.push('pendientes', 'facturas', 'pagos', 'historial', 'mensajeria');
  const items = keys.map(accountItem);
  return freeze(items);
}
