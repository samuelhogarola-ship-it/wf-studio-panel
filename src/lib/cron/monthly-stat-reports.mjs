import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { isAuthorizedCronRequest } from "./pending-reminders.mjs";

const REPORT_SITES = [
  {
    key: "webfuengirola",
    label: "Web Fuengirola",
    domain: "webfuengirola.com",
  },
  {
    key: "vivirenfuengirola",
    label: "Vivir en Fuengirola",
    domain: "vivirenfuengirola.com",
  },
  {
    key: "conocef",
    label: "Conoce Fuengirola",
    domain: "conocefuengirola.com",
  },
  {
    key: "topfuengirola",
    label: "Top Fuengirola",
    domain: "topfuengirola.com",
  },
  {
    key: "samuelcoachdealeman",
    label: "Samuel Coach de Alemán",
    domain: "samuelcoachdealeman.com",
  },
  {
    key: "vikingfitness",
    label: "Viking Fitness",
    domain: "vikingfitness.es",
  },
  {
    key: "personaltrainerfuengirola",
    label: "Personal Trainer Fuengirola",
    domain: "personaltrainerfuengirola.com",
  },
  {
    key: "gimnasionuevoestilo",
    label: "Gimnasio Nuevo Estilo",
    domain: "gimnasionuevoestilo.com",
  },
];

const MONTHS_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function envKeyForSite(siteKey, suffix) {
  return `STAT_REPORT_UMAMI_${suffix}_${siteKey.toUpperCase()}`;
}

function numberValue(metric) {
  if (typeof metric === "number") return metric;
  if (metric && typeof metric.value === "number") return metric.value;
  return 0;
}

function previousValue(metricName, stats) {
  const metric = stats?.[metricName];
  if (metric && typeof metric.prev === "number") return metric.prev;
  if (stats?.comparison && typeof stats.comparison[metricName] === "number") {
    return stats.comparison[metricName];
  }
  return null;
}

function metricLine(label, value, previous) {
  if (previous === null || previous === undefined) return `- ${label}: ${value}`;
  const delta = value - previous;
  const sign = delta > 0 ? "+" : "";
  return `- ${label}: ${value} (${sign}${delta} vs. mes anterior)`;
}

function renderMetricList(rows) {
  if (!rows?.length) return "- Sin datos";
  return rows
    .slice(0, 8)
    .map((row) => `- ${row.x || "(sin dato)"}: ${row.y ?? 0}`)
    .join("\n");
}

function apiUrl(baseUrl, endpoint, params) {
  const url = new URL(endpoint, baseUrl);
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }
  return url;
}

async function requestJson(url, { token, method = "GET", body, fetchImpl = fetch } = {}) {
  const response = await fetchImpl(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = data?.message || data?.error || `HTTP ${response.status}`;
    throw new Error(message);
  }
  return data;
}

export function getPreviousMonthRange(now = new Date()) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1) - 1);
  const monthNumber = start.getUTCMonth() + 1;

  return {
    monthKey: `${start.getUTCFullYear()}-${String(monthNumber).padStart(2, "0")}`,
    label: `${MONTHS_ES[start.getUTCMonth()]} ${start.getUTCFullYear()}`,
    startAt: start.getTime(),
    endAt: end.getTime(),
  };
}

export function getConfiguredReportSites(env = process.env) {
  return REPORT_SITES.map((site) => ({
    ...site,
    domain: env[envKeyForSite(site.key, "DOMAIN")] || site.domain,
    websiteId: env[envKeyForSite(site.key, "WEBSITE_ID")] || undefined,
  }));
}

export async function getUmamiToken({ baseUrl, username, password, fetchImpl = fetch }) {
  const login = await requestJson(apiUrl(baseUrl, "/api/auth/login"), {
    method: "POST",
    body: { username, password },
    fetchImpl,
  });
  return login.token;
}

export async function resolveReportSites({ baseUrl, token, sites, fetchImpl = fetch }) {
  const response = await requestJson(apiUrl(baseUrl, "/api/websites", { pageSize: 200 }), {
    token,
    fetchImpl,
  });
  const websites = Array.isArray(response) ? response : response?.data || [];

  return sites.map((site) => {
    if (site.websiteId) return site;
    const match = websites.find((website) => {
      const id = website.id || website.websiteId || website.website_id;
      const domain = website.domain || "";
      const name = website.name || "";
      return id && (domain === site.domain || name.toLowerCase() === site.label.toLowerCase());
    });
    return match ? { ...site, websiteId: match.id || match.websiteId || match.website_id } : site;
  });
}

export async function fetchUmamiSiteSummary({
  baseUrl,
  token,
  site,
  range,
  fetchImpl = fetch,
}) {
  if (!site.websiteId) {
    return {
      site,
      status: "missing_website_id",
      message: "Sin websiteId configurado",
    };
  }

  try {
    const baseParams = {
      startAt: range.startAt,
      endAt: range.endAt,
    };
    const [stats, topPages, topReferrers, topCountries, devices] = await Promise.all([
      requestJson(apiUrl(baseUrl, `/api/websites/${site.websiteId}/stats`, baseParams), {
        token,
        fetchImpl,
      }),
      requestJson(apiUrl(baseUrl, `/api/websites/${site.websiteId}/metrics`, {
        ...baseParams,
        type: "url",
        limit: 8,
      }), { token, fetchImpl }),
      requestJson(apiUrl(baseUrl, `/api/websites/${site.websiteId}/metrics`, {
        ...baseParams,
        type: "referrer",
        limit: 8,
      }), { token, fetchImpl }),
      requestJson(apiUrl(baseUrl, `/api/websites/${site.websiteId}/metrics`, {
        ...baseParams,
        type: "country",
        limit: 8,
      }), { token, fetchImpl }),
      requestJson(apiUrl(baseUrl, `/api/websites/${site.websiteId}/metrics`, {
        ...baseParams,
        type: "device",
        limit: 8,
      }), { token, fetchImpl }),
    ]);

    return {
      site,
      status: "ok",
      stats,
      topPages,
      topReferrers,
      topCountries,
      devices,
    };
  } catch (error) {
    return {
      site,
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export function renderMonthlyStatReport({ range, siteReports, generatedAt = new Date() }) {
  const lines = [
    `# Informe estadístico mensual - ${range.label}`,
    "",
    `Generado: ${generatedAt.toISOString()}`,
    "",
    "## Resumen por proyecto",
    "",
  ];

  for (const report of siteReports) {
    const { site } = report;
    lines.push(`### ${site.label}`);
    lines.push("");
    lines.push(`- Dominio: ${site.domain}`);

    if (report.status !== "ok") {
      lines.push(`- Estado: ${report.message || "No disponible"}`);
      lines.push("");
      continue;
    }

    const stats = report.stats || {};
    const pageviews = numberValue(stats.pageviews);
    const visitors = numberValue(stats.visitors);
    const visits = numberValue(stats.visits);
    const bounces = numberValue(stats.bounces);
    const totaltime = numberValue(stats.totaltime);

    lines.push(metricLine("Páginas vistas", pageviews, previousValue("pageviews", stats)));
    lines.push(metricLine("Visitantes", visitors, previousValue("visitors", stats)));
    lines.push(metricLine("Visitas", visits, previousValue("visits", stats)));
    lines.push(metricLine("Rebotes", bounces, previousValue("bounces", stats)));
    lines.push(`- Tiempo total: ${Math.round(totaltime / 60)} min`);
    lines.push("");
    lines.push("Páginas principales:");
    lines.push(renderMetricList(report.topPages));
    lines.push("");
    lines.push("Referencias principales:");
    lines.push(renderMetricList(report.topReferrers));
    lines.push("");
    lines.push("Países:");
    lines.push(renderMetricList(report.topCountries));
    lines.push("");
    lines.push("Dispositivos:");
    lines.push(renderMetricList(report.devices));
    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}

export async function writeMonthlyStatReportFile({
  monthKey,
  markdown,
  storageDir = path.join(process.cwd(), "storage", "stat-reports"),
}) {
  await mkdir(storageDir, { recursive: true });
  const filePath = path.join(storageDir, `${monthKey}.md`);
  await writeFile(filePath, markdown, "utf8");
  return filePath;
}

export async function processMonthlyStatReport({
  now = new Date(),
  sites,
  fetchSiteSummary,
  writeReport,
  sendReport,
  reportTo,
}) {
  const range = getPreviousMonthRange(now);
  const siteReports = [];

  for (const site of sites) {
    if (!site.websiteId) {
      siteReports.push({
        site,
        status: "missing_website_id",
        message: "Sin websiteId configurado",
      });
      continue;
    }
    siteReports.push(await fetchSiteSummary({ site, range }));
  }

  const markdown = renderMonthlyStatReport({ range, siteReports, generatedAt: now });
  const filePath = await writeReport({ monthKey: range.monthKey, markdown });

  if (reportTo && sendReport) {
    await sendReport({
      to: reportTo,
      subject: `Informe estadístico mensual - ${range.label}`,
      markdown,
      filePath,
      monthKey: range.monthKey,
      idempotencyKey: `monthly-stat-report-${range.monthKey}`,
    });
  }

  return {
    generated: true,
    sent: Boolean(reportTo && sendReport),
    filePath,
    monthKey: range.monthKey,
    siteReports,
  };
}

export { isAuthorizedCronRequest };
