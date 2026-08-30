import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  fetchAllUmamiPanelData,
  fetchUmamiPanelData,
  getConfiguredUmamiSites,
  getPanelUmamiSites,
  getTrailingComparisonRange,
  getUmamiConnections,
} from "../src/lib/analytics/umami-core.mjs";

function jsonResponse(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return JSON.stringify(data);
    },
  };
}

test("every WF Studio panel maps to at least one Umami site", () => {
  const sites = getConfiguredUmamiSites({});

  for (const panel of [
    "wf-studio",
    "vivir",
    "conoce",
    "samuel-coach",
    "vokabel-world",
    "superentrenador",
    "todoplastico",
  ]) {
    assert.ok(getPanelUmamiSites(panel, sites).length > 0, panel);
  }
});

test("TodoPlastico is isolated on agama and every other site uses personal", () => {
  const sites = getConfiguredUmamiSites({});
  const todoPlastico = sites.find((site) => site.key === "todoplastico");

  assert.equal(todoPlastico?.source, "agama");
  assert.deepEqual(
    sites.filter((site) => site.source === "agama").map((site) => site.key),
    ["todoplastico"],
  );
  assert.equal(sites.filter((site) => site.source === "personal").length, 13);
});

test("registry exposes all fourteen sites with their exact panel grouping", () => {
  const sites = getConfiguredUmamiSites({});

  assert.equal(sites.length, 14);
  assert.deepEqual(
    getPanelUmamiSites("vokabel-world", sites).map((site) => site.key),
    ["vokabellab", "imkontext", "derdiedas"],
  );
  assert.deepEqual(
    getPanelUmamiSites("superentrenador", sites).map((site) => site.key),
    ["superentrenador", "coachstudio"],
  );
});

test("new connection variables override legacy monthly-report variables", () => {
  const connections = getUmamiConnections({
    UMAMI_PERSONAL_URL: "https://new.example",
    UMAMI_PERSONAL_USERNAME: "new-user",
    UMAMI_PERSONAL_PASSWORD: "new-secret",
    STAT_REPORT_UMAMI_URL: "https://legacy.example",
    STAT_REPORT_UMAMI_USERNAME: "legacy-user",
    STAT_REPORT_UMAMI_PASSWORD: "legacy-secret",
    UMAMI_AGAMA_URL: "https://agama.example",
    UMAMI_AGAMA_PASSWORD: "agama-secret",
  });

  assert.deepEqual(connections.personal, {
    source: "personal",
    baseUrl: "https://new.example",
    username: "new-user",
    password: "new-secret",
  });
  assert.deepEqual(connections.agama, {
    source: "agama",
    baseUrl: "https://agama.example",
    username: "admin",
    password: "agama-secret",
  });
});

test("legacy monthly-report variables remain valid for the personal connection", () => {
  const connections = getUmamiConnections({
    STAT_REPORT_UMAMI_URL: "https://legacy.example",
    STAT_REPORT_UMAMI_USERNAME: "legacy-user",
    STAT_REPORT_UMAMI_PASSWORD: "legacy-secret",
  });

  assert.equal(connections.personal.baseUrl, "https://legacy.example");
  assert.equal(connections.personal.username, "legacy-user");
  assert.equal(connections.personal.password, "legacy-secret");
});

test("new website IDs override legacy IDs without hiding unconfigured sites", () => {
  const sites = getConfiguredUmamiSites({
    UMAMI_WEBSITE_ID_WEBFUENGIROLA: "new-wf-id",
    STAT_REPORT_UMAMI_WEBSITE_ID_WEBFUENGIROLA: "legacy-wf-id",
    STAT_REPORT_UMAMI_WEBSITE_ID_VIVIRENFUENGIROLA: "legacy-vivir-id",
  });

  assert.equal(sites.find((site) => site.key === "webfuengirola")?.websiteId, "new-wf-id");
  assert.equal(sites.find((site) => site.key === "vivirenfuengirola")?.websiteId, "legacy-vivir-id");
  assert.equal(sites.find((site) => site.key === "conocef")?.websiteId, undefined);
});

test("standalone legacy aliases still resolve VokabelLab and TodoPlástico", () => {
  const sites = getConfiguredUmamiSites({
    STAT_REPORT_UMAMI_WEBSITE_ID_VOKABELWORLD: "legacy-vokabel-id",
    STAT_REPORT_UMAMI_WEBSITE_ID_AGAMA: "legacy-todo-id",
  });

  assert.equal(sites.find((site) => site.key === "vokabellab")?.websiteId, "legacy-vokabel-id");
  assert.equal(sites.find((site) => site.key === "todoplastico")?.websiteId, "legacy-todo-id");
});

test("30-day range ends now and compares the immediately preceding 30 days", () => {
  const now = new Date("2026-08-29T12:00:00.000Z");
  const day = 86_400_000;
  const range = getTrailingComparisonRange(now, 30);

  assert.equal(range.days, 30);
  assert.equal(range.endAt, now.getTime());
  assert.equal(range.startAt, now.getTime() - 30 * day);
  assert.equal(range.previousEndAt, range.startAt - 1);
  assert.equal(range.previousStartAt, range.startAt - 30 * day);
});

test("configured source authenticates once and returns current plus comparison data", async () => {
  const requests = [];
  const connection = {
    source: "personal",
    baseUrl: "https://personal.example",
    username: "admin",
    password: "secret",
  };
  const site = {
    key: "webfuengirola",
    label: "Web Fuengirola",
    domain: "webfuengirola.com",
    source: "personal",
    panelKey: "wf-studio",
    websiteId: "wf-id",
  };
  const range = getTrailingComparisonRange(new Date("2026-08-29T12:00:00.000Z"), 30);

  const reports = await fetchUmamiPanelData({
    connection,
    sites: [site],
    range,
    fetchImpl: async (url, init = {}) => {
      const parsed = new URL(String(url));
      requests.push([parsed.pathname, init.method ?? "GET", parsed.searchParams.get("startAt")]);
      if (parsed.pathname === "/api/auth/login") return jsonResponse({ token: "personal-token" });
      if (parsed.pathname.endsWith("/stats")) {
        return jsonResponse({ visitors: { value: parsed.searchParams.get("startAt") === String(range.startAt) ? 30 : 20 } });
      }
      if (parsed.pathname.endsWith("/pageviews")) {
        return jsonResponse({ pageviews: [{ x: "2026-08-29", y: 12 }], sessions: [] });
      }
      if (parsed.searchParams.get("type") === "path") return jsonResponse([{ x: "/", y: 14 }]);
      if (parsed.searchParams.get("type") === "referrer") return jsonResponse([{ x: "google.com", y: 9 }]);
      if (parsed.searchParams.get("type") === "country") return jsonResponse([{ x: "ES", y: 18 }]);
      if (parsed.searchParams.get("type") === "device") return jsonResponse([{ x: "mobile", y: 17 }]);
      return jsonResponse({ message: "unexpected" }, 500);
    },
  });

  assert.equal(requests.filter(([path]) => path === "/api/auth/login").length, 1);
  assert.equal(reports[0].status, "ok");
  assert.equal(reports[0].stats.visitors.value, 30);
  assert.equal(reports[0].previousStats.visitors.value, 20);
  assert.deepEqual(reports[0].series.pageviews, [{ x: "2026-08-29", y: 12 }]);
  assert.deepEqual(reports[0].topPages, [{ x: "/", y: 14 }]);
  assert.deepEqual(reports[0].topReferrers, [{ x: "google.com", y: 9 }]);
  assert.deepEqual(reports[0].topCountries, [{ x: "ES", y: 18 }]);
  assert.deepEqual(reports[0].devices, [{ x: "mobile", y: 17 }]);
  assert.equal(
    requests.some(([path]) => path.endsWith("/metrics")),
    true,
  );
});

test("Umami v3 API errors keep their nested message", async () => {
  const reports = await fetchUmamiPanelData({
    connection: {
      source: "personal",
      baseUrl: "https://personal.example",
      username: "admin",
      password: "secret",
    },
    sites: [{
      key: "webfuengirola",
      label: "Web Fuengirola",
      domain: "webfuengirola.com",
      source: "personal",
      panelKey: "wf-studio",
      websiteId: "wf-id",
    }],
    range: getTrailingComparisonRange(new Date("2026-08-29T12:00:00.000Z"), 30),
    fetchImpl: async (url) => {
      const parsed = new URL(String(url));
      if (parsed.pathname === "/api/auth/login") return jsonResponse({ token: "token" });
      return jsonResponse({ error: { message: "Bad request", code: "bad-request" } }, 400);
    },
  });

  assert.equal(reports[0].status, "error");
  assert.equal(reports[0].message, "Bad request");
});

test("failure of personal does not discard agama results or cross credentials", async () => {
  const loginBodies = [];
  const sites = [
    {
      key: "webfuengirola",
      label: "Web Fuengirola",
      domain: "webfuengirola.com",
      source: "personal",
      panelKey: "wf-studio",
      websiteId: "wf-id",
    },
    {
      key: "todoplastico",
      label: "TodoPlástico",
      domain: "todo-plastico.com",
      source: "agama",
      panelKey: "todoplastico",
      websiteId: "todo-id",
    },
  ];
  const connections = {
    personal: {
      source: "personal",
      baseUrl: "https://personal.example",
      username: "personal-user",
      password: "personal-secret",
    },
    agama: {
      source: "agama",
      baseUrl: "https://agama.example",
      username: "agama-user",
      password: "agama-secret",
    },
  };

  const reports = await fetchAllUmamiPanelData({
    connections,
    sites,
    range: getTrailingComparisonRange(new Date("2026-08-29T12:00:00.000Z"), 30),
    fetchImpl: async (url, init = {}) => {
      const parsed = new URL(String(url));
      if (parsed.pathname === "/api/auth/login") {
        const body = JSON.parse(init.body);
        loginBodies.push([parsed.origin, body]);
        if (parsed.origin === "https://personal.example") return jsonResponse({ message: "offline" }, 503);
        return jsonResponse({ token: "agama-token" });
      }
      if (parsed.origin !== "https://agama.example") return jsonResponse({ message: "crossed source" }, 500);
      if (parsed.pathname.endsWith("/stats")) return jsonResponse({ visitors: { value: 5 } });
      if (parsed.pathname.endsWith("/pageviews")) return jsonResponse({ pageviews: [], sessions: [] });
      if (parsed.pathname.endsWith("/metrics")) return jsonResponse([]);
      return jsonResponse({ message: "unexpected" }, 500);
    },
  });

  assert.deepEqual(loginBodies, [
    ["https://personal.example", { username: "personal-user", password: "personal-secret" }],
    ["https://agama.example", { username: "agama-user", password: "agama-secret" }],
  ]);
  assert.equal(reports.find((report) => report.site.source === "personal")?.status, "error");
  assert.equal(reports.find((report) => report.site.source === "agama")?.status, "ok");
});

test("missing connection and website IDs become explicit per-site states", async () => {
  const reports = await fetchAllUmamiPanelData({
    connections: {
      personal: { source: "personal", username: "admin" },
      agama: { source: "agama", baseUrl: "https://agama.example", username: "admin", password: "secret" },
    },
    sites: [
      { key: "webfuengirola", label: "WF", domain: "webfuengirola.com", source: "personal", panelKey: "wf-studio", websiteId: "wf-id" },
      { key: "todoplastico", label: "Todo", domain: "todo-plastico.com", source: "agama", panelKey: "todoplastico" },
    ],
    range: getTrailingComparisonRange(new Date("2026-08-29T12:00:00.000Z"), 30),
    fetchImpl: async (url) => {
      const parsed = new URL(String(url));
      if (parsed.pathname === "/api/auth/login") return jsonResponse({ token: "token" });
      if (parsed.pathname === "/api/websites") return jsonResponse([]);
      return jsonResponse({ message: "unexpected" }, 500);
    },
  });

  assert.equal(reports.find((report) => report.site.key === "webfuengirola")?.status, "missing_connection");
  assert.equal(reports.find((report) => report.site.key === "todoplastico")?.status, "missing_website_id");
});

test("dashboard facade caches per panel and filters sites before contacting Umami", async () => {
  const source = await readFile(
    new URL("../src/lib/data/umami-dashboard.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /unstable_cache/);
  assert.match(source, /umami-panel-dashboard-v2/);
  assert.match(source, /revalidate:\s*300/);
  assert.match(source, /fetchAllUmamiPanelData/);
  assert.match(source, /getPanelUmamiSites/);
  assert.match(source, /getCachedPanelAnalytics\(panelKey\)/);
  assert.doesNotMatch(source, /const reports = await getCachedAnalytics\(\)/);
});

test("environment example documents both Umami instances and every website ID without secrets", async () => {
  const source = await readFile(new URL("../.env.example", import.meta.url), "utf8");

  assert.match(source, /UMAMI_PERSONAL_URL=https:\/\/analytics\.187\.124\.55\.36\.sslip\.io/);
  assert.match(source, /UMAMI_AGAMA_URL=https:\/\/analytics\.2\.24\.10\.239\.sslip\.io/);
  assert.match(source, /^UMAMI_PERSONAL_PASSWORD=$/m);
  assert.match(source, /^UMAMI_AGAMA_PASSWORD=$/m);

  for (const key of [
    "WEBFUENGIROLA",
    "VIVIRENFUENGIROLA",
    "CONOCEF",
    "TOPFUENGIROLA",
    "SAMUELCOACHDEALEMAN",
    "VIKINGFITNESS",
    "PERSONALTRAINERFUENGIROLA",
    "GIMNASIONUEVOESTILO",
    "VOKABELLAB",
    "IMKONTEXT",
    "DERDIEDAS",
    "SUPERENTRENADOR",
    "COACHSTUDIO",
    "TODOPLASTICO",
  ]) {
    assert.match(source, new RegExp(`^UMAMI_WEBSITE_ID_${key}=$`, "m"), key);
  }

  assert.doesNotMatch(source, /^(?:UMAMI_(?:PERSONAL|AGAMA)_PASSWORD|STAT_REPORT_UMAMI_PASSWORD)=.+$/m);
});

test("shared Umami requests abort after the configured timeout", async () => {
  const connection = {
    source: "personal",
    baseUrl: "https://personal.example",
    username: "admin",
    password: "secret",
  };
  const startedAt = Date.now();

  const reports = await fetchUmamiPanelData({
    connection,
    sites: [{
      key: "webfuengirola",
      label: "Web Fuengirola",
      domain: "webfuengirola.com",
      source: "personal",
      panelKey: "wf-studio",
      websiteId: "wf-id",
    }],
    range: getTrailingComparisonRange(new Date("2026-08-29T12:00:00.000Z"), 30),
    requestTimeoutMs: 5,
    fetchImpl: async (_url, init = {}) => new Promise((_resolve, reject) => {
      assert.ok(init.signal, "fetch receives an abort signal");
      init.signal.addEventListener("abort", () => reject(new Error("request timed out")), { once: true });
    }),
  });

  assert.equal(reports[0].status, "error");
  assert.match(reports[0].message, /timed out/);
  assert.ok(Date.now() - startedAt < 250);
});
