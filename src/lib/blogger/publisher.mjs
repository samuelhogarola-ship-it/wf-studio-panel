const API_BASE = "https://api.github.com";
const SITE_REPOSITORY = "samuelhogarola-ship-it/sportmassage";
const SUPPORTED_LANGUAGES = new Set(["en", "es", "fi"]);
const DEEPL_LANGUAGES = { en: "EN-GB", es: "ES", fi: "FI" };

export function githubContentPath(value) {
  const path = String(value || "").replace(/^\/+/, "");
  if (!path || path.includes("..") || path.startsWith(".")) {
    throw new Error("Invalid repository path");
  }
  return path;
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function normalizeBlogLanguage(value, fallback = "en") {
  const language = String(value || fallback).trim().toLowerCase();
  if (!SUPPORTED_LANGUAGES.has(language)) throw new Error(`Unsupported blog language: ${language}`);
  return language;
}

export function normalizePublicationLanguages(value) {
  const languages = (Array.isArray(value) ? value : String(value || "en,es,fi").split(","))
    .map((item) => normalizeBlogLanguage(item))
    .filter((item, index, all) => all.indexOf(item) === index);
  return languages.length ? languages : ["en", "es", "fi"];
}

export async function translateHtml(html, sourceLanguage, targetLanguage, fetchImpl = fetch) {
  const key = process.env.DEEPL_AUTH_KEY?.trim();
  if (!key) throw new Error("Missing DEEPL_AUTH_KEY");
  const source = normalizeBlogLanguage(sourceLanguage);
  const target = normalizeBlogLanguage(targetLanguage);
  if (source === target) return String(html || "");
  const endpoint = process.env.DEEPL_API_URL?.trim() || "https://api.deepl.com/v2/translate";
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: { Authorization: `DeepL-Auth-Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text: [String(html || "")], source_lang: DEEPL_LANGUAGES[source], target_lang: DEEPL_LANGUAGES[target], tag_handling: "html", tag_handling_version: "v2" }),
  });
  if (!response.ok) throw new Error(`Translation provider failed: ${response.status}`);
  const data = await response.json();
  const result = data?.translations?.[0]?.text;
  if (!result) throw new Error("Translation provider returned no text");
  return result;
}

function tags(value) {
  return (Array.isArray(value) ? value : String(value || "").split(","))
    .map((item) => String(item).trim())
    .filter(Boolean);
}

function card(meta) {
  return `<article class="blog-card"><p class="blog-date">${escapeHtml(meta.date || "")}</p><h2><a href="/blog/${escapeHtml(meta.slug)}/">${escapeHtml(meta.title)}</a></h2><p>${escapeHtml(meta.description || "")}</p></article>`;
}

export function buildPostHtml(meta, body) {
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description || "");
  const lang = escapeHtml(normalizeBlogLanguage(meta.lang || "en"));
  const author = escapeHtml(meta.author || "Sport Massage Fuengirola");
  const articleBody = meta.content_format === "html" ? String(body || "") : `<p>${escapeHtml(body || "")}</p>`;
  const canonical = `https://sportmassagefuengirola.com/blog/${encodeURIComponent(meta.slug)}/`;
  const tagMarkup = tags(meta.tags).map((tag) => `<span>${escapeHtml(tag)}</span>`).join(" ");

  return `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} · Sport Massage Fuengirola</title>
  <meta name="description" content="${description}">
  <link rel="canonical" href="${canonical}">
  <style>body{margin:0;background:#f5f1ea;color:#19323c;font:16px/1.7 system-ui,sans-serif}main{max-width:760px;margin:auto;padding:48px 24px}a{color:#0b6572}.blog-post-card{background:#fff;padding:32px;border-radius:18px;box-shadow:0 8px 30px #19323c12}h1{font-size:clamp(2rem,5vw,3.5rem);line-height:1.1}.blog-date{color:#7b8584;text-transform:uppercase;letter-spacing:.12em;font-size:.8rem}.blog-pill{display:inline-block;margin:.2rem;padding:.2rem .6rem;border-radius:999px;background:#d9eceb;font-size:.8rem}</style>
</head>
<body><main><p><a href="/blog/">← Blog</a></p><article class="blog-post-card"><p class="blog-date">${escapeHtml(meta.date || "")}</p><h1>${title}</h1><p>${description}</p><div class="blog-tags">${tagMarkup}</div><div class="blog-content">${articleBody}</div><p>Por ${author}</p></article></main></body>
</html>
`;
}

export function buildBlogIndexHtml(meta) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Blog · Sport Massage Fuengirola</title><meta name="description" content="Articles about massage, muscle recovery and wellbeing."><style>body{margin:0;background:#f5f1ea;color:#19323c;font:16px/1.7 system-ui,sans-serif}main{max-width:900px;margin:auto;padding:48px 24px}.blog-card{background:#fff;padding:24px;border-radius:16px;margin:16px 0}a{color:#0b6572}h1{font-size:clamp(2rem,5vw,3.5rem)}</style></head><body><main><p><a href="/">Sport Massage Fuengirola</a></p><h1>Blog</h1><p>Articles about massage, muscle recovery and wellbeing.</p>${card(meta)}</main></body></html>`;
}

export function upsertBlogIndexHtml(existingHtml, meta) {
  const article = card(meta);
  if (!existingHtml || /Hello world|WordPress|wp-content/i.test(existingHtml)) return buildBlogIndexHtml(meta);
  const marker = "</main>";
  return existingHtml.includes(marker) ? existingHtml.replace(marker, `${article}</main>`) : buildBlogIndexHtml(meta);
}

export function parseMarkdown(content) {
  const match = String(content || "").match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  const meta = {};
  if (!match) return { meta, body: String(content || "") };
  for (const line of match[1].split(/\r?\n/)) {
    const index = line.indexOf(":");
    if (index < 1) continue;
    meta[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  }
  return { meta, body: match[2].trimStart() };
}

export function serializeMarkdown(meta, body) {
  return `---\n${Object.entries(meta).filter(([, value]) => String(value ?? "").trim()).map(([key, value]) => `${key}: ${String(value).trim()}`).join("\n")}\n---\n\n${String(body || "").trim()}\n`;
}

function config() {
  const token = process.env.BLOGGER_GITHUB_TOKEN?.trim();
  const repository = process.env.BLOGGER_GITHUB_REPOSITORY?.trim() || SITE_REPOSITORY;
  const branch = process.env.BLOGGER_GITHUB_BRANCH?.trim() || "main";
  if (!token) throw new Error("Missing BLOGGER_GITHUB_TOKEN");
  if (repository !== SITE_REPOSITORY) throw new Error("Blogger repository is not allowlisted");
  return { token, repository, branch };
}

async function githubRequest(path, options = {}) {
  const { token } = config();
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {}),
    },
  });
  if (!response.ok) throw new Error(`GitHub request failed: ${response.status}`);
  return response.status === 204 ? null : response.json();
}

async function readFile(repository, branch, path) {
  try {
    const data = await githubRequest(`/repos/${repository}/contents/${githubContentPath(path)}?ref=${encodeURIComponent(branch)}`);
    return { sha: data.sha, content: Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf8") };
  } catch (error) {
    if (String(error.message).includes("404")) return null;
    throw error;
  }
}

export async function listBloggerPosts() {
  const { repository, branch } = config();
  const listing = await githubRequest(`/repos/${repository}/contents/blog-posts?ref=${encodeURIComponent(branch)}`);
  const files = (Array.isArray(listing) ? listing : []).filter((entry) => entry.name.endsWith(".md"));
  return Promise.all(files.map(async (entry) => {
    const post = parseMarkdown((await readFile(repository, branch, entry.path))?.content || "");
    return { slug: post.meta.slug || entry.name.replace(/\.md$/, ""), title: post.meta.title || entry.name, description: post.meta.description || "", date: post.meta.date || "", status: post.meta.status || "draft", words: post.body.split(/\s+/).filter(Boolean).length, images: [], isPublished: false };
  }));
}

export async function readBloggerPost(slug) {
  const { repository, branch } = config();
  const file = await readFile(repository, branch, `blog-posts/${slug}.md`);
  if (!file) return null;
  const parsed = parseMarkdown(file.content);
  return { slug, meta: parsed.meta, body: parsed.body, format: parsed.meta.content_format || "html", images: await listBloggerPostImages(slug), isPublished: Boolean(await readFile(repository, branch, `blog/${slug}/index.html`)) };
}

async function listBloggerPostImages(slug) {
  const { repository, branch } = config();
  try {
    const listing = await githubRequest(`/repos/${repository}/contents/blog/${githubContentPath(slug)}/img?ref=${encodeURIComponent(branch)}`);
    return (Array.isArray(listing) ? listing : []).filter((entry) => /\.(png|jpe?g|webp|gif|svg)$/i.test(entry.name)).map((entry) => ({ file: entry.name, url: `/blog/${slug}/img/${entry.name}`, alt: "", description: "", canDelete: true }));
  } catch (error) {
    if (String(error.message).includes("404")) return [];
    throw error;
  }
}

export async function saveBloggerPost(slug, input) {
  const { repository, branch } = config();
  const nextSlug = String(input.slug || slug || input.title || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!nextSlug) throw new Error("Post slug is required");
  const meta = { title: input.title, slug: nextSlug, description: input.description, date: input.date || new Date().toISOString().slice(0, 10), author: input.author || "Sport Massage Fuengirola", lang: normalizeBlogLanguage(input.lang || "en"), publish_languages: normalizePublicationLanguages(input.publish_languages), tags: Array.isArray(input.tags) ? input.tags.join(", ") : input.tags || "", status: input.status || "draft", content_format: input.content_format === "markdown" ? "markdown" : "html" };
  const existing = await readFile(repository, branch, `blog-posts/${nextSlug}.md`);
  await writeFile(repository, branch, `blog-posts/${nextSlug}.md`, serializeMarkdown(meta, input.body), `blog: save ${nextSlug}`, existing?.sha);
  return { slug: nextSlug, meta, body: input.body || "", format: meta.content_format, images: await listBloggerPostImages(nextSlug), isPublished: false };
}

async function writeFile(repository, branch, path, content, message, sha) {
  return githubRequest(`/repos/${repository}/contents/${githubContentPath(path)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, content: Buffer.from(content, "utf8").toString("base64"), branch, ...(sha ? { sha } : {}) }),
  });
}

export async function publishBloggerPost(meta, body) {
  const { repository, branch } = config();
  const sourcePath = `blog-posts/${meta.slug}.md`;
  const htmlPath = `blog/${meta.slug}/index.html`;
  const indexPath = "blog/index.html";
  const markdown = `---\ntitle: ${meta.title}\nslug: ${meta.slug}\ndescription: ${meta.description}\ndate: ${meta.date}\nauthor: ${meta.author}\nlang: ${meta.lang}\ntags: ${tags(meta.tags).join(", ")}\nstatus: published\ncontent_format: ${meta.content_format || "html"}\n---\n\n${body}\n`;
  const [source, html, index] = await Promise.all([
    readFile(repository, branch, sourcePath),
    readFile(repository, branch, htmlPath),
    readFile(repository, branch, indexPath),
  ]);
  const sourceLanguage = normalizeBlogLanguage(meta.lang || "en");
  const publishLanguages = normalizePublicationLanguages(meta.publish_languages);
  const variants = await Promise.all(publishLanguages.map(async (language) => ({ language, body: language === sourceLanguage ? body : await translateHtml(body, sourceLanguage, language) })));
  await writeFile(repository, branch, sourcePath, markdown, `blog: save ${meta.slug}`, source?.sha);
  await writeFile(repository, branch, htmlPath, buildPostHtml({ ...meta, lang: sourceLanguage }, body), `blog: publish ${meta.slug}`, html?.sha);
  for (const variant of variants) {
    if (variant.language === sourceLanguage) continue;
    const variantPath = `blog/${meta.slug}/${variant.language}/index.html`;
    const existingVariant = await readFile(repository, branch, variantPath);
    await writeFile(repository, branch, variantPath, buildPostHtml({ ...meta, lang: variant.language }, variant.body), `blog: publish ${meta.slug} ${variant.language}`, existingVariant?.sha);
  }
  await writeFile(repository, branch, indexPath, upsertBlogIndexHtml(index?.content, meta), `blog: update index for ${meta.slug}`, index?.sha);
  return { slug: meta.slug, url: `/blog/${meta.slug}/`, repository, branch };
}

function imagePath(slug, fileName) {
  const safeSlug = String(slug || "").toLowerCase().replace(/[^a-z0-9-]/g, "");
  const safeFile = String(fileName || "").split(/[\\/]/).pop().toLowerCase().replace(/[^a-z0-9._-]/g, "-");
  if (!safeSlug || !safeFile || !/\.(png|jpe?g|webp|gif|svg)$/i.test(safeFile)) throw new Error("Invalid image path");
  return { path: `blog/${safeSlug}/img/${safeFile}`, file: safeFile };
}

export async function saveBloggerPostImage(slug, fileName, data, metadata = {}) {
  const { repository, branch } = config();
  const target = imagePath(slug, fileName);
  const raw = String(data || "").replace(/^data:[^;]+;base64,/, "");
  if (!raw || raw.length > 8 * 1024 * 1024) throw new Error("Image is empty or too large");
  const existing = await readFile(repository, branch, target.path);
  await githubRequest(`/repos/${repository}/contents/${githubContentPath(target.path)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: `blog: upload ${slug}/${target.file}`, content: raw, branch, ...(existing?.sha ? { sha: existing.sha } : {}) }) });
  return { file: target.file, url: `/blog/${slug}/img/${target.file}`, alt: String(metadata.alt || ""), description: String(metadata.description || "") };
}

export async function deleteBloggerPostImage(slug, fileName) {
  const { repository, branch } = config();
  const target = imagePath(slug, fileName);
  const existing = await readFile(repository, branch, target.path);
  if (!existing) return false;
  await githubRequest(`/repos/${repository}/contents/${githubContentPath(target.path)}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: `blog: delete ${slug}/${target.file}`, sha: existing.sha, branch }) });
  return true;
}
