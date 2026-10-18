export function buildHookRequest(siteKey, env = process.env) {
  const suffix = String(siteKey).toUpperCase().replace(/[^A-Z0-9]/g, '_');
  const url = env[`BLOGGER_BUILD_HOOK_${suffix}`];
  const secret = env[`BLOGGER_BUILD_SECRET_${suffix}`];
  if (!url) throw Object.assign(new Error(`Falta el webhook de publicación para ${siteKey}.`), { status: 503 });
  if (!secret) throw Object.assign(new Error(`Falta el secreto de publicación para ${siteKey}.`), { status: 503 });
  if (/\r|\n/.test(secret)) {
    throw Object.assign(new Error('El secreto de publicación configurado no es válido.'), { status: 503 });
  }
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw Object.assign(new Error('El webhook de publicación configurado no es válido.'), { status: 503 });
  }
  if (env.NODE_ENV === 'production' && parsedUrl.protocol !== 'https:') {
    throw Object.assign(new Error('El webhook de publicación configurado no es válido.'), { status: 503 });
  }
  return {
    url: parsedUrl.toString(),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({ siteKey }),
  };
}

export async function executeBuildHook(siteKey, { env = process.env, fetchImpl = fetch } = {}) {
  try {
    const request = buildHookRequest(siteKey, env);
    const response = await fetchImpl(request.url, {
      method: 'POST',
      headers: request.headers,
      body: request.body,
      cache: 'no-store',
      redirect: 'manual',
    });
    if (!response.ok) {
      return {
        status: 502,
        body: { error: `El publicador de ${siteKey} respondió ${response.status}.` },
      };
    }
    return { status: 200, body: { ok: true, siteKey } };
  } catch (error) {
    const isConfigurationError = error?.status === 503;
    return {
      status: isConfigurationError ? 503 : 502,
      body: {
        error: isConfigurationError
          ? `La publicación de ${siteKey} no está configurada.`
          : `No se pudo contactar con el publicador de ${siteKey}.`,
      },
    };
  }
}
