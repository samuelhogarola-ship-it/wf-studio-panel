import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { isAuthorizedCronRequest } from "../src/lib/cron/pending-reminders.mjs";

const routeSource = await readFile(new URL("../src/app/api/pending-reminders/route.ts", import.meta.url), "utf8");

test("cron authorization fails closed and accepts only the Bearer header", () => {
  assert.equal(isAuthorizedCronRequest({ configuredSecret: undefined, authorization: "Bearer secret" }), false);
  assert.equal(isAuthorizedCronRequest({ configuredSecret: "secret", authorization: "Bearer secret" }), true);
  assert.equal(isAuthorizedCronRequest({ configuredSecret: "secret", authorization: "Bearer wrong" }), false);
  assert.equal(isAuthorizedCronRequest({ configuredSecret: "secret", authorization: "Bearer secret", headerSecret: "wrong" }), true);
  assert.equal(isAuthorizedCronRequest({ configuredSecret: "secret", authorization: null, headerSecret: "secret" }), false);
});

test("pending reminders reject non-POST and never accept query-string credentials", () => {
  assert.match(routeSource, /export async function POST/);
  assert.doesNotMatch(routeSource, /export async function GET/);
  assert.doesNotMatch(routeSource, /searchParams\.get\(['"]secret/);
  assert.doesNotMatch(routeSource, /x-cron-secret/);
  assert.doesNotMatch(routeSource, /if \(!configuredSecret\) return true/);
});
