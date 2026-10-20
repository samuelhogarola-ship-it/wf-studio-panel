const normalizedDomain = value => typeof value === 'string'
  ? value.trim().toLowerCase().replace(/^www\./, '')
  : '';

/**
 * Compares the database inventory with the technical site registry.
 * This function is intentionally pure: repair remains an explicit admin action.
 */
export function reconcileProjectsWithRegistry(projects, sites) {
  const sitesByKey = new Map(sites.map(site => [site.key, site]));
  const sitesByDomain = new Map(sites.map(site => [normalizedDomain(site.domain), site]));
  const matchedSiteKeys = new Set();
  const issues = [];

  for (const project of projects) {
    const siteKey = project.analytics_registry_key || undefined;
    const site = siteKey
      ? sitesByKey.get(siteKey)
      : sitesByDomain.get(normalizedDomain(project.domain));

    if (!site) {
      issues.push({
        kind: 'missing-registry-site',
        projectId: project.id,
        ...(siteKey ? { siteKey } : {}),
        message: `El proyecto ${project.name} (${project.domain}) no tiene un sitio registrado compatible.`,
      });
      continue;
    }

    matchedSiteKeys.add(site.key);
    if (normalizedDomain(project.domain) !== normalizedDomain(site.domain)) {
      issues.push({
        kind: 'domain-mismatch',
        projectId: project.id,
        siteKey: site.key,
        message: `El dominio de ${project.name} (${project.domain}) no coincide con ${site.domain} en el registro.`,
      });
    }
  }

  for (const site of sites) {
    if (matchedSiteKeys.has(site.key)) continue;
    issues.push({
      kind: 'missing-project',
      siteKey: site.key,
      message: `El sitio registrado ${site.name} (${site.domain}) no tiene proyecto.`,
    });
  }

  return issues;
}
