const API_BASE = "https://api.github.com";
import { sanitizeHtml } from "./sanitize.mjs";
import { Marked } from "marked";
import { decodeHTML } from "entities";
const markdownRenderer = new Marked({ async: false, gfm: true });
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
  return `<article class="blog-card" data-blog-slug="${escapeHtml(meta.slug)}"><p class="blog-date">${escapeHtml(meta.date || "")}</p><h2><a href="/blog/${escapeHtml(meta.slug)}/">${escapeHtml(meta.title)}</a></h2><p>${escapeHtml(meta.description || "")}</p></article>`;
}

export function renderPostBody(meta, body) {
  return sanitizeHtml(meta.content_format === "html" ? String(body || "") : markdownRenderer.parse(String(body || "")))
    .replace(/<img\b[^>]*>/gi, image => image.replace(/\bsrc="(img\/[a-z0-9._-]+)"/gi, (_match, source) => `src="${escapeHtml(publicImageUrl(meta.slug, source))}"`));
}

export function buildPostHtml(meta, body) {
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description || "");
  const lang = escapeHtml(normalizeBlogLanguage(meta.lang || "en"));
  const author = escapeHtml(meta.author || "Sport Massage Fuengirola");
  const articleBody = renderPostBody(meta, body);
  const canonical = `https://sportmassagefuengirola.com/blog/${String(meta.slug).split("/").map(encodeURIComponent).join("/")}/`;
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
<body><main><p><a href="/blog/">← Blog</a></p><article class="blog-post-card"><p class="blog-date">${escapeHtml(meta.date || "")}</p><h1>${title}</h1><p>${description}</p>${meta.image ? `<img src="${escapeHtml(publicImageUrl(meta.slug, meta.image))}" alt="${escapeHtml(meta.image_alt || meta.title)}">` : ""}<div class="blog-tags">${tagMarkup}</div><div class="blog-content">${articleBody}</div><p>By ${author}</p></article></main></body>
</html>
`;
}

export function buildBlogIndexHtml(meta) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Blog · Sport Massage Fuengirola</title><meta name="description" content="Articles about massage, muscle recovery and wellbeing."><style>body{margin:0;background:#f5f1ea;color:#19323c;font:16px/1.7 system-ui,sans-serif}main{max-width:900px;margin:auto;padding:48px 24px}.blog-card{background:#fff;padding:24px;border-radius:16px;margin:16px 0}a{color:#0b6572}h1{font-size:clamp(2rem,5vw,3.5rem)}</style></head><body><main><p><a href="/">Sport Massage Fuengirola</a></p><h1>Blog</h1><p>Articles about massage, muscle recovery and wellbeing.</p>${card(meta)}</main></body></html>`;
}

export function upsertBlogIndexHtml(existingHtml, meta) {
  const article = card(meta);
  if (!existingHtml || /Hello world|WordPress|wp-content/i.test(existingHtml)) return buildBlogIndexHtml(meta);
  const href = `/blog/${meta.slug}/`;
  let replaced = false;
  const updated = existingHtml.replace(/<article\b[^>]*>[\s\S]*?<\/article>/gi, block => {
    const links = [...block.matchAll(/\bhref=["']([^"']+)["']/gi)].map(match => match[1]);
    if (!links.some(link => link === href || link === `https://sportmassagefuengirola.com${href}`)) return block;
    if (replaced) return "";
    replaced = true;
    return article;
  });
  if (replaced) return updated;
  return updated.includes("</main>") ? updated.replace("</main>", `${article}</main>`) : buildBlogIndexHtml(meta);
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
  return `---\n${Object.entries(meta).filter(([key, value]) => /^[a-z_]+$/.test(key) && String(value ?? "").trim()).map(([key, value]) => `${key}: ${String(value).replace(/[\r\n]+/g, " ").trim()}`).join("\n")}\n---\n\n${String(body || "").trim()}\n`;
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
  const { responseType, ...requestOptions } = options;
  const response = await fetch(`${API_BASE}${path}`, {
    ...requestOptions,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {}),
    },
  });
  if (!response.ok) throw new Error(`GitHub request failed: ${response.status}`);
  if (responseType === "buffer") return Buffer.from(await response.arrayBuffer());
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
  let listing;
  try {
    listing = await githubRequest(`/repos/${repository}/contents/blog-posts?ref=${encodeURIComponent(branch)}`);
  } catch (error) {
    if (!String(error.message).includes("404")) throw error;
    // New blogs do not have source files yet. Confirm the configured branch is
    // accessible: missing permissions and missing refs also return 404.
    await githubRequest(`/repos/${repository}/contents?ref=${encodeURIComponent(branch)}`);
    return [];
  }
  const files = (Array.isArray(listing) ? listing : []).filter((entry) => entry.name.endsWith(".md"));
  return Promise.all(files.map(async (entry) => {
    const post = parseMarkdown((await readFile(repository, branch, entry.path))?.content || "");
    const slug = post.meta.slug || entry.name.replace(/\.md$/, "");
    return { slug, title: post.meta.title || entry.name, description: post.meta.description || "", date: post.meta.date || "", status: post.meta.status || "draft", tags: tags(post.meta.tags), category: post.meta.category || "", level: post.meta.level || "", words: post.body.split(/\s+/).filter(Boolean).length, images: await listBloggerPostImages(slug), isPublished: Boolean(await readFile(repository, branch, `blog/${slug}/index.html`)) };
  }));
}

export async function readBloggerPost(slug) {
  assertPostSlug(slug);
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
    const metadata = await readImageMetadata(slug);
    const post = await readFile(repository, branch, `blog-posts/${slug}.md`);
    const featured = post ? parseMarkdown(post.content).meta.image : "";
    return (Array.isArray(listing) ? listing : []).filter((entry) => /\.(png|jpe?g|webp|gif|svg)$/i.test(entry.name)).map((entry) => ({ ...metadata[entry.name], file: entry.name, url: publicImageUrl(slug, `img/${entry.name}`), previewUrl: `/api/posts/${encodeURIComponent(slug)}/images/${encodeURIComponent(entry.name)}`, alt: metadata[entry.name]?.alt || "", description: metadata[entry.name]?.description || "", isFeatured: featured === `img/${entry.name}` || featured === publicImageUrl(slug, `img/${entry.name}`), canDelete: true }));
  } catch (error) {
    if (String(error.message).includes("404")) return [];
    throw error;
  }
}

export async function saveBloggerPost(slug, input) {
  const { repository, branch } = config();
  const nextSlug = String(input.slug || slug || input.title || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!nextSlug) throw new Error("Post slug is required");
  const meta = { title: input.title, slug: nextSlug, description: input.description, date: input.date || new Date().toISOString().slice(0, 10), author: input.author || "Sport Massage Fuengirola", lang: normalizeBlogLanguage(input.lang || "en"), publish_languages: normalizePublicationLanguages(input.publish_languages || input.lang || "en"), tags: tags(input.tags).join(", "), image: input.image || "", category: input.category || "", level: input.level || "", status: input.status || "draft", content_format: input.content_format === "markdown" ? "markdown" : "html" };
  const existing = await readFile(repository, branch, `blog-posts/${nextSlug}.md`);
  const body = meta.content_format === "html" ? sanitizeHtml(input.body) : String(input.body || "");
  await writeFile(repository, branch, `blog-posts/${nextSlug}.md`, serializeMarkdown(meta, body), `blog: save ${nextSlug}`, existing?.sha);
  return { slug: nextSlug, meta, body, format: meta.content_format, images: await listBloggerPostImages(nextSlug), isPublished: Boolean(await readFile(repository, branch, `blog/${nextSlug}/index.html`)) };
}

async function writeFile(repository, branch, path, content, message, sha) {
  return githubRequest(`/repos/${repository}/contents/${githubContentPath(path)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, content: Buffer.from(content, "utf8").toString("base64"), branch, ...(sha ? { sha } : {}) }),
  });
}

export async function publishBloggerPost(meta, body) {
  assertPostSlug(meta.slug);
  const { repository, branch } = config();
  const referencePath = `/repos/${repository}/git/refs/heads/${branch.split('/').map(encodeURIComponent).join('/')}`;
  const reference = await githubRequest(referencePath.replace('/git/refs/', '/git/ref/'));
  const baseCommit = await githubRequest(`/repos/${repository}/git/commits/${reference.object.sha}`);
  const sourcePath = `blog-posts/${meta.slug}.md`;
  const htmlPath = `blog/${meta.slug}/index.html`;
  const indexPath = "blog/index.html";
  const safeBody = meta.content_format === "html" ? sanitizeHtml(body) : String(body || "");
  const publishedMeta = { ...meta, tags: tags(meta.tags).join(", "), publish_languages: normalizePublicationLanguages(meta.publish_languages || meta.lang || "en"), status: "published" };
  const markdown = serializeMarkdown(publishedMeta, safeBody);
  const index = await readFile(repository, reference.object.sha, indexPath);
  const sourceLanguage = normalizeBlogLanguage(meta.lang || "en");
  const publishLanguages = publishedMeta.publish_languages;
  const renderedBody = renderPostBody(meta, safeBody);
  const variants = await Promise.all(publishLanguages.map(async (language) => language === sourceLanguage
    ? { language, body: renderedBody, title: meta.title, description: meta.description }
    : { language, body: await translateHtml(renderedBody, sourceLanguage, language), title: decodeHTML(await translateHtml(escapeHtml(meta.title), sourceLanguage, language)), description: decodeHTML(await translateHtml(escapeHtml(meta.description || ""), sourceLanguage, language)) }));
  const imageMetadata = await readImageMetadata(meta.slug, reference.object.sha);
  const imageAlt = imageMetadata[String(meta.image || "").split("/").pop()]?.alt || meta.image_alt;
  const changes = [{ path: htmlPath, content: buildPostHtml({ ...meta, image_alt: imageAlt, lang: sourceLanguage }, safeBody) }];
  for (const variant of variants) {
    if (variant.language === sourceLanguage) continue;
    const variantPath = `blog/${meta.slug}/${variant.language}/index.html`;
    const variantMeta = { ...meta, slug: `${meta.slug}/${variant.language}`, title: variant.title, description: variant.description, image: meta.image ? publicImageUrl(meta.slug, meta.image) : "", image_alt: imageAlt, lang: variant.language, content_format: "html" };
    changes.push({ path: variantPath, content: buildPostHtml(variantMeta, variant.body) });
  }
  changes.push({ path: indexPath, content: upsertBlogIndexHtml(index?.content, meta) }, { path: sourcePath, content: markdown });
  const tree = await githubRequest(`/repos/${repository}/git/trees`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree: changes.map(change => ({ ...change, path: githubContentPath(change.path), mode: "100644", type: "blob" })) }),
  });
  const commit = await githubRequest(`/repos/${repository}/git/commits`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: `blog: publish ${meta.slug}`, tree: tree.sha, parents: [reference.object.sha] }),
  });
  // Only this fast-forward makes the complete publication visible. A concurrent
  // repository update rejects the ref change rather than overwriting its work.
  await githubRequest(referencePath, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sha: commit.sha, force: false }) });
  return { slug: meta.slug, url: `/blog/${meta.slug}/`, repository, branch };
}

function imagePath(slug, fileName) {
  assertPostSlug(slug);
  const safeSlug = slug;
  const safeFile = String(fileName || "").split(/[\\/]/).pop().toLowerCase().replace(/[^a-z0-9._-]/g, "-");
  if (!safeSlug || !safeFile || !/\.(png|jpe?g|webp|gif|svg)$/i.test(safeFile)) throw new Error("Invalid image path");
  return { path: `blog/${safeSlug}/img/${safeFile}`, file: safeFile };
}

function assertPostSlug(slug) {
  if (typeof slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("Invalid post slug");
}

function publicImageUrl(slug, value) {
  const image = String(value || "");
  if (/^https:\/\//i.test(image)) return image;
  if (image.startsWith("/blog/")) return `https://sportmassagefuengirola.com${image}`;
  if (!/^img\/[a-z0-9._-]+$/i.test(image) || image.includes("..")) throw new Error("Invalid featured image path");
  return `https://sportmassagefuengirola.com/blog/${slug}/${image}`;
}

async function readImageMetadata(slug, ref) {
  const { repository, branch } = config();
  const file = await readFile(repository, ref || branch, `blog-posts/${githubContentPath(slug)}.images.json`);
  if (!file) return {};
  const data = JSON.parse(file.content);
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid image metadata");
  return data;
}

export async function updateBloggerPostImage(slug, fileName, metadata = {}) {
  const { repository, branch } = config();
  const target = imagePath(slug, fileName);
  if (!await readFile(repository, branch, target.path)) throw new Error("Image not found");
  const path = `blog-posts/${slug}.images.json`;
  const existing = await readFile(repository, branch, path);
  const all = await readImageMetadata(slug);
  all[target.file] = { alt: String(metadata.alt || ""), description: String(metadata.description || "") };
  await writeFile(repository, branch, path, JSON.stringify(all, null, 2), `blog: image details ${slug}/${target.file}`, existing?.sha);
  const post = await readBloggerPost(slug);
  if (post && metadata.isFeatured !== undefined) {
    const image = metadata.isFeatured ? `img/${target.file}` : post.meta.image === `img/${target.file}` ? "" : post.meta.image;
    await saveBloggerPost(slug, { ...post.meta, body: post.body, image });
  }
  return (await listBloggerPostImages(slug)).find(image => image.file === target.file);
}

export async function readBloggerPostImage(slug, fileName) {
  const { repository, branch } = config();
  const target = imagePath(slug, fileName);
  const data = await githubRequest(`/repos/${repository}/contents/${target.path}?ref=${encodeURIComponent(branch)}`, { headers: { Accept: "application/vnd.github.raw+json" }, responseType: "buffer" });
  return { data, contentType: ({ png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", svg: "image/svg+xml" })[target.file.split(".").pop()] };
}

export async function saveBloggerPostImage(slug, fileName, data, metadata = {}) {
  const { repository, branch } = config();
  const target = imagePath(slug, fileName);
  const raw = String(data || "").replace(/^data:[^;]+;base64,/, "");
  if (!raw || raw.length > 8 * 1024 * 1024) throw new Error("Image is empty or too large");
  const existing = await readFile(repository, branch, target.path);
  await githubRequest(`/repos/${repository}/contents/${githubContentPath(target.path)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: `blog: upload ${slug}/${target.file}`, content: raw, branch, ...(existing?.sha ? { sha: existing.sha } : {}) }) });
  return updateBloggerPostImage(slug, target.file, metadata);
}

export async function deleteBloggerPostImage(slug, fileName) {
  const { repository, branch } = config();
  const target = imagePath(slug, fileName);
  const existing = await readFile(repository, branch, target.path);
  if (!existing) return false;
  await githubRequest(`/repos/${repository}/contents/${githubContentPath(target.path)}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: `blog: delete ${slug}/${target.file}`, sha: existing.sha, branch }) });
  const path = `blog-posts/${slug}.images.json`;
  const details = await readFile(repository, branch, path);
  if (details) {
    const all = await readImageMetadata(slug);
    delete all[target.file];
    await writeFile(repository, branch, path, JSON.stringify(all, null, 2), `blog: remove image details ${slug}/${target.file}`, details.sha);
  }
  const post = await readBloggerPost(slug);
  if (post && [ `img/${target.file}`, publicImageUrl(slug, `img/${target.file}`) ].includes(post.meta.image)) {
    await saveBloggerPost(slug, { ...post.meta, body: post.body, image: "" });
  }
  return true;
}
