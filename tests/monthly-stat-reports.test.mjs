import test from "node:test";
import assert from "node:assert/strict";

import {
  getConfiguredReportSites,
  getPreviousMonthRange,
  processMonthlyStatReport,
} from "../src/lib/cron/monthly-stat-reports.mjs";

test("previous month range uses full UTC calendar month", () => {
  const range = getPreviousMonthRange(new Date("2026-08-25T10:30:00.000Z"));

  assert.equal(range.monthKey, "2026-07");
  assert.equal(range.label, "julio 2026");
  assert.equal(range.startAt, Date.UTC(2026, 6, 1));
  assert.equal(range.endAt, Date.UTC(2026, 7, 1) - 1);
});

test("configured report sites keep missing website ids visible", () => {
  const sites = getConfiguredReportSites({
    STAT_REPORT_UMAMI_WEBSITE_ID_WEBFUENGIROLA: "wf-id",
    STAT_REPORT_UMAMI_WEBSITE_ID_SUPERENTRENADOR: "super-id",
  });

  assert.equal(sites.length, 8);
  assert.deepEqual(
    sites.map((site) => [site.key, site.websiteId ?? null]),
    [
      ["webfuengirola", "wf-id"],
      ["vivirenfuengirola", null],
      ["conocef", null],
      ["topfuengirola", null],
      ["samuelcoachdealeman", null],
      ["vikingfitness", null],
      ["personaltrainerfuengirola", null],
      ["gimnasionuevoestilo", null],
    ],
  );
});

test("monthly report writes one markdown file and sends it with a monthly idempotency key", async () => {
  const writes = [];
  const sent = [];
  const fetched = [];

  const result = await processMonthlyStatReport({
    now: new Date("2026-08-25T10:30:00.000Z"),
    sites: [
      {
        key: "webfuengirola",
        label: "Web Fuengirola",
        domain: "webfuengirola.com",
        websiteId: "wf-id",
      },
      {
        key: "conocef",
        label: "Conoce Fuengirola",
        domain: "conocefuengirola.com",
      },
    ],
    fetchSiteSummary: async ({ site, range }) => {
      fetched.push([site.key, range.monthKey]);
      return {
        site,
        status: "ok",
        stats: {
          pageviews: 1200,
          visitors: 420,
          visits: 510,
          bounces: 180,
          totaltime: 3600,
        },
        topPages: [{ x: "/servicios", y: 80 }],
        topReferrers: [{ x: "google.com", y: 44 }],
        topCountries: [{ x: "ES", y: 300 }],
        devices: [{ x: "mobile", y: 260 }],
      };
    },
    writeReport: async (report) => {
      writes.push(report);
      return "/reports/2026-07.md";
    },
    sendReport: async (email) => {
      sent.push(email);
    },
    reportTo: "sam@example.com",
  });

  assert.deepEqual(fetched, [["webfuengirola", "2026-07"]]);
  assert.equal(writes.length, 1);
  assert.match(writes[0].markdown, /# Informe estadístico mensual - julio 2026/);
  assert.match(writes[0].markdown, /Web Fuengirola/);
  assert.match(writes[0].markdown, /Conoce Fuengirola/);
  assert.match(writes[0].markdown, /Sin websiteId configurado/);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].idempotencyKey, "monthly-stat-report-2026-07");
  assert.equal(sent[0].to, "sam@example.com");
  assert.equal(result.generated, true);
  assert.equal(result.sent, true);
  assert.equal(result.filePath, "/reports/2026-07.md");
});

test("monthly report renders previous-period deltas from legacy Umami stats", async () => {
  const result = await processMonthlyStatReport({
    now: new Date("2026-08-25T10:30:00.000Z"),
    sites: [
      {
        key: "webfuengirola",
        label: "Web Fuengirola",
        domain: "webfuengirola.com",
        websiteId: "wf-id",
      },
    ],
    fetchSiteSummary: async ({ site }) => ({
      site,
      status: "ok",
      stats: {
        pageviews: { value: 20, prev: 12 },
        visitors: { value: 8, prev: 10 },
        visits: { value: 11, prev: 9 },
        bounces: { value: 3, prev: 4 },
        totaltime: { value: 120, prev: 90 },
      },
      topPages: [],
      topReferrers: [],
      topCountries: [],
      devices: [],
    }),
    writeReport: async (report) => report.markdown,
  });

  assert.match(result.filePath, /Páginas vistas: 20 \(\+8 vs\. mes anterior\)/);
  assert.match(result.filePath, /Visitantes: 8 \(-2 vs\. mes anterior\)/);
});
