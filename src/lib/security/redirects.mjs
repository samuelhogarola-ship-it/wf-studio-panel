const DEFAULT_ALLOWED_PREFIXES = ["/cliente", "/paneladmin"];
const CLIENT_DESTINATION_FALLBACK = "/cliente/dashboard";
const BLOGGER_SITE_SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function sanitizeInternalRedirect(next, options = {}) {
  const fallback = options.fallback ?? "/cliente/dashboard";
  const allowedPrefixes = options.allowedPrefixes ?? DEFAULT_ALLOWED_PREFIXES;

  if (typeof next !== "string" || next.length === 0) {
    return fallback;
  }

  if (!next.startsWith("/") || next.startsWith("//")) {
    return fallback;
  }

  try {
    const url = new URL(next, "https://wf.local");
    const path = `${url.pathname}${url.search}${url.hash}`;

    if (
      !allowedPrefixes.some(
        (prefix) =>
          prefix === "/" || path === prefix || path.startsWith(`${prefix}/`),
      )
    ) {
      return fallback;
    }

    return path;
  } catch {
    return fallback;
  }
}

export function sanitizeClientDestination(value) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return CLIENT_DESTINATION_FALLBACK;
  }

  try {
    const url = new URL(value, "https://wf.local");

    if (url.origin !== "https://wf.local" || url.pathname.includes("%")) {
      return CLIENT_DESTINATION_FALLBACK;
    }

    const isClientPortal =
      url.pathname === "/cliente" || url.pathname.startsWith("/cliente/");
    const directBloggerMatch = url.pathname.match(/^\/acceso\/blogger\/([^/]+)$/);
    const isDirectBlogger =
      directBloggerMatch !== null && BLOGGER_SITE_SEGMENT.test(directBloggerMatch[1]);

    if (!isClientPortal && !isDirectBlogger) {
      return CLIENT_DESTINATION_FALLBACK;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return CLIENT_DESTINATION_FALLBACK;
  }
}

export function buildCanonicalAppUrl(appUrl, path = "/") {
  if (typeof appUrl !== "string" || appUrl.trim().length === 0) {
    throw new Error("Missing canonical app URL");
  }

  const base = new URL(appUrl);
  const normalizedPath = sanitizeInternalRedirect(path, {
    fallback: "/",
    allowedPrefixes: ["/"],
  });

  return new URL(normalizedPath, base);
}

export function resolveRequestOrigin({
  forwardedHost,
  forwardedProto,
  requestOrigin,
  fallbackOrigin,
}) {
  const normalizedHost =
    typeof forwardedHost === "string"
      ? forwardedHost.split(",")[0]?.trim()
      : "";
  const normalizedProto =
    typeof forwardedProto === "string"
      ? forwardedProto.split(",")[0]?.trim()
      : "";

  if (normalizedHost) {
    return `${normalizedProto || "https"}://${normalizedHost}`;
  }

  if (typeof fallbackOrigin === "string" && fallbackOrigin.trim().length > 0) {
    return fallbackOrigin;
  }

  return requestOrigin;
}

export function getProtectedArea(pathname) {
  if (typeof pathname !== "string" || pathname.length === 0) {
    return null;
  }

  if (pathname.startsWith("/paneladmin/")) {
    return "admin";
  }

  if (pathname.startsWith("/cliente/") && pathname !== "/cliente/registro") {
    return "client";
  }

  return null;
}
