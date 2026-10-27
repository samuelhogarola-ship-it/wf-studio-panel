import { resolveRequestOrigin } from "./redirects.mjs";

function mutationError(message, status) {
  return Object.assign(new Error(message), { status });
}

/** Browser mutations must originate from the exact application origin. */
export function assertTrustedMutation(request, { requireJson = false, fallbackOrigin, allowedHosts } = {}) {
  const expectedOrigin = resolveRequestOrigin({
    forwardedHost: request.headers.get("x-forwarded-host"),
    forwardedProto: request.headers.get("x-forwarded-proto"),
    requestOrigin: new URL(request.url).origin,
    fallbackOrigin,
    allowedHosts,
  });
  if (request.headers.get("origin") !== expectedOrigin) {
    throw mutationError("Origen no permitido.", 403);
  }
  if (requireJson && !request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw mutationError("El contenido debe ser JSON.", 415);
  }
}
