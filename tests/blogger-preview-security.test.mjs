import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const editorHtml = await readFile(new URL("../public/blogger/editor/index.html", import.meta.url), "utf8");
const legacyHtml = await readFile(new URL("../public/blogger/index.html", import.meta.url), "utf8");
const editorScript = await readFile(new URL("../public/blogger/editor/app.js", import.meta.url), "utf8");
const legacyScript = await readFile(new URL("../public/blogger/app.js", import.meta.url), "utf8");
const nextConfig = await readFile(new URL("../next.config.ts", import.meta.url), "utf8");

test("Blogger previews are sandboxed documents instead of same-origin HTML sinks", () => {
  for (const document of [editorHtml, legacyHtml]) {
    assert.match(document, /<iframe[^>]+id="preview"[^>]+sandbox(?:="")?[^>]*>/i);
    assert.match(document, /<iframe[^>]+id="mainPreview"[^>]+sandbox(?:="")?[^>]*>/i);
  }

  for (const script of [editorScript, legacyScript]) {
    assert.match(script, /\.srcdoc\s*=\s*html/);
    assert.doesNotMatch(script, /(?:preview|mainPreview)\.innerHTML\s*=\s*html/);
  }
});

test("Next config emits restrictive browser security headers", () => {
  assert.match(nextConfig, /Content-Security-Policy/);
  assert.match(nextConfig, /object-src ['"]none/);
  assert.match(nextConfig, /frame-ancestors ['"]self/);
  assert.match(nextConfig, /samuelcoachdealeman\.com/);
  assert.match(nextConfig, /X-Content-Type-Options/);
  assert.match(nextConfig, /Referrer-Policy/);
});
