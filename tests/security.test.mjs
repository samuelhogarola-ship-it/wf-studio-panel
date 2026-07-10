import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCanonicalAppUrl,
  getProtectedArea,
  resolveRequestOrigin,
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
