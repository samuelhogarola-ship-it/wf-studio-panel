import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { renderToStaticMarkup } from "react-dom/server";

import {
  boundary,
  capability,
  database,
  loadProjectModule,
  project,
  projectId,
} from "./helpers/project-harness.mjs";

import {
  buildUmamiAnalyticsView,
  metricValue,
} from "../src/lib/analytics/umami-view-model.mjs";

function site(key, label = key) {
  return {
    key,
    label,
    domain: `${key}.example`,
    source: "personal",
    panelKey: "vokabel-world",
    websiteId: `${key}-id`,
  };
}

const activeAnalytics = {
  ...capability,
  id: "analytics",
  capability_key: "analytics",
  state: "active",
};

function adminStatisticsSetup({ configured = true, requireAdmin } = {}) {
  const db = database({
    client_projects: [{ ...project, analytics_registry_key: "example" }],
    project_capabilities: [activeAnalytics],
  });
  const b = boundary(db, {
    ...(requireAdmin ? { "@/lib/auth": { requireAdmin } } : {}),
    "@/lib/analytics/umami-core.mjs": {
      getConfiguredUmamiSites: () => configured ? [{
        key: "example",
        domain: "example.com",
        websiteId: "example-runtime-id",
        source: "personal",
      }] : [],
      getUmamiConnections: () => configured ? {
        personal: { baseUrl: "https://stats.example.test", password: "runtime-secret" },
      } : {},
    },
  });
  const Page = loadProjectModule(
    "src/app/paneladmin/(protected)/proyectos/[id]/estadisticas/page.tsx",
    b.mocks,
  ).default;
  return { Page, db, events: b.events };
}

test("administrator project statistics authenticates before resolving and renders the exact project analytics panel", async () => {
  const denied = adminStatisticsSetup({
    requireAdmin: async () => { throw new Error("redirect:/login"); },
  });
  await assert.rejects(
    () => denied.Page({ params: Promise.resolve({ id: projectId }) }),
    /redirect:\/login/,
  );
  assert.deepEqual(denied.db.calls, []);

  const allowed = adminStatisticsSetup();
  const html = renderToStaticMarkup(await allowed.Page({ params: Promise.resolve({ id: projectId }) }));

  assert.equal(allowed.events[0], "admin");
  assert.match(html, new RegExp(`href="/paneladmin/proyectos/${projectId}"`));
  assert.match(html, new RegExp(`id="${projectId}-analytics-title"`));
  assert.match(html, /Estadísticas de Example/);
});

test("administrator project statistics warns without mounting analytics when configuration is invalid", async () => {
  const s = adminStatisticsSetup({ configured: false });

  const html = renderToStaticMarkup(await s.Page({ params: Promise.resolve({ id: projectId }) }));

  assert.match(html, /configuraci[oó]n/i);
  assert.doesNotMatch(html, /Estadísticas de Example|Modo de estadísticas/);
});

test("metric values normalize Umami numbers and value objects", () => {
  assert.equal(metricValue(14), 14);
  assert.equal(metricValue({ value: 23 }), 23);
  assert.equal(metricValue(undefined), 0);
});

test("single-site view computes KPIs and previous-period comparisons", () => {
  const report = {
    site: site("webfuengirola", "Web Fuengirola"),
    status: "ok",
    stats: {
      visitors: { value: 120 },
      visits: { value: 150 },
      pageviews: { value: 410 },
      bounces: { value: 45 },
      totaltime: { value: 9_000 },
    },
    previousStats: {
      visitors: { value: 100 },
      visits: { value: 120 },
      pageviews: { value: 400 },
      bounces: { value: 48 },
      totaltime: { value: 6_000 },
    },
    series: { pageviews: [{ x: "2026-08-28", y: 10 }] },
    topPages: [{ x: "/servicios", y: 40 }],
    topReferrers: [{ x: "google.com", y: 30 }],
    topCountries: [],
    devices: [],
  };

  const view = buildUmamiAnalyticsView([report]);

  assert.equal(view.status, "ok");
  assert.equal(view.current.visitors, 120);
  assert.equal(view.current.bounceRate, 30);
  assert.equal(view.current.averageDuration, 60);
  assert.equal(view.previous.averageDuration, 50);
  assert.equal(view.comparisons.visitors, 20);
  assert.equal(view.comparisons.pageviews, 2.5);
  assert.deepEqual(view.series, [{ x: "2026-08-28", y: 10 }]);
});

test("multi-site view aggregates healthy sites and preserves unavailable sites", () => {
  const reports = [
    {
      site: site("vokabellab", "VokabelLab"),
      status: "ok",
      stats: { visitors: 20, visits: 30, pageviews: 70, bounces: 6, totaltime: 900 },
      previousStats: { visitors: 10, visits: 20, pageviews: 50, bounces: 5, totaltime: 500 },
      series: { pageviews: [{ x: "2026-08-28", y: 20 }, { x: "2026-08-29", y: 30 }] },
      topPages: [{ x: "/lernen", y: 20 }],
      topReferrers: [{ x: "google.com", y: 12 }],
      topCountries: [],
      devices: [],
    },
    {
      site: site("imkontext", "imKontext"),
      status: "ok",
      stats: { visitors: 30, visits: 40, pageviews: 90, bounces: 8, totaltime: 1_600 },
      previousStats: { visitors: 20, visits: 30, pageviews: 80, bounces: 6, totaltime: 900 },
      series: { pageviews: [{ x: "2026-08-28", y: 15 }] },
      topPages: [{ x: "/lernen", y: 10 }, { x: "/kurs", y: 8 }],
      topReferrers: [{ x: "google.com", y: 7 }, { x: "direct", y: 5 }],
      topCountries: [],
      devices: [],
    },
    {
      site: site("derdiedas", "Der Die Das"),
      status: "error",
      message: "Umami offline",
    },
  ];

  const view = buildUmamiAnalyticsView(reports);

  assert.equal(view.status, "ok");
  assert.equal(view.availableSites, 2);
  assert.equal(view.unavailableSites.length, 1);
  assert.equal(view.current.visitors, 50);
  assert.equal(view.current.pageviews, 160);
  assert.deepEqual(view.series, [
    { x: "2026-08-28", y: 35 },
    { x: "2026-08-29", y: 30 },
  ]);
  assert.deepEqual(view.topPages, [
    { x: "/lernen", y: 30 },
    { x: "/kurs", y: 8 },
  ]);
  assert.deepEqual(view.topReferrers, [
    { x: "google.com", y: 19 },
    { x: "direct", y: 5 },
  ]);
});

test("an unavailable view keeps explicit per-site failures", () => {
  const view = buildUmamiAnalyticsView([
    { site: site("todoplastico", "TodoPlástico"), status: "missing_connection", message: "Sin conexión" },
  ]);

  assert.equal(view.status, "unavailable");
  assert.equal(view.unavailableSites[0].message, "Sin conexión");
});

test("shared analytics UI is accessible and keeps credentials server-only", async () => {
  const [clientSource, serverSource] = await Promise.all([
    readFile(new URL("../src/components/admin/umami-analytics-panel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/admin/panel-analytics-section.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(clientSource, /role="tablist"/);
  assert.match(clientSource, /aria-selected/);
  assert.match(clientSource, /aria-label="Serie diaria de páginas vistas"/);
  assert.match(clientSource, /Visitantes/);
  assert.match(clientSource, /Duración media/);
  assert.match(serverSource, /getPanelAnalytics/);
  assert.match(serverSource, /UMAMI_PERSONAL_URL/);
  assert.doesNotMatch(clientSource, /PASSWORD|USERNAME|getUmamiConnections/);
});

test("all seven operational panels resolve canonical projects before rendering advanced analytics", async () => {
  const routes = [
    ["dashboard/page.tsx", "wf-studio", "webfuengirola"],
    ["vivir-en-fuengirola/page.tsx", "vivir", "vivirenfuengirola"],
    ["conoce-fuengirola/page.tsx", "conoce", "conocef"],
    ["samuel-coach/page.tsx", "samuel-coach", "samuelcoachdealeman"],
    ["vokabel-world/page.tsx", "vokabel-world", "vokabellab"],
    ["superentrenador/pt/page.tsx", "superentrenador", "superentrenador"],
    ["todoplastico/page.tsx", "todoplastico", "todoplastico"],
  ];

  for (const [route, panelKey, advancedProjectKey] of routes) {
    const source = await readFile(
      new URL(`../src/app/paneladmin/(protected)/${route}`, import.meta.url),
      "utf8",
    );
    assert.match(source, /PanelAnalyticsSection/, route);
    assert.match(source, new RegExp(`panelKey=["']${panelKey}["']`), route);
    assert.match(source, /Suspense/, route);
    assert.match(source, /AuthorizedAdminAnalyticsPanel/, route);
    assert.match(source, new RegExp(`registryKey=["']${advancedProjectKey}["']`), route);
  }
});

test("advanced analytics is mounted only after the user expands it", async () => {
  const source = await readFile(
    new URL("../src/components/admin/advanced-project-analytics-panel.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /useState\(false\)/);
  assert.match(source, /setExpanded\(true\)/);
  assert.match(source, /expanded\s*\?\s*\(/);
  assert.match(source, /ProjectAnalyticsPanel/);
});

test("advanced analytics can reveal every loaded URL and shows percentage shares", async () => {
  const source = await readFile(
    new URL("../src/components/analytics/project-analytics-panel.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /expandable=\{group\.key === 'pages'\}/);
  assert.match(source, /showPercentage=\{\['pages', 'referrers', 'channels', 'devices'\]\.includes\(group\.key\)\}/);
  assert.match(source, /Ver todas \(\{formatNumber\(rows\.length\)\}\)/);
  assert.match(source, /% del total/);
});

test("professional analytics explorer exposes cumulative safe filters and business overviews", async () => {
  const source = await readFile(
    new URL("../src/components/analytics/project-analytics-panel.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /Resumen por sección/);
  assert.match(source, /Idioma del contenido/);
  assert.match(source, /Idioma del navegador/);
  assert.match(source, /Sección/);
  assert.match(source, /Dispositivo/);
  assert.match(source, /Fuente \/ referencia/);
  assert.match(source, /Evento/);
  assert.match(source, /query\.set\('section'/);
  assert.match(source, /query\.set\('language'/);
  assert.match(source, /query\.set\('device'/);
  assert.match(source, /query\.set\('source'/);
  assert.match(source, /query\.set\('event'/);
  assert.match(source, /Filtros activos/);
  assert.match(source, /Limpiar filtros/);
  assert.match(source, /No disponible/);
  assert.match(source, /Páginas vistas/);
  assert.match(source, /% del total/);
  assert.doesNotMatch(source, /Área cliente/);
});

test("event explorer separates commercial actions from reached engagement milestones", async () => {
  const source = await readFile(
    new URL("../src/components/analytics/project-analytics-panel.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /Eventos comerciales/);
  assert.match(source, /Hitos de permanencia alcanzados/);
  assert.match(source, /no representa el momento exacto de salida/i);
  assert.match(source, /category === 'engagement'/);
});

test("TodoPlástico navigation uses the exact client and administrator destinations", async () => {
  const [launcherSource, todoSource] = await Promise.all([
    readFile(new URL("../src/app/paneladmin/(protected)/inicio/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/paneladmin/(protected)/todoplastico/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(launcherSource, /https:\/\/todo-plastico\.com\/panel/);
  assert.match(launcherSource, /https:\/\/todo-plastico\.com\/ingresar\?next=\/admin/);
  assert.match(todoSource, /https:\/\/todo-plastico\.com\/ingresar\?next=\/admin/);
  assert.doesNotMatch(`${launcherSource}\n${todoSource}`, /agama\.eco/);
  assert.doesNotMatch(todoSource, /externalAdminUrl\}\/admin\/nuevo-anuncio/);
});
