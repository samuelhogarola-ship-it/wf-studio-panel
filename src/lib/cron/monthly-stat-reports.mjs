import { isAuthorizedCronRequest } from "./pending-reminders.mjs";
import {
  fetchUmamiSiteData as fetchSharedUmamiSiteData,
  getConfiguredUmamiSites,
  getUmamiToken as getSharedUmamiToken,
  resolveUmamiSites,
} from "../analytics/umami-core.mjs";

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

function numberValue(metric) {
  if (typeof metric === "number") return metric;
  if (metric && typeof metric.value === "number") return metric.value;
  return 0;
}

function previousValue(metricName, stats, previousStats) {
  if (previousStats?.[metricName] !== undefined) {
    return numberValue(previousStats[metricName]);
  }
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
    previousStartAt: Date.UTC(year, month - 2, 1),
    previousEndAt: start.getTime() - 1,
    days: Math.round((end.getTime() - start.getTime() + 1) / 86_400_000),
  };
}

export function getConfiguredReportSites(env = process.env) {
  return getConfiguredUmamiSites(env);
}

export function isAuthorizedMonthlyCronRequest({
  cronSecret,
  monthlySecret,
  authorization,
  headerSecret,
}) {
  return [cronSecret, monthlySecret]
    .filter(Boolean)
    .some((configuredSecret) => isAuthorizedCronRequest({ configuredSecret, authorization, headerSecret }));
}

export function getMonthlyStatReportConfig(env = process.env) {
  const reportTo = env.STAT_REPORT_EMAIL_TO || env.RESEND_TO_EMAIL;

  if (!reportTo) {
    throw new Error("STAT_REPORT_EMAIL_TO or RESEND_TO_EMAIL is required");
  }

  return {
    reportTo,
  };
}

export async function deliverMonthlyStatReport({
  monthKey,
  emailTo,
  claimToken,
  claimDelivery,
  send,
  completeDelivery,
  releaseDelivery,
}) {
  const claimedSnapshot = await claimDelivery({ monthKey, emailTo, claimToken });
  if (!claimedSnapshot) return { sent: false };

  let email;
  try {
    email = await send(claimedSnapshot);
  } catch (error) {
    await releaseDelivery({
      monthKey,
      claimToken,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  try {
    await completeDelivery({
      monthKey,
      claimToken,
      sentAt: new Date().toISOString(),
      messageId: email?.id ?? null,
    });
  } catch (error) {
    throw new Error(`Email accepted but completion failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  return { sent: true };
}

export async function getUmamiToken({ baseUrl, username, password, fetchImpl = fetch }) {
  return getSharedUmamiToken({
    connection: { source: "personal", baseUrl, username, password },
    fetchImpl,
  });
}

export async function resolveReportSites({ baseUrl, token, sites, fetchImpl = fetch }) {
  return resolveUmamiSites({
    connection: { source: "personal", baseUrl, username: "admin" },
    token,
    sites,
    fetchImpl,
  });
}

export async function fetchUmamiSiteSummary({
  baseUrl,
  token,
  site,
  range,
  fetchImpl = fetch,
}) {
  return fetchSharedUmamiSiteData({
    connection: { source: site.source || "personal", baseUrl, username: "admin" },
    token,
    site,
    range,
    fetchImpl,
  });
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

    lines.push(metricLine("Páginas vistas", pageviews, previousValue("pageviews", stats, report.previousStats)));
    lines.push(metricLine("Visitantes", visitors, previousValue("visitors", stats, report.previousStats)));
    lines.push(metricLine("Visitas", visits, previousValue("visits", stats, report.previousStats)));
    lines.push(metricLine("Rebotes", bounces, previousValue("bounces", stats, report.previousStats)));
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

export async function processMonthlyStatReport({
  now = new Date(),
  sites,
  fetchSiteSummary,
  fetchSiteReports,
  saveReport,
  sendReport,
  reportTo,
}) {
  const range = getPreviousMonthRange(now);
  const siteReports = fetchSiteReports
    ? await fetchSiteReports({ sites, range })
    : [];

  if (!fetchSiteReports) {
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
  }

  const markdown = renderMonthlyStatReport({ range, siteReports, generatedAt: now });
  const complete = siteReports.length === sites.length && siteReports.every((report) => report.status === "ok");
  const savedReport = await saveReport({
    monthKey: range.monthKey,
    label: range.label,
    markdown,
    siteReports,
    generatedAt: now.toISOString(),
    complete,
  });
  const storageRef = typeof savedReport === "string" ? savedReport : savedReport.storageRef;
  const alreadySent = typeof savedReport === "object" && savedReport?.alreadySent === true;

  let sent = false;
  if (complete && !alreadySent && reportTo && sendReport) {
    const delivery = await sendReport({
      to: reportTo,
      subject: `Informe estadístico mensual - ${range.label}`,
      markdown,
      storageRef,
      monthKey: range.monthKey,
      idempotencyKey: `monthly-stat-report-${range.monthKey}`,
    });
    sent = delivery?.sent !== false;
  }

  return {
    generated: true,
    complete,
    deliverySatisfied: sent || alreadySent,
    alreadySent,
    sent,
    deliverySkippedReason: complete ? undefined : "incomplete_site_reports",
    storageRef,
    monthKey: range.monthKey,
    siteReports,
  };
}

export { isAuthorizedCronRequest };
