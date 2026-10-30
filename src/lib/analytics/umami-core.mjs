import { getSites } from "../sites/registry.mjs";

const SITE_REGISTRY = getSites().flatMap((site) => {
  const properties = site.analytics.properties || [{
    key: site.key,
    label: site.name,
    envSuffix: site.analytics.envSuffix,
  }];

  return properties.map((property) => [
    property.key,
    property.label,
    site.domain,
    site.analytics.source,
    site.panel.key,
    property.envSuffix,
  ]);
});

const LEGACY_WEBSITE_ID_ENV = {
  vokabellab: "STAT_REPORT_UMAMI_WEBSITE_ID_VOKABELWORLD",
  todoplastico: "STAT_REPORT_UMAMI_WEBSITE_ID_AGAMA",
};

export function getConfiguredUmamiSites(env = process.env) {
  return SITE_REGISTRY.map(([key, label, defaultDomain, source, panelKey, envSuffix]) => ({
    key,
    label,
    domain:
      env[`UMAMI_DOMAIN_${envSuffix}`] ||
      env[`STAT_REPORT_UMAMI_DOMAIN_${envSuffix}`] ||
      defaultDomain,
    source,
    panelKey,
    websiteId:
      env[`UMAMI_WEBSITE_ID_${envSuffix}`] ||
      env[`STAT_REPORT_UMAMI_WEBSITE_ID_${envSuffix}`] ||
      (LEGACY_WEBSITE_ID_ENV[key] ? env[LEGACY_WEBSITE_ID_ENV[key]] : undefined) ||
      undefined,
  }));
}

export function getPanelUmamiSites(panelKey, sites = getConfiguredUmamiSites()) {
  return sites.filter((site) => site.panelKey === panelKey);
}

export function getUmamiConnections(env = process.env) {
  return {
    personal: {
      source: "personal",
      baseUrl: env.UMAMI_PERSONAL_URL || env.STAT_REPORT_UMAMI_URL || undefined,
      username:
        env.UMAMI_PERSONAL_USERNAME ||
        env.STAT_REPORT_UMAMI_USERNAME ||
        "admin",
      password:
        env.UMAMI_PERSONAL_PASSWORD ||
        env.STAT_REPORT_UMAMI_PASSWORD ||
        undefined,
    },
    agama: {
      source: "agama",
      baseUrl: env.UMAMI_AGAMA_URL || undefined,
      username: env.UMAMI_AGAMA_USERNAME || "admin",
      password: env.UMAMI_AGAMA_PASSWORD || undefined,
    },
  };
}

function apiUrl(baseUrl, pathname, params) {
  const url = new URL(pathname, baseUrl);
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }
  return url;
}

async function requestJson(url, {
  token,
  method = "GET",
  body,
  fetchImpl = fetch,
  timeoutMs = 10_000,
} = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal,
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok) {
      const message =
        (typeof data?.message === "string" && data.message) ||
        (typeof data?.error === "string" && data.error) ||
        (typeof data?.error?.message === "string" && data.error.message) ||
        `HTTP ${response.status}`;
      throw new Error(message);
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

export function getTrailingComparisonRange(now = new Date(), days = 30) {
  if (!Number.isInteger(days) || days < 1) throw new Error("days must be a positive integer");
  const duration = days * 86_400_000;
  const endAt = now.getTime();
  const startAt = endAt - duration;
  return {
    days,
    startAt,
    endAt,
    previousStartAt: startAt - duration,
    previousEndAt: startAt - 1,
  };
}

export async function getUmamiToken({ connection, fetchImpl = fetch, requestTimeoutMs = 10_000 }) {
  const login = await requestJson(apiUrl(connection.baseUrl, "/api/auth/login"), {
    method: "POST",
    body: { username: connection.username, password: connection.password },
    fetchImpl,
    timeoutMs: requestTimeoutMs,
  });
  if (!login?.token) throw new Error("Umami login did not return a token");
  return login.token;
}

export async function resolveUmamiSites({ connection, token, sites, fetchImpl = fetch, requestTimeoutMs = 10_000 }) {
  if (sites.every((site) => site.websiteId)) return sites;

  let response;
  try {
    response = await requestJson(apiUrl(connection.baseUrl, "/api/websites", { pageSize: 200 }), {
      token,
      fetchImpl,
      timeoutMs: requestTimeoutMs,
    });
  } catch {
    return sites;
  }
  const websites = Array.isArray(response) ? response : response?.data || [];
  const domainCounts = sites.reduce((counts, site) => {
    const domain = site.domain.toLowerCase();
    counts.set(domain, (counts.get(domain) || 0) + 1);
    return counts;
  }, new Map());

  return sites.map((site) => {
    if (site.websiteId) return site;
    const normalizedLabel = site.label.toLowerCase();
    const normalizedDomain = site.domain.toLowerCase();
    const nameMatch = websites.find((website) => {
      const id = website.id || website.websiteId || website.website_id;
      const name = String(website.name || "").toLowerCase();
      return id && name === normalizedLabel;
    });
    const domainMatch = domainCounts.get(normalizedDomain) === 1
      ? websites.find((website) => {
        const id = website.id || website.websiteId || website.website_id;
        const domain = String(website.domain || "").toLowerCase();
        return id && domain === normalizedDomain;
      })
      : undefined;
    const match = nameMatch || domainMatch;
    const websiteId = match?.id || match?.websiteId || match?.website_id;
    return websiteId ? { ...site, websiteId } : site;
  });
}

export async function fetchUmamiSiteData({ connection, token, site, range, fetchImpl = fetch, requestTimeoutMs = 10_000 }) {
  if (!site.websiteId) {
    return { site, status: "missing_website_id", message: "Sin websiteId configurado" };
  }

  const currentParams = { startAt: range.startAt, endAt: range.endAt };
  const previousParams = { startAt: range.previousStartAt, endAt: range.previousEndAt };
  const sitePath = `/api/websites/${site.websiteId}`;

  try {
    const [stats, previousStats, series, topPages, topReferrers, topCountries, devices] = await Promise.all([
      requestJson(apiUrl(connection.baseUrl, `${sitePath}/stats`, currentParams), { token, fetchImpl, timeoutMs: requestTimeoutMs }),
      requestJson(apiUrl(connection.baseUrl, `${sitePath}/stats`, previousParams), { token, fetchImpl, timeoutMs: requestTimeoutMs }),
      requestJson(apiUrl(connection.baseUrl, `${sitePath}/pageviews`, {
        ...currentParams,
        unit: "day",
        timezone: "Europe/Madrid",
      }), { token, fetchImpl, timeoutMs: requestTimeoutMs }),
      requestJson(apiUrl(connection.baseUrl, `${sitePath}/metrics`, {
        ...currentParams,
        type: "path",
        limit: 8,
      }), { token, fetchImpl, timeoutMs: requestTimeoutMs }),
      requestJson(apiUrl(connection.baseUrl, `${sitePath}/metrics`, {
        ...currentParams,
        type: "referrer",
        limit: 8,
      }), { token, fetchImpl, timeoutMs: requestTimeoutMs }),
      requestJson(apiUrl(connection.baseUrl, `${sitePath}/metrics`, {
        ...currentParams,
        type: "country",
        limit: 8,
      }), { token, fetchImpl, timeoutMs: requestTimeoutMs }),
      requestJson(apiUrl(connection.baseUrl, `${sitePath}/metrics`, {
        ...currentParams,
        type: "device",
        limit: 8,
      }), { token, fetchImpl, timeoutMs: requestTimeoutMs }),
    ]);

    return {
      site,
      status: "ok",
      stats,
      previousStats,
      series,
      topPages: Array.isArray(topPages) ? topPages : [],
      topReferrers: Array.isArray(topReferrers) ? topReferrers : [],
      topCountries: Array.isArray(topCountries) ? topCountries : [],
      devices: Array.isArray(devices) ? devices : [],
    };
  } catch (error) {
    return {
      site,
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function fetchUmamiPanelData({
  connection,
  sites,
  range,
  fetchImpl = fetch,
  requestTimeoutMs = 10_000,
}) {
  if (!connection?.baseUrl || !connection?.password) {
    return sites.map((site) => ({
      site,
      status: "missing_connection",
      message: `Conexión Umami ${connection?.source || site.source} no configurada`,
    }));
  }

  let token;
  try {
    token = await getUmamiToken({ connection, fetchImpl, requestTimeoutMs });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return sites.map((site) => ({ site, status: "error", message }));
  }

  const resolvedSites = await resolveUmamiSites({ connection, token, sites, fetchImpl, requestTimeoutMs });
  return Promise.all(
    resolvedSites.map((site) =>
      fetchUmamiSiteData({ connection, token, site, range, fetchImpl, requestTimeoutMs }),
    ),
  );
}

export async function fetchAllUmamiPanelData({
  connections,
  sites,
  range,
  fetchImpl = fetch,
  requestTimeoutMs = 10_000,
}) {
  const sources = ["personal", "agama"];
  const reportsBySource = await Promise.all(
    sources.map((source) => {
      const sourceSites = sites.filter((site) => site.source === source);
      if (sourceSites.length === 0) return [];
      return fetchUmamiPanelData({
        connection: connections[source],
        sites: sourceSites,
        range,
        fetchImpl,
        requestTimeoutMs,
      });
    }),
  );
  const reportsByKey = new Map(reportsBySource.flat().map((report) => [report.site.key, report]));
  return sites.map((site) => reportsByKey.get(site.key));
}

export { SITE_REGISTRY };
