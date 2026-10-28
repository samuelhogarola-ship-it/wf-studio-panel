import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCanonicalAppUrl,
  getProtectedArea,
  hasConsistentForwardedOrigin,
  resolveRequestOrigin,
  sanitizeClientDestination,
  sanitizeInternalRedirect,
} from "../src/lib/security/redirects.mjs";

test("sanitizeInternalRedirect keeps valid internal client routes", () => {
  assert.equal(
    sanitizeInternalRedirect("/cliente/dashboard?tab=recibidos", {
      fallback: "/cliente/dashboard",
    }),
    "/cliente/dashboard?tab=recibidos",
  );
});

test("sanitizeInternalRedirect rejects external redirects", () => {
  assert.equal(
    sanitizeInternalRedirect("https://evil.example/phish", {
      fallback: "/cliente/dashboard",
    }),
    "/cliente/dashboard",
  );
});

test("sanitizeClientDestination keeps client portal and direct Blogger routes", () => {
  assert.equal(
    sanitizeClientDestination("/cliente/proyectos/example?tab=blogger#editor"),
    "/cliente/proyectos/example?tab=blogger#editor",
  );
  assert.equal(
    sanitizeClientDestination("/acceso/blogger/sportmassagefuengirola"),
    "/acceso/blogger/sportmassagefuengirola",
  );
  assert.equal(
    sanitizeClientDestination("/acceso/blogger/samuel-coach?draft=1#editor"),
    "/acceso/blogger/samuel-coach?draft=1#editor",
  );
});

test("sanitizeClientDestination rejects external, encoded and administrator destinations", () => {
  for (const value of [
    "https://evil.example/phish",
    "//evil.example/phish",
    "/\\evil.example/phish",
    "/cliente/%2e%2e/paneladmin/inicio",
    "/cliente/%252e%252e%252fpaneladmin/inicio",
    "/acceso/blogger/%73portmassagefuengirola",
    "/paneladmin/inicio",
  ]) {
    assert.equal(sanitizeClientDestination(value), "/cliente/dashboard", value);
  }
});

test("sanitizeClientDestination rejects malformed direct Blogger site segments", () => {
  for (const value of [
    "/acceso/blogger",
    "/acceso/blogger/",
    "/acceso/blogger/UPPERCASE",
    "/acceso/blogger/invalid_segment",
    "/acceso/blogger/invalid.segment",
    "/acceso/blogger/two/segments",
    "/acceso/blogger/-leading-hyphen",
    "/acceso/blogger/trailing-hyphen-",
  ]) {
    assert.equal(sanitizeClientDestination(value), "/cliente/dashboard", value);
  }
});

test("sanitizeClientDestination defaults non-string and empty values to the client dashboard", () => {
  for (const value of [undefined, null, "", 42, {}]) {
    assert.equal(sanitizeClientDestination(value), "/cliente/dashboard");
  }
});

test("buildCanonicalAppUrl always uses configured origin", () => {
  assert.equal(
    buildCanonicalAppUrl(
      "https://admin.webfuengirola.com",
      "/auth/callback?next=%2Fcliente%2Fdashboard",
    ).toString(),
    "https://admin.webfuengirola.com/auth/callback?next=%2Fcliente%2Fdashboard",
  );
});

test("resolveRequestOrigin prefers forwarded host over fallback origin", () => {
  assert.equal(
    resolveRequestOrigin({
      forwardedHost: "portal.webfuengirola.com",
      forwardedProto: "https",
      requestOrigin: "http://localhost:3000",
      fallbackOrigin: "https://admin.webfuengirola.com",
    }),
    "https://portal.webfuengirola.com",
  );
});

test("resolveRequestOrigin accepts the exact HTTPS internal origin reported by the Coolify runtime", () => {
  const input = {
    forwardedHost: "portal.webfuengirola.com",
    forwardedProto: "https",
    requestOrigin: "https://0.0.0.0:3000",
    fallbackOrigin: "https://admin.webfuengirola.com",
    allowedHosts: ["admin.webfuengirola.com", "portal.webfuengirola.com"],
  };
  assert.equal(resolveRequestOrigin(input), "https://portal.webfuengirola.com");
  assert.equal(
    resolveRequestOrigin({ ...input, requestOrigin: "https://0.0.0.0:3001" }),
    "https://admin.webfuengirola.com",
  );
  assert.equal(
    resolveRequestOrigin({ ...input, requestOrigin: "https://external.example:3000" }),
    "https://admin.webfuengirola.com",
  );
});

test("resolveRequestOrigin rejects ambiguous or non-HTTPS proxy headers", () => {
  const input = {
    requestOrigin: "http://wf-studio-panel:3000",
    allowedHosts: ["portal.webfuengirola.com"],
  };
  for (const [forwardedHost, forwardedProto] of [
    ["portal.webfuengirola.com", "http"],
    ["portal.webfuengirola.com", "javascript"],
    ["portal.webfuengirola.com, admin.webfuengirola.com", "https"],
    ["portal.webfuengirola.com", "https, http"],
    ["admin.webfuengirola.com", "https"],
  ]) {
    assert.equal(
      resolveRequestOrigin({ ...input, forwardedHost, forwardedProto }),
      "http://wf-studio-panel:3000",
      `${forwardedHost} / ${forwardedProto}`,
    );
  }
});

test("resolveRequestOrigin never lets forwarded headers relabel a public application host", () => {
  assert.equal(
    resolveRequestOrigin({
      forwardedHost: "portal.webfuengirola.com",
      forwardedProto: "https",
      requestOrigin: "https://admin.webfuengirola.com",
    }),
    "https://admin.webfuengirola.com",
  );
  assert.equal(
    resolveRequestOrigin({
      forwardedHost: "admin.webfuengirola.com",
      forwardedProto: "https",
      requestOrigin: "https://portal.webfuengirola.com",
    }),
    "https://portal.webfuengirola.com",
  );
});

test("forwarded origin consistency rejects ambiguous and contradictory public hosts", () => {
  const input = {
    requestOrigin: "https://blogger.sportmassagefuengirola.com",
    allowedHosts: ["blogger.sportmassagefuengirola.com", "portal.webfuengirola.com"],
  };
  assert.equal(hasConsistentForwardedOrigin({ ...input, forwardedHost: null, forwardedProto: null }), true);
  assert.equal(hasConsistentForwardedOrigin({ ...input, forwardedHost: "blogger.sportmassagefuengirola.com", forwardedProto: "https" }), true);
  for (const [forwardedHost, forwardedProto] of [
    ["portal.webfuengirola.com", "https"],
    ["blogger.sportmassagefuengirola.com, portal.webfuengirola.com", "https"],
    ["blogger.sportmassagefuengirola.com", "http"],
    ["blogger.sportmassagefuengirola.com", null],
  ]) {
    assert.equal(hasConsistentForwardedOrigin({ ...input, forwardedHost, forwardedProto }), false);
  }
});

test("forwarded origin consistency accepts the matching local development host", () => {
  for (const requestOrigin of ["http://localhost:3000", "http://127.0.0.1:3000"]) {
    const requestUrl = new URL(requestOrigin);
    assert.equal(hasConsistentForwardedOrigin({
      forwardedHost: requestUrl.host,
      forwardedProto: "http",
      requestOrigin,
    }), true);
  }

  assert.equal(hasConsistentForwardedOrigin({
    forwardedHost: "admin.webfuengirola.com",
    forwardedProto: "http",
    requestOrigin: "http://localhost:3000",
  }), false);
});

test("resolveRequestOrigin restores HTTPS only when the proxy confirms the same public host", () => {
  assert.equal(
    resolveRequestOrigin({
      forwardedHost: null,
      forwardedProto: "https",
      requestOrigin: "http://portal.webfuengirola.com",
      allowedHosts: ["admin.webfuengirola.com", "portal.webfuengirola.com"],
    }),
    "https://portal.webfuengirola.com",
  );
  for (const forwardedHost of [
    "admin.webfuengirola.com",
    "",
    "   ",
    "portal.webfuengirola.com, admin.webfuengirola.com",
  ]) {
    assert.equal(
      resolveRequestOrigin({
        forwardedHost,
        forwardedProto: "https",
        requestOrigin: "http://portal.webfuengirola.com",
        allowedHosts: ["admin.webfuengirola.com", "portal.webfuengirola.com"],
      }),
      "http://portal.webfuengirola.com",
      forwardedHost,
    );
  }
});

test("resolveRequestOrigin falls back to configured origin when proxy headers are missing", () => {
  assert.equal(
    resolveRequestOrigin({
      forwardedHost: null,
      forwardedProto: null,
      requestOrigin: "http://localhost:3000",
      fallbackOrigin: "https://portal.webfuengirola.com",
    }),
    "https://portal.webfuengirola.com",
  );
});

test("getProtectedArea marks admin routes as protected", () => {
  assert.equal(
    getProtectedArea("/paneladmin/vivir-en-fuengirola/clientes"),
    "admin",
  );
});

test("getProtectedArea marks client routes as protected except public entrypoints", () => {
  assert.equal(getProtectedArea("/cliente/servicios"), "client");
  assert.equal(getProtectedArea("/cliente/registro"), null);
});

test("premium code administration keeps the retired Supabase backend out of the browser", async () => {
  const { readFile } = await import("node:fs/promises");
  const { fileURLToPath } = await import("node:url");
  const path = await import("node:path");
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
  const [page, config] = await Promise.all([
    readFile(
      path.join(
        root,
        "src/app/paneladmin/(protected)/samuel-coach/premium/page.tsx",
      ),
      "utf8",
    ),
    readFile(path.join(root, "next.config.ts"), "utf8"),
  ]);

  assert.doesNotMatch(page, /hocdlmxzghwymamientc/);
  assert.doesNotMatch(config, /hocdlmxzghwymamientc/);
  assert.doesNotMatch(page, /@supabase\/supabase-js/);
  assert.match(page, /generatePremiumCodeAction/);
});
