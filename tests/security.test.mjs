import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCanonicalAppUrl,
  getProtectedArea,
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
