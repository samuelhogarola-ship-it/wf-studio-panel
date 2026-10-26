import assert from "node:assert/strict";
import test from "node:test";

import { normalizePostInput } from "../src/lib/blogger/content-store.mjs";
import { buildPostHtml } from "../src/lib/blogger/publisher.mjs";
import { sanitizeHtml } from "../src/lib/blogger/sanitize.mjs";

test("sanitizes hostile Blogger markup while preserving readable formatting", () => {
  const safe = sanitizeHtml(
    '<h2>Hola</h2><script>alert(1)</script><p onclick="alert(2)">Texto <strong>seguro</strong></p><a href="javascript:alert(3)">enlace</a><img src="javascript:alert(4)" onerror="alert(5)"><iframe src="https://evil.example"></iframe><svg><script>alert(6)</script></svg>',
  );

  assert.match(safe, /<h2>Hola<\/h2>/);
  assert.match(safe, /<p>Texto <strong>seguro<\/strong><\/p>/);
  assert.match(safe, />enlace<\/a>/);
  assert.doesNotMatch(safe, /<script|<iframe|<svg|on\w+\s*=|javascript:/i);
});

test("normalizing an HTML post sanitizes the persisted body", () => {
  const post = normalizePostInput({
    title: "Post seguro",
    description: "Descripcion",
    content_format: "html",
    body: '<p>Visible</p><img src="https://example.com/x.jpg" onerror="alert(1)">',
  });

  assert.equal(post.body, '<p>Visible</p><img src="https://example.com/x.jpg">');
});

test("publication sanitizes HTML again before emitting static output", () => {
  const html = buildPostHtml(
    { title: "Publicacion", slug: "publicacion", content_format: "html" },
    '<p>Visible</p><script>steal()</script><a href="javascript:steal()">Link</a>',
  );

  assert.match(html, /<p>Visible<\/p>/);
  assert.doesNotMatch(html, /<script|javascript:/i);
});

test("repeated sanitization preserves URL parameters and readable alt attributes", () => {
  const html = '<a href="https://example.com/?a=1&amp;b=2">Link</a><img src="https://example.com/photo.jpg?width=100&amp;height=200" alt="Massage &amp; recovery">';
  let safe = html;
  for (let index = 0; index < 5; index++) safe = sanitizeHtml(safe);
  assert.equal(safe, html);
});

test("encoded unsafe URL schemes are rejected after entity decoding", () => {
  const html = sanitizeHtml('<a href="java&#x73;cript:alert(1)">Link</a><img src="javascript&colon;alert(2)">');
  assert.equal(html, '<a>Link</a><img>');
});
