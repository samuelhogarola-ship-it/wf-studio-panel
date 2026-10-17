import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPostHtml,
  buildBlogIndexHtml,
  githubContentPath,
  normalizeBlogLanguage,
  normalizePublicationLanguages,
  translateHtml,
} from "../src/lib/blogger/publisher.mjs";

test("blogger defaults to English and keeps the selected publication languages", () => {
  assert.equal(normalizeBlogLanguage(), "en");
  assert.deepEqual(normalizePublicationLanguages(["en", "fi", "es", "fi"]), ["en", "fi", "es"]);
  assert.throws(() => normalizeBlogLanguage("de"), /unsupported blog language/i);
});

test("DeepL translation request preserves HTML tags", async () => {
  const previousKey = process.env.DEEPL_AUTH_KEY;
  process.env.DEEPL_AUTH_KEY = "test-key";
  let request;
  const translated = await translateHtml("<p>Hello <strong>world</strong></p>", "en", "fi", async (_url, options) => {
    request = { options };
    return { ok: true, async json() { return { translations: [{ text: "<p>Hei <strong>maailma</strong></p>" }] }; } };
  });
  if (previousKey === undefined) delete process.env.DEEPL_AUTH_KEY;
  else process.env.DEEPL_AUTH_KEY = previousKey;
  assert.equal(translated, "<p>Hei <strong>maailma</strong></p>");
  assert.equal(JSON.parse(request.options.body).tag_handling, "html");
  assert.equal(JSON.parse(request.options.body).target_lang, "FI");
});

test("buildPostHtml renders a static Sport Massage article under /blog", () => {
  const html = buildPostHtml(
    {
      title: "Recuperación muscular después del deporte",
      slug: "recuperacion-muscular",
      description: "Consejos sencillos para recuperarte después de entrenar.",
      date: "2026-10-17",
      author: "Sport Massage Fuengirola",
      lang: "es",
      tags: "recuperación, deporte",
      content_format: "html",
    },
    "<p>Descansa, hidrátate y escucha a tu cuerpo.</p>",
  );

  assert.match(html, /<html lang="es">/);
  assert.match(html, /<h1>Recuperación muscular después del deporte<\/h1>/);
  assert.match(html, /<p>Descansa, hidrátate y escucha a tu cuerpo\.<\/p>/);
  assert.match(html, /https:\/\/sportmassagefuengirola\.com\/blog\/recuperacion-muscular\//);
});

test("buildBlogIndexHtml adds a new article link without retaining WordPress", () => {
  const html = buildBlogIndexHtml({
    title: "Recuperación muscular después del deporte",
    slug: "recuperacion-muscular",
    description: "Consejos sencillos para recuperarte después de entrenar.",
    date: "2026-10-17",
  });

  assert.match(html, /href="\/blog\/recuperacion-muscular\/"/);
  assert.doesNotMatch(html, /Hello world|WordPress|wp-content/);
});

test("githubContentPath only permits the configured static site repository", () => {
  assert.equal(
    githubContentPath("blog/recuperacion-muscular/index.html"),
    "blog/recuperacion-muscular/index.html",
  );
  assert.throws(() => githubContentPath("../secrets"), /invalid repository path/i);
});
