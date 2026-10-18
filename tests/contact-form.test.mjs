import assert from 'node:assert/strict';
import test from 'node:test';

import { handleContactConfigGet, handleContactPost } from '../src/lib/contact-form.mjs';

const origin = 'https://webfuengirola.com';
const validPayload = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  company: 'Analytical Engines',
  message: 'Necesito una auditoría completa de mi web.',
  website: '',
  pageUrl: 'https://webfuengirola.com/contacto',
};

function request(method, body) {
  return new Request('https://admin.webfuengirola.com/api/contact', {
    method,
    headers: { origin, 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.8' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

test('GET contact config disables Turnstile when both keys are absent', async () => {
  const response = await handleContactConfigGet(request('GET'), { env: {} });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { turnstileEnabled: false });
});

test('POST accepts an empty token without verification when Turnstile is disabled', async () => {
  let verificationCalls = 0;
  const emails = [];
  const response = await handleContactPost(request('POST', { ...validPayload, token: '' }), {
    env: {},
    verifyToken: async () => { verificationCalls += 1; return false; },
    sendEmail: async (message) => { emails.push(message); },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true });
  assert.equal(verificationCalls, 0);
  assert.equal(emails.length, 1);
  assert.equal(emails[0].email, validPayload.email);
});

test('disabled Turnstile still enforces origin, schema and honeypot', async () => {
  const sent = [];
  const forbidden = await handleContactPost(new Request('https://admin.webfuengirola.com/api/contact', {
    method: 'POST',
    headers: { origin: 'https://evil.example', 'content-type': 'application/json' },
    body: JSON.stringify({ ...validPayload, token: '' }),
  }), { env: {}, sendEmail: async (message) => sent.push(message) });
  assert.equal(forbidden.status, 403);
  assert.equal((await forbidden.json()).error, 'forbidden_origin');

  const invalid = await handleContactPost(request('POST', { ...validPayload, email: 'invalid', token: '' }), {
    env: {}, sendEmail: async (message) => sent.push(message),
  });
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).error, 'invalid_payload');

  const honeypot = await handleContactPost(request('POST', { ...validPayload, website: 'spam', token: '' }), {
    env: {}, sendEmail: async (message) => sent.push(message),
  });
  assert.equal(honeypot.status, 200);
  assert.deepEqual(await honeypot.json(), { success: true });
  assert.equal(sent.length, 0);
});

for (const siteKeyName of ['NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'TURNSTILE_SITE_KEY']) {
  test(`GET enables Turnstile with ${siteKeyName} and the secret`, async () => {
    const env = { [siteKeyName]: 'public-site-key', TURNSTILE_SECRET_KEY: 'private-secret' };
    const response = await handleContactConfigGet(request('GET'), { env });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { turnstileEnabled: true, turnstileSiteKey: 'public-site-key' });
    assert.doesNotMatch(JSON.stringify(await handleContactConfigGet(request('GET'), { env }).then((item) => item.json())), /private-secret/);
  });
}

test('blank primary Turnstile site key does not hide the configured legacy fallback', async () => {
  const response = await handleContactConfigGet(request('GET'), {
    env: {
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: '   ',
      TURNSTILE_SITE_KEY: 'legacy-public-key',
      TURNSTILE_SECRET_KEY: 'private-secret',
    },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { turnstileEnabled: true, turnstileSiteKey: 'legacy-public-key' });
});

test('enabled Turnstile requires and verifies the token before sending email', async () => {
  const env = { NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'public-site-key', TURNSTILE_SECRET_KEY: 'private-secret' };
  const missing = await handleContactPost(request('POST', { ...validPayload, token: '' }), { env, sendEmail: async () => {} });
  assert.equal(missing.status, 400);
  assert.equal((await missing.json()).error, 'invalid_payload');

  let verified;
  let sent = 0;
  const accepted = await handleContactPost(request('POST', { ...validPayload, token: 'valid-token' }), {
    env,
    verifyToken: async (token, remoteIp, secret) => { verified = { token, remoteIp, secret }; return true; },
    sendEmail: async () => { sent += 1; },
  });
  assert.equal(accepted.status, 200);
  assert.deepEqual(verified, { token: 'valid-token', remoteIp: '203.0.113.8', secret: 'private-secret' });
  assert.equal(sent, 1);

  const rejected = await handleContactPost(request('POST', { ...validPayload, token: 'invalid-token' }), {
    env,
    verifyToken: async () => false,
    sendEmail: async () => { sent += 1; },
  });
  assert.equal(rejected.status, 400);
  assert.deepEqual(await rejected.json(), { success: false, error: 'turnstile_failed' });
  assert.equal(sent, 1);
});

test('Turnstile verification uses a bounded abort signal', async () => {
  const env = { NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'public-site-key', TURNSTILE_SECRET_KEY: 'private-secret' };
  let verificationSignal;
  const response = await handleContactPost(request('POST', { ...validPayload, token: 'valid-token' }), {
    env,
    fetchImpl: async (_url, options) => {
      verificationSignal = options.signal;
      return Response.json({ success: true });
    },
    sendEmail: async () => {},
  });
  assert.equal(response.status, 200);
  assert.ok(verificationSignal instanceof AbortSignal);
});

for (const env of [
  { NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'public-only' },
  { TURNSTILE_SECRET_KEY: 'private-only' },
]) {
  test(`partial Turnstile configuration fails closed without leaking ${Object.keys(env)[0]}`, async () => {
    const config = await handleContactConfigGet(request('GET'), { env });
    assert.equal(config.status, 503);
    assert.deepEqual(await config.json(), { error: 'turnstile_misconfigured' });
    const post = await handleContactPost(request('POST', { ...validPayload, token: 'token' }), { env, sendEmail: async () => {} });
    assert.equal(post.status, 503);
    assert.deepEqual(await post.json(), { success: false, error: 'turnstile_misconfigured' });
    assert.doesNotMatch(JSON.stringify(await handleContactConfigGet(request('GET'), { env }).then((item) => item.json())), /public-only|private-only/);
  });
}
