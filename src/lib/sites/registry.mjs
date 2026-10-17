import registry from "../../config/sites.json" with { type: "json" };

const LOCAL_SUFFIXES = new Set(["localhost", "local", "internal", "lan", "home", "test", "invalid", "example"]);
const SITE_DOMAINS = new Map([
  ["webfuengirola", "webfuengirola.com"],
  ["vivirenfuengirola", "vivirenfuengirola.com"],
  ["conocef", "conocefuengirola.com"],
  ["topfuengirola", "topfuengirola.com"],
  ["samuelcoachdealeman", "samuelcoachdealeman.com"],
  ["vikingfitness", "vikingfitness.es"],
  ["personaltrainerfuengirola", "personaltrainerfuengirola.com"],
  ["gimnasionuevoestilo", "gimnasionuevoestilo.com"],
  ["bionatura", "bionatura.es"],
  ["sportmassagefuengirola", "sportmassagefuengirola.com"],
  ["deutschkompakt", "deutschkompakt.com"],
  ["vokabellab", "vokabellab.com"],
  ["imkontext", "imkontext.vokabellab.com"],
  ["derdiedas", "derdiedas.vokabellab.com"],
  ["superentrenador", "superentrenador.com"],
  ["coachstudio", "coach.superentrenador.com"],
  ["todoplastico", "todo-plastico.com"],
]);
const SITE_PRODUCTION_HOST_OVERRIDES = new Map([
  ["samuelcoachdealeman", "www.samuelcoachdealeman.com"],
]);

function isIpLiteral(value) {
  const candidate = value.startsWith("[") && value.endsWith("]") ? value.slice(1, -1) : value;
  if (candidate.includes(":")) return true;
  const parts = candidate.split(".");
  return parts.length === 4 && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}

function validateHostnameSyntax(value, label) {
  if (typeof value !== "string" || value !== value.trim().toLowerCase() || value.length > 253) {
    throw new Error(`Registro de sitios: ${label} no es un hostname público canónico`);
  }
  if (isIpLiteral(value)) throw new Error(`Registro de sitios: ${label} no puede ser una dirección IP`);
  const labels = value.split(".");
  if (labels.length < 2 || labels.some((part) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(part))) {
    throw new Error(`Registro de sitios: ${label} no es un dominio público completo`);
  }
  const suffix = labels.at(-1);
  if (!suffix || LOCAL_SUFFIXES.has(suffix) || (!/^[a-z]{2,63}$/.test(suffix) && !/^xn--[a-z0-9-]{2,59}$/.test(suffix))) {
    throw new Error(`Registro de sitios: ${label} no usa un sufijo público válido`);
  }
  return value;
}

function parseOrigin(value, label) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`Registro de sitios: ${label} no es una URL HTTPS válida`);
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.port ||
    parsed.hash
  ) {
    throw new Error(`Registro de sitios: ${label} no usa un origen HTTPS seguro`);
  }
  validateHostnameSyntax(parsed.hostname.toLowerCase(), `${label} hostname`);
  return parsed;
}

function parseExactOrigin(value, label) {
  const parsed = parseOrigin(value, label);
  if (value !== parsed.origin) {
    throw new Error(`Registro de sitios: ${label} debe ser un origen HTTPS normalizado`);
  }
  return parsed;
}

function allowedSiteOrigins(site, domain, productionOrigin) {
  const allowed = new Set([productionOrigin]);
  if (site.allowedOrigins === undefined) return allowed;
  if (!Array.isArray(site.allowedOrigins) || new Set(site.allowedOrigins).size !== site.allowedOrigins.length) {
    throw new Error(`Registro de sitios: orígenes permitidos de ${site.key} no válidos`);
  }
  for (const value of site.allowedOrigins) {
    const parsed = parseExactOrigin(value, `origen permitido de ${site.key}`);
    const targetHost = parsed.hostname.toLowerCase();
    if (targetHost !== domain && !targetHost.endsWith(`.${domain}`)) {
      throw new Error(`Registro de sitios: origen no aprobado para ${site.key}`);
    }
    allowed.add(parsed.origin);
  }
  return allowed;
}

function parseHttpsUrl(value, label, site, allowedOrigins) {
  const parsed = parseOrigin(value, `${label} de ${site.key}`);
  if (!allowedOrigins.has(parsed.origin)) {
    throw new Error(`Registro de sitios: ${label} de ${site.key} usa un origen no aprobado`);
  }
  return parsed;
}

export function validateSite(site) {
  if (!site || site.schemaVersion !== 1)
    throw new Error("Registro de sitios: schemaVersion no compatible");
  if (!site.key || !site.name || !site.domain || !site.productionUrl)
    throw new Error("Registro de sitios: faltan campos obligatorios");
  const approvedDomain = SITE_DOMAINS.get(site.key);
  if (!approvedDomain || site.domain !== approvedDomain) {
    throw new Error(`Registro de sitios: identidad de producción no aprobada para ${site.key}`);
  }
  const domain = validateHostnameSyntax(site.domain, `dominio de ${site.key}`);
  const production = parseExactOrigin(site.productionUrl, `producción de ${site.key}`);
  const expectedProductionHost = SITE_PRODUCTION_HOST_OVERRIDES.get(site.key) ?? domain;
  const expectedProductionOrigin = `https://${expectedProductionHost}`;
  if (production.origin !== expectedProductionOrigin) {
    throw new Error(`Registro de sitios: identidad de producción no aprobada para ${site.key}`);
  }
  const allowedOrigins = allowedSiteOrigins(site, domain, production.origin);
  if (site.blogger?.enabled) {
    if (!site.blogger.url) throw new Error(`Registro de sitios: Blogger de ${site.key} no tiene acceso directo`);
    parseHttpsUrl(site.blogger.url, "Blogger", site, allowedOrigins);
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
    parseHttpsUrl(blogger.launchUrl, "Blogger launchUrl", site, allowedOrigins);
    parseHttpsUrl(blogger.healthUrl, "Blogger healthUrl", site, allowedOrigins);
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
