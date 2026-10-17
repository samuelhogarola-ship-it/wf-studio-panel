import registry from "../../config/sites.json" with { type: "json" };

function parseHttpsUrl(value, label, site, sameSite = false) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`Registro de sitios: ${label} de ${site.key} no es una URL HTTPS válida`);
  }
  const siteHost = site.domain.toLowerCase().replace(/^www\./, "");
  const targetHost = parsed.hostname.toLowerCase().replace(/^www\./, "");
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.hash ||
    (sameSite && targetHost !== siteHost && !targetHost.endsWith(`.${siteHost}`))
  ) {
    throw new Error(`Registro de sitios: ${label} de ${site.key} no usa HTTPS seguro del sitio`);
  }
  return parsed;
}

export function validateSite(site) {
  if (!site || site.schemaVersion !== 1)
    throw new Error("Registro de sitios: schemaVersion no compatible");
  if (!site.key || !site.name || !site.domain || !site.productionUrl)
    throw new Error("Registro de sitios: faltan campos obligatorios");
  parseHttpsUrl(site.productionUrl, "producción", site, true);
  if (site.blogger?.enabled) {
    if (!site.blogger.url) throw new Error(`Registro de sitios: Blogger de ${site.key} no tiene acceso directo`);
    parseHttpsUrl(site.blogger.url, "Blogger", site, true);
  }
  const handoffMetadata = site.blogger?.adapter !== undefined || site.blogger?.capabilities !== undefined;
  if (handoffMetadata) {
    const blogger = site.blogger;
    if (
      !blogger?.enabled ||
      typeof blogger.adapter !== "string" ||
      !blogger.adapter.trim() ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(blogger.adapter) ||
      !Array.isArray(blogger.capabilities) ||
      blogger.capabilities.length === 0 ||
      blogger.capabilities.some((capability) => typeof capability !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(capability)) ||
      new Set(blogger.capabilities).size !== blogger.capabilities.length
    ) {
      throw new Error(`Registro de sitios: Blogger de ${site.key} tiene un handoff incompleto`);
    }
  }
  const handoffEndpoints = site.blogger?.launchUrl !== undefined || site.blogger?.healthUrl !== undefined;
  if (handoffEndpoints) {
    const blogger = site.blogger;
    if (!handoffMetadata || typeof blogger.launchUrl !== "string" || typeof blogger.healthUrl !== "string") {
      throw new Error(`Registro de sitios: Blogger de ${site.key} tiene un handoff incompleto`);
    }
    parseHttpsUrl(blogger.launchUrl, "Blogger launchUrl", site, true);
    parseHttpsUrl(blogger.healthUrl, "Blogger healthUrl", site, true);
  }
  return site;
}

export const SITE_REGISTRY = Object.freeze(registry.map(validateSite));

export function getSites() {
  return SITE_REGISTRY;
}

export function getSiteByKey(key) {
  const site = SITE_REGISTRY.find((entry) => entry.key === key);
  if (!site) throw new Error(`Sitio desconocido: ${key}`);
  return site;
}

export function getBloggerHandoff(site) {
  const blogger = validateSite(site).blogger;
  if (
    !blogger?.enabled ||
    !blogger.launchUrl ||
    !blogger.healthUrl ||
    !blogger.adapter ||
    !blogger.capabilities?.length
  ) return null;
  return blogger;
}

export function getLegacyAnalyticsProjects() {
  return SITE_REGISTRY.filter((site) => site.analytics.legacyDashboard).map(
    (site) => ({
      key: site.analytics.legacyKey || site.key,
      label: site.analytics.legacyLabel || site.name,
      domain: site.domain,
      source: site.analytics.source,
      envSuffix: site.analytics.envSuffix,
    }),
  );
}
