const ALLOWED_TAGS = new Set([
  "a", "b", "blockquote", "br", "code", "em", "h1", "h2", "h3", "h4", "h5", "h6", "i", "img", "li", "ol", "p", "pre", "strong", "u", "ul",
]);
const VOID_TAGS = new Set(["br", "img"]);
const DROP_CONTENT_TAGS = /<(?:script|style|iframe|object|embed|svg|math|template)\b[^>]*>[\s\S]*?<\/(?:script|style|iframe|object|embed|svg|math|template)\s*>/gi;
const DROP_SELF_CLOSING_TAGS = /<(?:script|style|iframe|object|embed|svg|math|template)\b[^>]*\/?>/gi;
const TAG_RE = /<!--[\s\S]*?-->|<\/?[a-z][^>]*>/gi;
const ATTRIBUTE_RE = /([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/gi;

function safeUrl(value, kind) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  try {
    const url = new URL(raw, "https://studio.invalid");
    if (!["http:", "https:"].includes(url.protocol)) return null;
    if (kind === "image" && url.username) return null;
    return raw;
  } catch {
    return null;
  }
}

function escapeAttribute(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function sanitizeTag(source) {
  if (source.startsWith("<!--")) return "";
  const closing = /^<\s*\//.test(source);
  const match = source.match(/^<\s*\/?\s*([a-z0-9:-]+)/i);
  if (!match) return "";
  const tag = match[1].toLowerCase();
  if (!ALLOWED_TAGS.has(tag)) return "";
  if (closing) return VOID_TAGS.has(tag) ? "" : `</${tag}>`;

  const attrs = [];
  const rawAttributes = source.slice(match[0].length, -1);
  let attribute;
  while ((attribute = ATTRIBUTE_RE.exec(rawAttributes))) {
    const name = attribute[1].toLowerCase();
    const value = attribute[2] ?? attribute[3] ?? attribute[4] ?? "";
    if (name.startsWith("on") || name === "style" || name === "srcdoc") continue;
    if (tag === "a" && name === "href") {
      const href = safeUrl(value, "link");
      if (href) attrs.push(` href="${escapeAttribute(href)}"`);
      continue;
    }
    if (tag === "img" && name === "src") {
      const src = safeUrl(value, "image");
      if (src) attrs.push(` src="${escapeAttribute(src)}"`);
      continue;
    }
    if ((tag === "a" && ["title", "target"].includes(name)) || (tag === "img" && ["alt", "title", "width", "height"].includes(name))) {
      attrs.push(` ${name}="${escapeAttribute(value)}"`);
    }
  }
  if (tag === "a" && attrs.some((attr) => attr === ' target="_blank"')) attrs.push(' rel="noopener noreferrer"');
  return `<${tag}${attrs.join("")}>`;
}

export function sanitizeHtml(input) {
  return String(input ?? "")
    .replace(DROP_CONTENT_TAGS, "")
    .replace(DROP_SELF_CLOSING_TAGS, "")
    .replace(TAG_RE, sanitizeTag);
}
