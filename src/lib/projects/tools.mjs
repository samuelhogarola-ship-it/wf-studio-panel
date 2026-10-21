import { validateBloggerProjectDestination, validateProjectDestination } from './model.mjs';

const definitions = Object.freeze([
  { id: 'website', label: 'Sitio web', audience: 'both' },
  { id: 'blogger', label: 'Blogger', audience: 'both', capability: 'blogger' },
  { id: 'analytics', label: 'Estadísticas', audience: 'both', capability: 'analytics' },
  { id: 'client', label: 'Cliente', audience: 'admin' },
  { id: 'domains', label: 'Dominios', audience: 'both', capability: 'domains' },
  { id: 'hosting', label: 'Hosting', audience: 'both', capability: 'hosting' },
  { id: 'invoices', label: 'Facturas', audience: 'both', capability: 'invoices' },
  { id: 'reports', label: 'Informes', audience: 'both', capability: 'bonuses_reports' },
  { id: 'bonuses', label: 'Bonos', audience: 'both', capability: 'bonuses_reports' },
]);

function internalHref(id, project, viewer) {
  const projectId = encodeURIComponent(project.id);
  const slug = encodeURIComponent(project.slug);
  if (id === 'blogger') return viewer === 'admin' ? `/paneladmin/blogger/${slug}` : `/cliente/proyectos/${slug}/blogger`;
  if (id === 'analytics') return viewer === 'admin'
    ? `/paneladmin/proyectos/${projectId}/estadisticas`
    : `/cliente/proyectos/${slug}/estadisticas`;
  if (id === 'client') return project.client_id ? `/paneladmin/clientes/${encodeURIComponent(project.client_id)}` : null;
  if (id === 'domains' || id === 'hosting') return viewer === 'admin'
    ? null
    : `/cliente/proyectos/${slug}#${id}`;
  if (id === 'invoices') return viewer === 'admin' ? '/paneladmin/facturas' : '/cliente/facturas';
  if (id === 'reports') return viewer === 'admin' ? '/paneladmin/informes' : '/cliente/informes';
  if (id === 'bonuses') return viewer === 'admin' ? '/paneladmin/bonos' : '/cliente/bonos';
  return null;
}

function resolveTool(definition, project, viewer, configurationIssues) {
  if (definition.id === 'website') {
    const href = `https://${String(project.domain ?? '').toLowerCase().replace(/^www\./, '')}`;
    if (validateProjectDestination(href, project.domain, true)) {
      return { id: definition.id, label: definition.label, href, state: 'active', audience: definition.audience };
    }
    return {
      id: definition.id,
      label: definition.label,
      href: null,
      state: 'misconfigured',
      audience: definition.audience,
      warning: 'El dominio público del proyecto no es válido.',
    };
  }

  if (definition.id === 'client') {
    return {
      id: definition.id,
      label: definition.label,
      href: project.client_id ? internalHref(definition.id, project, viewer) : null,
      state: project.client_id ? 'active' : 'unavailable',
      audience: definition.audience,
    };
  }

  const capability = (project.capabilities ?? []).find(item => item.capability_key === definition.capability);
  const capabilityState = ['blogger', 'analytics'].includes(definition.id) && viewer === 'admin' && project.status !== 'active'
    ? 'unavailable'
    : ['active', 'available', 'unavailable'].includes(capability?.state)
      ? capability.state
      : 'unavailable';
  let warning = configurationIssues[definition.capability];
  if (definition.id === 'blogger' && capabilityState === 'active' &&
      (!capability.validated_at || !validateBloggerProjectDestination(capability.launch_url, project.domain, project.slug))) {
    warning ??= 'La configuración de Blogger no está validada para este proyecto.';
  }
  const state = warning && capabilityState !== 'unavailable' ? 'misconfigured' : capabilityState;
  const tool = {
    id: definition.id,
    label: definition.label,
    href: state === 'active' ? internalHref(definition.id, project, viewer) : null,
    state,
    audience: definition.audience,
  };
  return state === 'misconfigured' ? { ...tool, warning } : tool;
}

/** Pure presentation only: authorization must happen before project data reaches this resolver. */
export function buildProjectTools({ project, viewer, configurationIssues = {} }) {
  if (viewer !== 'admin' && viewer !== 'client') throw new TypeError('Invalid project tool viewer');
  if (viewer === 'client' && (project.status !== 'active' || project.client_access_enabled !== true)) return [];

  const tools = definitions
    .filter(definition => viewer === 'admin' || definition.audience !== 'admin')
    .map(definition => resolveTool(definition, project, viewer, configurationIssues))
    .filter(tool => viewer === 'admin' || tool.state === 'active');
  return Object.freeze(tools.map(tool => Object.freeze(tool)));
}
