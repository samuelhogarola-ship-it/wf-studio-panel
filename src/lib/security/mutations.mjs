import { resolveRequestOrigin } from "./redirects.mjs";
import { hasConsistentForwardedOrigin } from "./redirects.mjs";
import { getCustomBloggerOrigin, getCustomBloggerSiteByHost } from "../blogger/custom-hosts.mjs";

function mutationError(message, status) {
  return Object.assign(new Error(message), { status });
}

/** Browser mutations must originate from the exact application origin. */
export function assertTrustedMutation(request, { requireJson = false, fallbackOrigin, allowedHosts } = {}) {
  const requestUrl = new URL(request.url);
  const browserOrigin = request.headers.get("origin");
  let browserHost = "";
  try { browserHost = browserOrigin ? new URL(browserOrigin).hostname : ""; } catch { browserHost = ""; }
  const customSite = getCustomBloggerSiteByHost(request.headers.get("x-forwarded-host") ?? "") ??
    getCustomBloggerSiteByHost(requestUrl.hostname) ?? getCustomBloggerSiteByHost(browserHost);
  const customOrigin = customSite ? getCustomBloggerOrigin(customSite) : null;
  const effectiveAllowedHosts = [...new Set([
    ...(allowedHosts ?? ["admin.webfuengirola.com", "portal.webfuengirola.com"]),
    ...(customOrigin ? [new URL(customOrigin).hostname] : []),
  ])];
  const effectiveFallbackOrigin = fallbackOrigin ?? (customOrigin === browserOrigin ? customOrigin : undefined);
  if (!hasConsistentForwardedOrigin({
    forwardedHost: request.headers.get("x-forwarded-host"),
    forwardedProto: request.headers.get("x-forwarded-proto"),
    requestOrigin: requestUrl.origin,
    allowedHosts: effectiveAllowedHosts,
  })) throw mutationError("Origen no permitido.", 403);
  const expectedOrigin = resolveRequestOrigin({
    forwardedHost: request.headers.get("x-forwarded-host"),
    forwardedProto: request.headers.get("x-forwarded-proto"),
    requestOrigin: requestUrl.origin,
    fallbackOrigin: effectiveFallbackOrigin,
    allowedHosts: effectiveAllowedHosts,
  });
  if (request.headers.get("origin") !== expectedOrigin) {
    throw mutationError("Origen no permitido.", 403);
  }
  if (requireJson && !request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw mutationError("El contenido debe ser JSON.", 415);
  }
}
