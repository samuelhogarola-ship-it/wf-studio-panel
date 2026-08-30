import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  getConfiguredReportSites,
  getPreviousMonthRange,
  processMonthlyStatReport,
} from "../src/lib/cron/monthly-stat-reports.mjs";
import * as monthlyReports from "../src/lib/cron/monthly-stat-reports.mjs";
import {
  createMonthlyStatReportRepository,
} from "../src/lib/data/monthly-stat-reports.mjs";

function createReportDatabase(initialRows = []) {
  const rows = new Map(initialRows.map((row) => [row.month_key, { ...row }]));
  const claims = new Map();

  return {
    rows,
    claims,
    async rpc(name, params) {
      let row = rows.get(params.p_month_key);

      if (name === "save_monthly_stat_report_snapshot") {
        if (row?.email_sent_at) return { data: "sent", error: null };
        if (claims.has(params.p_month_key)) return { data: "claimed", error: null };
        row = {
          ...row,
          month_key: params.p_month_key,
          label: params.p_label,
          markdown: params.p_markdown,
          site_reports: params.p_site_reports,
          generated_at: params.p_generated_at,
          is_complete: params.p_is_complete,
        };
        rows.set(params.p_month_key, row);
        return { data: "saved", error: null };
      }

      if (!row) return { data: null, error: { message: "report missing" } };

      if (name === "claim_monthly_stat_report_delivery_snapshot") {
        const claim = claims.get(params.p_month_key);
        const claimIsActive = claim && claim.claimedAt >= Date.now() - 15 * 60 * 1000;
        if (!row.is_complete || row.email_sent_at || claimIsActive) return { data: null, error: null };
        claims.set(params.p_month_key, { token: params.p_claim_token, claimedAt: Date.now() });
        return { data: { label: row.label, markdown: row.markdown }, error: null };
      }
      if (name === "complete_monthly_stat_report_delivery") {
        assert.equal(claims.get(params.p_month_key)?.token, params.p_claim_token);
        row.email_sent_at = params.p_sent_at;
        row.email_message_id = params.p_message_id;
        claims.delete(params.p_month_key);
        return { data: true, error: null };
      }
      if (name === "release_monthly_stat_report_delivery") {
        claims.delete(params.p_month_key);
        row.last_delivery_error = params.p_error;
        return { data: true, error: null };
      }
      return { data: null, error: { message: `unknown rpc ${name}` } };
    },
    from(table) {
      assert.equal(table, "monthly_stat_reports");
      return {
        select(columns) {
          return {
            eq(column, value) {
              assert.equal(columns, "email_sent_at");
              assert.equal(column, "month_key");
              return {
                async maybeSingle() {
                  return { data: rows.get(value) ?? null, error: null };
                },
              };
            },
            async order(column, options) {
              assert.equal(column, "month_key");
              assert.deepEqual(options, { ascending: false });
              return {
                data: [...rows.values()].sort((a, b) => b.month_key.localeCompare(a.month_key)),
                error: null,
              };
            },
          };
        },
      };
    },
  };
}

test("previous month range uses full UTC calendar month", () => {
  const range = getPreviousMonthRange(new Date("2026-08-25T10:30:00.000Z"));

  assert.equal(range.monthKey, "2026-07");
  assert.equal(range.label, "julio 2026");
  assert.equal(range.startAt, Date.UTC(2026, 6, 1));
  assert.equal(range.endAt, Date.UTC(2026, 7, 1) - 1);
});

test("configured report sites include all panels and keep missing website ids visible", () => {
  const sites = getConfiguredReportSites({
    STAT_REPORT_UMAMI_WEBSITE_ID_WEBFUENGIROLA: "wf-id",
    STAT_REPORT_UMAMI_WEBSITE_ID_SUPERENTRENADOR: "super-id",
  });

  assert.equal(sites.length, 14);
  assert.equal(sites.find((site) => site.key === "webfuengirola")?.source, "personal");
  assert.equal(sites.find((site) => site.key === "webfuengirola")?.websiteId, "wf-id");
  assert.equal(sites.find((site) => site.key === "superentrenador")?.websiteId, "super-id");
  assert.equal(sites.find((site) => site.key === "todoplastico")?.source, "agama");
  assert.equal(sites.find((site) => site.key === "todoplastico")?.websiteId, undefined);
});

test("monthly cron authorization accepts shared and dedicated secrets", () => {
  const input = { cronSecret: "vercel", monthlySecret: "external", headerSecret: null };

  assert.equal(monthlyReports.isAuthorizedMonthlyCronRequest({ ...input, authorization: "Bearer vercel" }), true);
  assert.equal(monthlyReports.isAuthorizedMonthlyCronRequest({ ...input, authorization: "Bearer external" }), true);
  assert.equal(monthlyReports.isAuthorizedMonthlyCronRequest({ ...input, authorization: "Bearer wrong" }), false);
});

test("monthly report configuration requires an explicit recipient", () => {
  assert.throws(
    () => monthlyReports.getMonthlyStatReportConfig({
      STAT_REPORT_UMAMI_URL: "https://analytics.example.com",
      STAT_REPORT_UMAMI_PASSWORD: "secret",
    }),
    /STAT_REPORT_EMAIL_TO or RESEND_TO_EMAIL is required/,
  );
});

test("website resolution skips the listing request when every id is configured", async () => {
  const sites = [{ key: "wf", label: "WF", domain: "example.com", websiteId: "wf-id" }];

  const resolved = await monthlyReports.resolveReportSites({
    baseUrl: "https://analytics.example.com",
    token: "token",
    sites,
    fetchImpl: async () => {
      throw new Error("listing should not be requested");
    },
  });

  assert.deepEqual(resolved, sites);
});

test("website resolution preserves configured ids when the listing request fails", async () => {
  const sites = [
    { key: "wf", label: "WF", domain: "example.com", websiteId: "wf-id" },
    { key: "missing", label: "Missing", domain: "missing.example.com" },
  ];

  const resolved = await monthlyReports.resolveReportSites({
    baseUrl: "https://analytics.example.com",
    token: "token",
    sites,
    fetchImpl: async () => {
      throw new Error("Umami unavailable");
    },
  });

  assert.deepEqual(resolved, sites);
});

test("incomplete monthly report is persisted but not sent", async () => {
  const saves = [];
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
    saveReport: async (report) => {
      saves.push(report);
      return "supabase:monthly_stat_reports/2026-07";
    },
    sendReport: async (email) => {
      sent.push(email);
    },
    reportTo: "sam@example.com",
  });

  assert.deepEqual(fetched, [["webfuengirola", "2026-07"]]);
  assert.equal(saves.length, 1);
  assert.match(saves[0].markdown, /# Informe estadístico mensual - julio 2026/);
  assert.match(saves[0].markdown, /Web Fuengirola/);
  assert.match(saves[0].markdown, /Conoce Fuengirola/);
  assert.match(saves[0].markdown, /Sin websiteId configurado/);
  assert.equal(sent.length, 0);
  assert.equal(result.generated, true);
  assert.equal(result.complete, false);
  assert.equal(result.sent, false);
  assert.equal(result.deliverySkippedReason, "incomplete_site_reports");
  assert.equal(result.storageRef, "supabase:monthly_stat_reports/2026-07");
});

test("complete monthly report sends with a monthly idempotency key", async () => {
  const sent = [];
  const sites = [{ key: "webfuengirola", label: "Web Fuengirola", domain: "webfuengirola.com", websiteId: "wf-id" }];
  const result = await processMonthlyStatReport({
    now: new Date("2026-08-25T10:30:00.000Z"),
    sites,
    fetchSiteReports: async () => [{ site: sites[0], status: "ok", stats: {}, previousStats: {}, topPages: [], topReferrers: [], topCountries: [], devices: [] }],
    saveReport: async () => "supabase:monthly_stat_reports/2026-07",
    sendReport: async (email) => { sent.push(email); return { sent: true }; },
    reportTo: "sam@example.com",
  });

  assert.equal(result.complete, true);
  assert.equal(result.sent, true);
  assert.equal(sent[0].idempotencyKey, "monthly-stat-report-2026-07");
  assert.equal(sent[0].to, "sam@example.com");
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
    saveReport: async (report) => report.markdown,
  });

  assert.match(result.storageRef, /Páginas vistas: 20 \(\+8 vs\. mes anterior\)/);
  assert.match(result.storageRef, /Visitantes: 8 \(-2 vs\. mes anterior\)/);
});

test("monthly report renders deltas from shared current and previous stats", async () => {
  const result = await processMonthlyStatReport({
    now: new Date("2026-08-25T10:30:00.000Z"),
    sites: [{ key: "webfuengirola", label: "Web Fuengirola", domain: "webfuengirola.com", websiteId: "wf-id" }],
    fetchSiteReports: async ({ sites }) => [{
      site: sites[0],
      status: "ok",
      stats: { pageviews: { value: 20 }, visitors: { value: 8 }, visits: { value: 11 }, bounces: { value: 3 }, totaltime: { value: 120 } },
      previousStats: { pageviews: { value: 12 }, visitors: { value: 10 }, visits: { value: 9 }, bounces: { value: 4 } },
      series: { pageviews: [], sessions: [] },
      topPages: [],
      topReferrers: [],
      topCountries: [],
      devices: [],
    }],
    saveReport: async (report) => report.markdown,
  });

  assert.match(result.storageRef, /Páginas vistas: 20 \(\+8 vs\. mes anterior\)/);
  assert.match(result.storageRef, /Visitantes: 8 \(-2 vs\. mes anterior\)/);
});

test("bulk dual-source results preserve source errors in the stored report", async () => {
  let savedReports;
  const sites = [
    { key: "webfuengirola", label: "Web Fuengirola", domain: "webfuengirola.com", source: "personal", panelKey: "wf-studio", websiteId: "wf-id" },
    { key: "todoplastico", label: "TodoPlástico", domain: "todo-plastico.com", source: "agama", panelKey: "todoplastico", websiteId: "todo-id" },
  ];

  const result = await processMonthlyStatReport({
    now: new Date("2026-08-25T10:30:00.000Z"),
    sites,
    fetchSiteReports: async () => [
      { site: sites[0], status: "error", message: "personal offline" },
      { site: sites[1], status: "ok", stats: { pageviews: 40 }, previousStats: { pageviews: 30 }, topPages: [], topReferrers: [], topCountries: [], devices: [] },
    ],
    saveReport: async ({ siteReports }) => {
      savedReports = siteReports;
      return "supabase:monthly_stat_reports/2026-07";
    },
  });

  assert.equal(result.generated, true);
  assert.equal(savedReports[0].message, "personal offline");
  assert.equal(savedReports[1].site.source, "agama");
  assert.equal(savedReports[1].status, "ok");
});

test("monthly route obtains both Umami sources through the shared core", async () => {
  const source = await readFile(
    new URL("../src/app/api/monthly-stat-reports/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /getUmamiConnections/);
  assert.match(source, /fetchAllUmamiPanelData/);
  assert.match(source, /status:\s*503/);
  assert.match(source, /ok:\s*false/);
  assert.doesNotMatch(source, /STAT_REPORT_UMAMI_URL/);
});

test("monthly report repository writes snapshots through the atomic RPC", async () => {
  const source = await readFile(
    new URL("../src/lib/data/monthly-stat-reports.mjs", import.meta.url),
    "utf8",
  );

  assert.match(source, /save_monthly_stat_report_snapshot/);
  assert.doesNotMatch(source, /\.upsert\(/);
});

test("monthly report repository upserts one durable row per month", async () => {
  const database = createReportDatabase();
  const repository = createMonthlyStatReportRepository(database);

  const saved = await repository.save({
    monthKey: "2026-07",
    label: "julio 2026",
    markdown: "# Informe julio\n",
    siteReports: [{ site: { key: "webfuengirola" }, status: "ok" }],
    generatedAt: "2026-08-01T09:00:00.000Z",
    complete: false,
  });

  assert.equal(saved.storageRef, "supabase:monthly_stat_reports/2026-07");
  assert.deepEqual(database.rows.get("2026-07"), {
    month_key: "2026-07",
    label: "julio 2026",
    markdown: "# Informe julio\n",
    site_reports: [{ site: { key: "webfuengirola" }, status: "ok" }],
    generated_at: "2026-08-01T09:00:00.000Z",
    is_complete: false,
  });
});

test("monthly report repository lists newest month first", async () => {
  const database = createReportDatabase([
    { month_key: "2026-06", label: "junio 2026", markdown: "junio" },
    { month_key: "2026-08", label: "agosto 2026", markdown: "agosto" },
    { month_key: "2026-07", label: "julio 2026", markdown: "julio" },
  ]);
  const repository = createMonthlyStatReportRepository(database);

  const reports = await repository.list();

  assert.deepEqual(reports.map((report) => report.month_key), ["2026-08", "2026-07", "2026-06"]);
});

test("monthly report repository surfaces Supabase write failures", async () => {
  const database = {
    async rpc() {
      return { data: null, error: { message: "database unavailable" } };
    },
  };
  const repository = createMonthlyStatReportRepository(database);

  await assert.rejects(
    repository.save({
      monthKey: "2026-07",
      label: "julio 2026",
      markdown: "# Informe julio\n",
      siteReports: [],
      generatedAt: "2026-08-01T09:00:00.000Z",
    }),
    /Save monthly stat report: database unavailable/,
  );
});

test("monthly report repository claims delivery once and persists completion", async () => {
  const database = createReportDatabase();
  const repository = createMonthlyStatReportRepository(database);
  await repository.save({
    monthKey: "2026-07",
    label: "julio 2026",
    markdown: "# Informe julio\n",
    siteReports: [],
    generatedAt: "2026-08-01T09:00:00.000Z",
    complete: true,
  });

  assert.deepEqual(
    await repository.claimDelivery({ monthKey: "2026-07", claimToken: "claim-1", emailTo: "admin@example.com" }),
    { label: "julio 2026", markdown: "# Informe julio\n" },
  );
  assert.equal(await repository.claimDelivery({ monthKey: "2026-07", claimToken: "claim-2", emailTo: "admin@example.com" }), null);

  await repository.completeDelivery({
    monthKey: "2026-07",
    claimToken: "claim-1",
    sentAt: "2026-08-01T09:01:00.000Z",
    messageId: "email-1",
  });

  assert.equal(await repository.claimDelivery({ monthKey: "2026-07", claimToken: "claim-3", emailTo: "admin@example.com" }), null);
  assert.equal(database.rows.get("2026-07").email_message_id, "email-1");
});

test("monthly report repository recovers an expired delivery claim", async () => {
  const database = createReportDatabase([{
    month_key: "2026-07",
    label: "julio 2026",
    markdown: "# Informe julio\n",
    site_reports: [{ status: "ok" }],
    generated_at: "2026-08-01T09:00:00.000Z",
    is_complete: true,
  }]);
  database.claims.set("2026-07", {
    token: "orphaned-claim",
    claimedAt: Date.now() - 16 * 60 * 1000,
  });
  const repository = createMonthlyStatReportRepository(database);

  assert.deepEqual(
    await repository.claimDelivery({ monthKey: "2026-07", claimToken: "recovery-claim", emailTo: "admin@example.com" }),
    { label: "julio 2026", markdown: "# Informe julio\n" },
  );
  assert.equal(database.claims.get("2026-07").token, "recovery-claim");
});

test("monthly report repository preserves the emailed snapshot on later saves", async () => {
  const database = createReportDatabase([{
    month_key: "2026-07",
    label: "julio 2026",
    markdown: "# Snapshot enviado\n",
    site_reports: [{ status: "ok" }],
    generated_at: "2026-08-01T09:00:00.000Z",
    email_sent_at: "2026-08-01T09:01:00.000Z",
    email_message_id: "email-1",
  }]);
  const repository = createMonthlyStatReportRepository(database);

  await repository.save({
    monthKey: "2026-07",
    label: "julio 2026 corregido",
    markdown: "# Contenido posterior\n",
    siteReports: [{ status: "error" }],
    generatedAt: "2026-08-02T09:00:00.000Z",
  });

  assert.equal(database.rows.get("2026-07").markdown, "# Snapshot enviado\n");
  assert.equal(database.rows.get("2026-07").email_message_id, "email-1");
});

test("monthly report repository preserves the claimed snapshot before completion", async () => {
  const database = createReportDatabase();
  const repository = createMonthlyStatReportRepository(database);
  await repository.save({
    monthKey: "2026-07",
    label: "julio 2026",
    markdown: "# Snapshot reclamado\n",
    siteReports: [{ status: "ok" }],
    generatedAt: "2026-08-01T09:00:00.000Z",
    complete: true,
  });
  await repository.claimDelivery({ monthKey: "2026-07", claimToken: "claim-1", emailTo: "admin@example.com" });

  const saved = await repository.save({
    monthKey: "2026-07",
    label: "julio 2026 posterior",
    markdown: "# No debe sobrescribir\n",
    siteReports: [{ status: "error" }],
    generatedAt: "2026-08-01T09:02:00.000Z",
  });

  assert.equal(saved.preserved, true);
  assert.equal(database.rows.get("2026-07").markdown, "# Snapshot reclamado\n");
});

test("reports page keeps legacy disk reports as a migration fallback", async () => {
  const source = await readFile(
    new URL("../src/app/paneladmin/(protected)/informes/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /STAT_REPORT_STORAGE_DIR/);
  assert.match(source, /getLegacyStatReports/);
  assert.match(source, /databaseReports/);
});

test("delivery sends the exact snapshot returned by the atomic claim", async () => {
  const database = createReportDatabase();
  const repository = createMonthlyStatReportRepository(database);
  const sent = [];

  await repository.save({
    monthKey: "2026-07",
    label: "julio 2026 A",
    markdown: "# Snapshot A\n",
    siteReports: [{ status: "ok" }],
    generatedAt: "2026-08-01T09:00:00.000Z",
    complete: true,
  });
  await repository.save({
    monthKey: "2026-07",
    label: "julio 2026 B",
    markdown: "# Snapshot B\n",
    siteReports: [{ status: "ok" }],
    generatedAt: "2026-08-01T09:00:01.000Z",
    complete: true,
  });

  await monthlyReports.deliverMonthlyStatReport({
    monthKey: "2026-07",
    emailTo: "admin@example.com",
    claimToken: "claim-1",
    claimDelivery: (input) => repository.claimDelivery(input),
    send: async (snapshot) => {
      sent.push(snapshot);
      return { id: "email-1" };
    },
    completeDelivery: (input) => repository.completeDelivery(input),
    releaseDelivery: (input) => repository.releaseDelivery(input),
  });

  assert.deepEqual(sent, [{ label: "julio 2026 B", markdown: "# Snapshot B\n" }]);
  assert.equal(database.rows.get("2026-07").markdown, "# Snapshot B\n");
  assert.equal(database.rows.get("2026-07").email_message_id, "email-1");
});

test("an already delivered month stays satisfied during an incomplete retry", async () => {
  const database = createReportDatabase([{
    month_key: "2026-07",
    label: "julio 2026",
    markdown: "# Snapshot enviado\n",
    site_reports: [{ status: "ok" }],
    generated_at: "2026-08-01T09:00:00.000Z",
    is_complete: true,
    email_sent_at: "2026-08-01T09:01:00.000Z",
  }]);
  const repository = createMonthlyStatReportRepository(database);
  let sendCalls = 0;

  const result = await processMonthlyStatReport({
    now: new Date("2026-08-25T10:30:00.000Z"),
    sites: [{ key: "webfuengirola", label: "Web Fuengirola", domain: "webfuengirola.com", websiteId: "wf-id" }],
    fetchSiteReports: async ({ sites }) => [{ site: sites[0], status: "error", message: "Umami unavailable" }],
    saveReport: (report) => repository.save(report),
    sendReport: async () => { sendCalls += 1; },
    reportTo: "admin@example.com",
  });

  assert.equal(result.complete, false);
  assert.equal(result.alreadySent, true);
  assert.equal(result.deliverySatisfied, true);
  assert.equal(sendCalls, 0);
  assert.equal(database.rows.get("2026-07").markdown, "# Snapshot enviado\n");
});

test("an active concurrent claim is not reported as a satisfied delivery", async () => {
  const sites = [{ key: "webfuengirola", label: "Web Fuengirola", domain: "webfuengirola.com", websiteId: "wf-id" }];
  const result = await processMonthlyStatReport({
    now: new Date("2026-08-25T10:30:00.000Z"),
    sites,
    fetchSiteReports: async () => [{ site: sites[0], status: "ok", stats: {}, previousStats: {}, topPages: [], topReferrers: [], topCountries: [], devices: [] }],
    saveReport: async () => ({ storageRef: "supabase:monthly_stat_reports/2026-07", preserved: true, alreadySent: false }),
    sendReport: async () => ({ sent: false }),
    reportTo: "admin@example.com",
  });

  assert.equal(result.complete, true);
  assert.equal(result.sent, false);
  assert.equal(result.deliverySatisfied, false);
});

test("accepted email with failed completion keeps its claim and is not released", async () => {
  let released = false;

  await assert.rejects(
    monthlyReports.deliverMonthlyStatReport({
      monthKey: "2026-07",
      emailTo: "admin@example.com",
      claimToken: "claim-1",
      claimDelivery: async () => ({ label: "julio 2026", markdown: "# Informe julio\n" }),
      send: async () => ({ id: "email-1" }),
      completeDelivery: async () => {
        throw new Error("database unavailable");
      },
      releaseDelivery: async () => {
        released = true;
      },
    }),
    /Email accepted but completion failed: database unavailable/,
  );

  assert.equal(released, false);
});
