import { z } from 'zod';

const ALLOWED_ORIGINS = new Set([
  'https://webfuengirola.com',
  'https://www.webfuengirola.com',
]);

const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160),
  company: z.string().trim().max(160).optional().default(''),
  message: z.string().trim().min(10).max(5000),
  website: z.string().trim().max(200).optional().default(''),
  token: z.string().trim().optional().default(''),
  pageUrl: z.string().trim().url().max(500).optional().default(''),
});

function turnstileConfiguration(env) {
  const primarySiteKey = String(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '').trim();
  const fallbackSiteKey = String(env.TURNSTILE_SITE_KEY || '').trim();
  const siteKey = primarySiteKey || fallbackSiteKey;
  const secret = String(env.TURNSTILE_SECRET_KEY || '').trim();
  if (!siteKey && !secret) return { state: 'disabled' };
  if (!siteKey || !secret) return { state: 'misconfigured' };
  return { state: 'enabled', siteKey, secret };
}

function allowedOrigin(request) {
  const origin = request.headers.get('origin');
  return origin && ALLOWED_ORIGINS.has(origin) ? origin : null;
}

function corsHeaders(origin, methods) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(body, status, origin, methods) {
  return Response.json(body, { status, headers: corsHeaders(origin, methods) });
}

export function handleContactOptions(request, methods) {
  const origin = allowedOrigin(request);
  if (!origin) return Response.json({ error: 'forbidden_origin' }, { status: 403 });
  return new Response(null, { status: 204, headers: corsHeaders(origin, methods) });
}

export async function handleContactConfigGet(request, { env = process.env } = {}) {
  const origin = allowedOrigin(request);
  if (!origin) return Response.json({ error: 'forbidden_origin' }, { status: 403 });
  const config = turnstileConfiguration(env);
  if (config.state === 'misconfigured') {
    return json({ error: 'turnstile_misconfigured' }, 503, origin, 'GET,OPTIONS');
  }
  if (config.state === 'disabled') {
    return json({ turnstileEnabled: false }, 200, origin, 'GET,OPTIONS');
  }
  return json({ turnstileEnabled: true, turnstileSiteKey: config.siteKey }, 200, origin, 'GET,OPTIONS');
}

async function verifyTurnstileToken(token, remoteIp, secret, fetchImpl = fetch) {
  const formData = new FormData();
  formData.append('secret', secret);
  formData.append('response', token);
  if (remoteIp) formData.append('remoteip', remoteIp);
  const response = await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: formData,
    cache: 'no-store',
  });
  if (!response.ok) return false;
  const payload = await response.json();
  return Boolean(payload.success);
}

export async function handleContactPost(request, {
  env = process.env,
  fetchImpl = fetch,
  verifyToken = (token, remoteIp, secret) => verifyTurnstileToken(token, remoteIp, secret, fetchImpl),
  sendEmail,
} = {}) {
  const origin = allowedOrigin(request);
  if (!origin) return Response.json({ success: false, error: 'forbidden_origin' }, { status: 403 });
  const methods = 'POST,OPTIONS';
  const config = turnstileConfiguration(env);
  if (config.state === 'misconfigured') {
    return json({ success: false, error: 'turnstile_misconfigured' }, 503, origin, methods);
  }

  try {
    const parsed = contactSchema.safeParse(await request.json());
    if (!parsed.success || (config.state === 'enabled' && !parsed.data.token)) {
      return json({ success: false, error: 'invalid_payload' }, 400, origin, methods);
    }
    const { name, email, company, message, website, token, pageUrl } = parsed.data;
    if (website) return json({ success: true }, 200, origin, methods);

    if (config.state === 'enabled') {
      const valid = await verifyToken(token, request.headers.get('x-forwarded-for'), config.secret);
      if (!valid) return json({ success: false, error: 'turnstile_failed' }, 400, origin, methods);
    }

    if (typeof sendEmail !== 'function') throw new Error('contact_email_dependency_missing');
    await sendEmail({ name, email, company, message, pageUrl });
    return json({ success: true }, 200, origin, methods);
  } catch {
    console.error('Public contact form submission failed');
    return json({ success: false, error: 'server_error' }, 500, origin, methods);
  }
}
