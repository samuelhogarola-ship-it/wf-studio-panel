const DEFAULT_ALLOWED_PREFIXES = ["/cliente", "/paneladmin"];
const CLIENT_DESTINATION_FALLBACK = "/cliente/dashboard";
const BLOGGER_SITE_SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ADMIN_ORIGIN = "https://admin.webfuengirola.com";
const PORTAL_ORIGIN = "https://portal.webfuengirola.com";

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

export function isDirectBloggerDestination(value) {
  const destination = sanitizeClientDestination(value);
  return destination === value && destination.startsWith("/acceso/blogger/");
}

export function buildCanonicalClientDestinationUrl(value) {
  const destination = sanitizeClientDestination(value);
  const origin = isDirectBloggerDestination(destination) ? ADMIN_ORIGIN : PORTAL_ORIGIN;
  return new URL(destination, origin);
}

export function buildCanonicalClientLoginUrl(value, error) {
  const destination = sanitizeClientDestination(value);
  const origin = isDirectBloggerDestination(destination) ? ADMIN_ORIGIN : PORTAL_ORIGIN;
  const loginUrl = new URL("/cliente", origin);
  loginUrl.searchParams.set("redirectedFrom", destination);
  if (error === "callback_exchange_failed") {
    loginUrl.searchParams.set("error", error);
  }
  return loginUrl;
}

export function buildCanonicalClientCallbackUrl(value) {
  const destination = sanitizeClientDestination(value);
  const origin = isDirectBloggerDestination(destination) ? ADMIN_ORIGIN : PORTAL_ORIGIN;
  const callbackUrl = new URL("/auth/callback", origin);
  callbackUrl.searchParams.set("next", destination);
  return callbackUrl;
}

export function buildCanonicalResetCallbackUrl() {
  return new URL("/auth/callback/reset", PORTAL_ORIGIN);
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
  allowedHosts = ["admin.webfuengirola.com", "portal.webfuengirola.com"],
}) {
  const normalizedHost =
    typeof forwardedHost === "string" && !forwardedHost.includes(",")
      ? forwardedHost.trim().toLowerCase()
      : "";
  const normalizedProto =
    typeof forwardedProto === "string" && !forwardedProto.includes(",")
      ? forwardedProto.trim().toLowerCase()
      : "";
  const hasForwardedHost = forwardedHost !== null && forwardedHost !== undefined;

  let requestUrl;
  try {
    requestUrl = new URL(requestOrigin);
  } catch {
    requestUrl = null;
  }
  const requestHost = requestUrl?.hostname.toLowerCase() ?? "";
  if (requestUrl && allowedHosts.includes(requestHost)) {
    if (
      requestUrl.protocol === "http:" &&
      normalizedProto === "https" &&
      (!hasForwardedHost || normalizedHost === requestHost)
    ) {
      return `https://${requestHost}`;
    }
    return requestUrl.origin;
  }
  const trustedInternalOrigin = isTrustedInternalRequestOrigin(requestUrl?.origin);

  if (trustedInternalOrigin && normalizedProto === "https" && normalizedHost && allowedHosts.includes(normalizedHost)) {
    return `https://${normalizedHost}`;
  }

  if (typeof fallbackOrigin === "string" && fallbackOrigin.trim().length > 0) {
    return fallbackOrigin;
  }

  return requestOrigin;
}

export function hasConsistentForwardedOrigin({
  forwardedHost,
  forwardedProto,
  requestOrigin,
  allowedHosts = ["admin.webfuengirola.com", "portal.webfuengirola.com"],
}) {
  const hasHost = forwardedHost !== null && forwardedHost !== undefined;
  const hasProto = forwardedProto !== null && forwardedProto !== undefined;
  if (!hasHost && !hasProto) return true;

  let requestUrl;
  try {
    requestUrl = new URL(requestOrigin);
  } catch {
    return false;
  }
  const normalizedProto = typeof forwardedProto === "string" && !forwardedProto.includes(",")
    ? forwardedProto.trim().toLowerCase()
    : "";
  if (!hasHost) {
    return normalizedProto === "https" && requestUrl.protocol === "http:" &&
      allowedHosts.includes(requestUrl.hostname.toLowerCase());
  }
  if (!hasProto) return false;
  const normalizedHost = typeof forwardedHost === "string" && !forwardedHost.includes(",")
    ? forwardedHost.trim().toLowerCase()
    : "";
  const requestProtocol = requestUrl.protocol.slice(0, -1).toLowerCase();
  if (
    isTrustedInternalRequestOrigin(requestUrl.origin) &&
    normalizedHost === requestUrl.host.toLowerCase() &&
    normalizedProto === requestProtocol
  ) {
    return true;
  }
  if (!normalizedHost || normalizedProto !== "https" || !allowedHosts.includes(normalizedHost)) return false;

  const requestHost = requestUrl.hostname.toLowerCase();
  if (allowedHosts.includes(requestHost)) return normalizedHost === requestHost;
  return isTrustedInternalRequestOrigin(requestUrl.origin);
}

export function isTrustedInternalRequestOrigin(origin) {
  let requestUrl;
  try {
    requestUrl = new URL(origin);
  } catch {
    return false;
  }
  const requestHost = requestUrl.hostname.toLowerCase();
  return (requestUrl.protocol === "http:" || requestUrl.protocol === "https:") &&
    requestUrl.port === "3000" && (
    requestHost === "localhost" ||
    requestHost === "127.0.0.1" ||
    requestHost === "0.0.0.0" ||
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(requestHost)
  );
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
