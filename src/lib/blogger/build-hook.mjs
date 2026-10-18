export function buildHookRequest(siteKey, env = process.env) {
  const suffix = String(siteKey).toUpperCase().replace(/[^A-Z0-9]/g, '_');
  const url = env[`BLOGGER_BUILD_HOOK_${suffix}`];
  const secret = env[`BLOGGER_BUILD_SECRET_${suffix}`];
  if (!url) throw Object.assign(new Error(`Falta el webhook de publicación para ${siteKey}.`), { status: 503 });
  if (!secret) throw Object.assign(new Error(`Falta el secreto de publicación para ${siteKey}.`), { status: 503 });
  return {
    url,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({ siteKey }),
  };
}
