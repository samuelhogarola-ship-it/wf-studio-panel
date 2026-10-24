import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { resolveRequestOrigin } from "../src/lib/security/redirects.mjs";

const authSource = await readFile(new URL("../src/lib/actions/auth.ts", import.meta.url), "utf8");
const callbackSource = await readFile(new URL("../src/app/auth/callback/route.ts", import.meta.url), "utf8");
const resetCallbackSource = await readFile(new URL("../src/app/auth/callback/reset/route.ts", import.meta.url), "utf8");
const signOutSource = await readFile(new URL("../src/app/auth/sign-out/route.ts", import.meta.url), "utf8");
const diagnosticsSource = await readFile(new URL("../src/app/api/auth-diagnostics/route.ts", import.meta.url), "utf8");

test("forwarded hosts are ignored unless explicitly allowlisted", () => {
  assert.equal(resolveRequestOrigin({ forwardedHost: "evil.example", forwardedProto: "https", requestOrigin: "https://portal.webfuengirola.com", fallbackOrigin: "https://portal.webfuengirola.com", allowedHosts: ["portal.webfuengirola.com"] }), "https://portal.webfuengirola.com");
  assert.equal(resolveRequestOrigin({ forwardedHost: "portal.webfuengirola.com", forwardedProto: "https", requestOrigin: "https://fallback.example", fallbackOrigin: "https://fallback.example", allowedHosts: ["portal.webfuengirola.com"] }), "https://portal.webfuengirola.com");
});

test("authentication boundaries use server-owned destinations and same-origin logout", () => {
  assert.doesNotMatch(authSource, /formData\.get\(['"]origin['"]\)/);
  assert.match(authSource, /buildCanonicalResetCallbackUrl/);
  assert.match(callbackSource, /allowedHosts/);
  assert.match(resetCallbackSource, /allowedHosts/);
  assert.match(signOutSource, /request\.headers\.get\(['"]origin['"]\)/);
  assert.match(diagnosticsSource, /requireAdmin|role.*admin|AUTH_DIAGNOSTICS_ENABLED/);
});
