import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildPostHtml,
  buildBlogIndexHtml,
  githubContentPath,
  normalizeBlogLanguage,
  normalizePublicationLanguages,
  translateHtml,
  listBloggerPosts,
} from "../src/lib/blogger/publisher.mjs";

test("an accessible repository without Blogger source opens as an empty blog", async (t) => {
  const previous = process.env.BLOGGER_GITHUB_TOKEN;
  process.env.BLOGGER_GITHUB_TOKEN = "test-token";
  t.after(() => { if (previous === undefined) delete process.env.BLOGGER_GITHUB_TOKEN; else process.env.BLOGGER_GITHUB_TOKEN = previous; });
  const requests = [];
  t.mock.method(globalThis, "fetch", async url => {
    requests.push(String(url));
    return String(url).includes("/contents/blog-posts")
      ? new Response("Not Found", { status: 404 })
      : Response.json({ full_name: "samuelhogarola-ship-it/sportmassage" });
  });
  assert.deepEqual(await listBloggerPosts(), []);
  assert.equal(requests.length, 2);
  assert.match(requests[1], /\/contents\?ref=main$/);
});

test("a missing configured branch is not reported as an empty blog", async (t) => {
  const previousToken = process.env.BLOGGER_GITHUB_TOKEN;
  const previousBranch = process.env.BLOGGER_GITHUB_BRANCH;
  process.env.BLOGGER_GITHUB_TOKEN = "test-token";
  process.env.BLOGGER_GITHUB_BRANCH = "missing-branch";
  t.after(() => {
    if (previousToken === undefined) delete process.env.BLOGGER_GITHUB_TOKEN; else process.env.BLOGGER_GITHUB_TOKEN = previousToken;
    if (previousBranch === undefined) delete process.env.BLOGGER_GITHUB_BRANCH; else process.env.BLOGGER_GITHUB_BRANCH = previousBranch;
  });
  t.mock.method(globalThis, "fetch", async url => String(url).includes("/contents")
    ? new Response("Not Found", { status: 404 })
    : Response.json({ full_name: "samuelhogarola-ship-it/sportmassage" }));
  await assert.rejects(listBloggerPosts(), /GitHub request failed: 404/);
});

test("missing repository access is not reported as an empty blog", async (t) => {
  const previous = process.env.BLOGGER_GITHUB_TOKEN;
  process.env.BLOGGER_GITHUB_TOKEN = "test-token";
  t.after(() => { if (previous === undefined) delete process.env.BLOGGER_GITHUB_TOKEN; else process.env.BLOGGER_GITHUB_TOKEN = previous; });
  t.mock.method(globalThis, "fetch", async () => new Response("Not Found", { status: 404 }));
  await assert.rejects(listBloggerPosts(), /GitHub request failed: 404/);
});

test("GitHub outages are not reported as an empty blog", async (t) => {
  const previous = process.env.BLOGGER_GITHUB_TOKEN;
  process.env.BLOGGER_GITHUB_TOKEN = "test-token";
  t.after(() => { if (previous === undefined) delete process.env.BLOGGER_GITHUB_TOKEN; else process.env.BLOGGER_GITHUB_TOKEN = previous; });
  t.mock.method(globalThis, "fetch", async () => new Response("Unavailable", { status: 503 }));
  await assert.rejects(listBloggerPosts(), /GitHub request failed: 503/);
});

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
  assert.equal(JSON.parse(request.options.body).source_lang, "EN");
});

test('legacy free API credentials use the free DeepL endpoint for Finnish to English',async t=>{
  const oldKey=process.env.DEEPL_AUTH_KEY,oldUrl=process.env.DEEPL_API_URL;
  t.after(()=>{if(oldKey===undefined)delete process.env.DEEPL_AUTH_KEY;else process.env.DEEPL_AUTH_KEY=oldKey;if(oldUrl===undefined)delete process.env.DEEPL_API_URL;else process.env.DEEPL_API_URL=oldUrl;});
  process.env.DEEPL_AUTH_KEY='test-free-key:fx';delete process.env.DEEPL_API_URL;
  await translateHtml('<p>Hieronta</p>','fi','en',async(url,options)=>{
    assert.equal(url,'https://api-free.deepl.com/v2/translate');
    const request=JSON.parse(options.body);assert.equal(request.source_lang,'FI');assert.equal(request.target_lang,'EN-GB');
    return Response.json({translations:[{text:'<p>Massage</p>'}]});
  });
});

test("the environment example preserves DeepL endpoint autodetection", () => {
  const example = readFileSync(new URL("../.env.example", import.meta.url), "utf8");
  const configuredEndpoint = example.match(/^DEEPL_API_URL=(.*)$/m)?.[1];

  assert.equal(configuredEndpoint, "");
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
