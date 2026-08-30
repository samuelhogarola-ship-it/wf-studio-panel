const SITE_REGISTRY = [
  ["webfuengirola", "Web Fuengirola", "webfuengirola.com", "personal", "wf-studio"],
  ["vivirenfuengirola", "Vivir en Fuengirola", "vivirenfuengirola.com", "personal", "vivir"],
  ["conocef", "Conoce Fuengirola", "conocefuengirola.com", "personal", "conoce"],
  ["topfuengirola", "Top Fuengirola", "topfuengirola.com", "personal", "reports-only"],
  ["samuelcoachdealeman", "Samuel Coach de Alemán", "samuelcoachdealeman.com", "personal", "samuel-coach"],
  ["vikingfitness", "Viking Fitness", "vikingfitness.es", "personal", "reports-only"],
  ["personaltrainerfuengirola", "Personal Trainer Fuengirola", "personaltrainerfuengirola.com", "personal", "reports-only"],
  ["gimnasionuevoestilo", "Gimnasio Nuevo Estilo", "gimnasionuevoestilo.com", "personal", "reports-only"],
  ["vokabellab", "VokabelLab", "vokabellab.com", "personal", "vokabel-world"],
  ["imkontext", "imKontext", "imkontext.vokabellab.com", "personal", "vokabel-world"],
  ["derdiedas", "Der Die Das", "derdiedas.vokabellab.com", "personal", "vokabel-world"],
  ["superentrenador", "Superentrenador", "superentrenador.com", "personal", "superentrenador"],
  ["coachstudio", "Coach Studio", "coach.superentrenador.com", "personal", "superentrenador"],
  ["todoplastico", "TodoPlástico", "todo-plastico.com", "agama", "todoplastico"],
];

const LEGACY_WEBSITE_ID_ENV = {
  vokabellab: "STAT_REPORT_UMAMI_WEBSITE_ID_VOKABELWORLD",
  todoplastico: "STAT_REPORT_UMAMI_WEBSITE_ID_AGAMA",
};

function siteEnvKey(siteKey, prefix) {
  return `${prefix}_${siteKey.toUpperCase()}`;
}

export function getConfiguredUmamiSites(env = process.env) {
  return SITE_REGISTRY.map(([key, label, defaultDomain, source, panelKey]) => ({
    key,
    label,
    domain:
      env[siteEnvKey(key, "UMAMI_DOMAIN")] ||
      env[siteEnvKey(key, "STAT_REPORT_UMAMI_DOMAIN")] ||
      defaultDomain,
    source,
    panelKey,
    websiteId:
      env[siteEnvKey(key, "UMAMI_WEBSITE_ID")] ||
      env[siteEnvKey(key, "STAT_REPORT_UMAMI_WEBSITE_ID")] ||
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

  return sites.map((site) => {
    if (site.websiteId) return site;
    const match = websites.find((website) => {
      const id = website.id || website.websiteId || website.website_id;
      const domain = String(website.domain || "").toLowerCase();
      const name = String(website.name || "").toLowerCase();
      return id && (domain === site.domain.toLowerCase() || name === site.label.toLowerCase());
    });
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
