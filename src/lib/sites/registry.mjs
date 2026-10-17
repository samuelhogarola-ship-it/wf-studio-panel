import registry from "../../config/sites.json" with { type: "json" };

function validateSite(site) {
  if (!site || site.schemaVersion !== 1)
    throw new Error("Registro de sitios: schemaVersion no compatible");
  if (!site.key || !site.name || !site.domain || !site.productionUrl)
    throw new Error("Registro de sitios: faltan campos obligatorios");
  if (!site.productionUrl.startsWith("https://"))
    throw new Error(`Registro de sitios: ${site.key} no usa HTTPS`);
  if (site.blogger?.enabled && !site.blogger.url?.startsWith("https://")) {
    throw new Error(`Registro de sitios: Blogger de ${site.key} no usa HTTPS`);
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
