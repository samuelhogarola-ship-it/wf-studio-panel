import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { client, database, form, loadProjectModule } from './helpers/project-harness.mjs';

function loadAuthActions() {
  const passwordCalls = [];
  const magicCalls = [];
  const sessionClient = {
    auth: {
      async signInWithPassword(input) {
        passwordCalls.push(input);
        return { error: null };
      },
      async signInWithOtp(input) {
        magicCalls.push(input);
        return { error: null };
      },
    },
  };
  const adminClient = database({ clients: [client] });
  const actions = loadProjectModule('src/lib/actions/auth.ts', {
    '@/lib/supabase/server': { createSupabaseServerClient: async () => sessionClient },
    '@/lib/supabase/admin': { getSupabaseAdminClient: () => adminClient },
    'next/navigation': { redirect(destination) { throw new Error(`redirect:${destination}`); } },
  });
  return { actions, magicCalls, passwordCalls };
}

function loadAuthCallback() {
  const exchangedCodes = [];
  const route = loadProjectModule('src/app/auth/callback/route.ts', {
    '@/lib/supabase/server': {
      createSupabaseRouteClient: (_request, response) => ({
        auth: {
          async exchangeCodeForSession(code) {
            exchangedCodes.push(code);
            response.cookies.set('sb-host-only', 'session-token', { httpOnly: true, path: '/' });
          },
        },
      }),
    },
  });
  return { exchangedCodes, route };
}

test('password login redirects to the sanitized client destination', async () => {
  const { actions, passwordCalls } = loadAuthActions();

  await assert.rejects(
    () => actions.clientPasswordLoginAction({}, form({
      email: client.email,
      password: 'secret-password',
      destination: '/acceso/blogger/sportmassagefuengirola',
    })),
    { message: 'redirect:https://admin.webfuengirola.com/acceso/blogger/sportmassagefuengirola' },
  );
  assert.deepEqual(passwordCalls, [{ email: client.email, password: 'secret-password' }]);
});

test('password login falls back to the dashboard for an administrator destination', async () => {
  const { actions } = loadAuthActions();

  await assert.rejects(
    () => actions.clientPasswordLoginAction({}, form({
      email: client.email,
      password: 'secret-password',
      destination: '/paneladmin/inicio',
    })),
    { message: 'redirect:https://portal.webfuengirola.com/cliente/dashboard' },
  );
});

test('magic-link login carries the sanitized destination through the callback', async () => {
  const { actions, magicCalls } = loadAuthActions();

  assert.deepEqual(
    await actions.clientMagicLinkAction({}, form({
      email: client.email,
      origin: 'https://portal.webfuengirola.com',
      destination: '/acceso/blogger/sportmassagefuengirola',
    })),
    { success: 'Te hemos enviado un enlace de acceso a tu email.' },
  );
  assert.deepEqual(magicCalls, [{
    email: client.email,
    options: {
      emailRedirectTo: 'https://admin.webfuengirola.com/auth/callback?next=%2Facceso%2Fblogger%2Fsportmassagefuengirola',
    },
  }]);
});

test('magic-link login ignores a caller-controlled callback origin', async () => {
  const { actions, magicCalls } = loadAuthActions();

  await actions.clientMagicLinkAction({}, form({
    email: client.email,
    origin: 'https://evil.example',
    destination: '/acceso/blogger/sportmassagefuengirola',
  }));

  assert.equal(
    magicCalls[0].options.emailRedirectTo,
    'https://admin.webfuengirola.com/auth/callback?next=%2Facceso%2Fblogger%2Fsportmassagefuengirola',
  );
});

test('magic-link callback opens the direct Blogger destination end to end', async () => {
  const { actions, magicCalls } = loadAuthActions();
  await actions.clientMagicLinkAction({}, form({
    email: client.email,
    origin: 'https://portal.webfuengirola.com',
    destination: '/acceso/blogger/sportmassagefuengirola',
  }));
  const callbackUrl = new URL(magicCalls[0].options.emailRedirectTo);
  callbackUrl.searchParams.set('code', 'valid-code');
  const { exchangedCodes, route } = loadAuthCallback();

  const response = await route.GET(new Request(callbackUrl));

  assert.equal(
    response.headers.get('location'),
    'https://admin.webfuengirola.com/acceso/blogger/sportmassagefuengirola',
  );
  assert.deepEqual(exchangedCodes, ['valid-code']);
  assert.match(response.headers.get('set-cookie') ?? '', /sb-host-only=session-token/);
  assert.doesNotMatch(response.headers.get('set-cookie') ?? '', /domain=/i);
});

test('client callback rejects external, encoded and administrator destinations', async () => {
  const { route } = loadAuthCallback();

  for (const destination of [
    'https://evil.example/phish',
    '/cliente/%2e%2e/paneladmin/inicio',
    '/paneladmin/inicio',
  ]) {
    const callbackUrl = new URL('https://portal.webfuengirola.com/auth/callback');
    callbackUrl.searchParams.set('next', destination);
    const response = await route.GET(new Request(callbackUrl));
    assert.equal(
      response.headers.get('location'),
      'https://portal.webfuengirola.com/cliente/dashboard',
      destination,
    );
  }
});

test('administrator callback retains its panel destination', async () => {
  const { route } = loadAuthCallback();
  const callbackUrl = new URL('https://admin.webfuengirola.com/auth/callback');
  callbackUrl.searchParams.set('next', '/paneladmin/proyectos?tab=blogger');

  const response = await route.GET(new Request(callbackUrl, {
    headers: { host: 'admin.webfuengirola.com' },
  }));

  assert.equal(
    response.headers.get('location'),
    'https://admin.webfuengirola.com/paneladmin/proyectos?tab=blogger',
  );
});

test('administrator-host callback accepts a safe direct Blogger client destination', async () => {
  const { route } = loadAuthCallback();
  const callbackUrl = new URL('https://admin.webfuengirola.com/auth/callback');
  callbackUrl.searchParams.set('next', '/acceso/blogger/sportmassagefuengirola');

  const response = await route.GET(new Request(callbackUrl, {
    headers: { host: 'admin.webfuengirola.com' },
  }));

  assert.equal(
    response.headers.get('location'),
    'https://admin.webfuengirola.com/acceso/blogger/sportmassagefuengirola',
  );
});

test('failed admin-host magic-link callback preserves the error on the exact Blogger return target', async () => {
  const route = loadProjectModule('src/app/auth/callback/route.ts', {
    '@/lib/supabase/server': {
      createSupabaseRouteClient: () => ({
        auth: { async exchangeCodeForSession() { throw new Error('expired code'); } },
      }),
    },
  });
  const callbackUrl = new URL('https://admin.webfuengirola.com/auth/callback');
  callbackUrl.searchParams.set('code', 'expired-code');
  callbackUrl.searchParams.set('next', '/acceso/blogger/sportmassagefuengirola');

  const response = await route.GET(new Request(callbackUrl, {
    headers: { host: 'admin.webfuengirola.com' },
  }));

  assert.equal(
    response.headers.get('location'),
    'https://admin.webfuengirola.com/acceso/blogger/sportmassagefuengirola?error=callback_exchange_failed',
  );
});

test('magic-link login replaces an external destination with the dashboard', async () => {
  const { actions, magicCalls } = loadAuthActions();

  await actions.clientMagicLinkAction({}, form({
    email: client.email,
    origin: 'https://portal.webfuengirola.com',
    destination: 'https://evil.example/phish',
  }));
  assert.equal(
    magicCalls[0].options.emailRedirectTo,
    'https://portal.webfuengirola.com/auth/callback?next=%2Fcliente%2Fdashboard',
  );
});

test('normal client magic-link login stays entirely on the portal host', async () => {
  const { actions, magicCalls } = loadAuthActions();

  await actions.clientMagicLinkAction({}, form({
    email: client.email,
    destination: '/cliente/proyectos',
  }));
  assert.equal(
    magicCalls[0].options.emailRedirectTo,
    'https://portal.webfuengirola.com/auth/callback?next=%2Fcliente%2Fproyectos',
  );
});

for (const [requested, expected] of [
  ['/acceso/blogger/sportmassagefuengirola', 'https://admin.webfuengirola.com/acceso/blogger/sportmassagefuengirola'],
  ['/paneladmin/inicio', '/cliente/dashboard'],
]) {
  test(`authenticated client entry honors the safe destination for ${requested}`, async () => {
    const Page = loadProjectModule('src/app/cliente/page.tsx', {
      '@/lib/auth': { getOptionalIdentity: async () => ({ role: 'client' }) },
      '@/lib/data/projects': { getClientPortalContext: async () => { throw new Error('portal context must not be read'); } },
      'next/navigation': { redirect(destination) { throw new Error(`redirect:${destination}`); } },
    }).default;

    await assert.rejects(
      () => Page({ searchParams: Promise.resolve({ redirectedFrom: requested }) }),
      { message: `redirect:${expected}` },
    );
  });
}

for (const tab of ['magic', 'password']) {
  test(`${tab} login form submits the sanitized destination`, () => {
    const ClientLoginForm = loadProjectModule('src/components/auth/client-login-form.tsx', {
      react: {
        ...React,
        useActionState: () => [{}, () => {}, false],
        useState: () => [tab, () => {}],
      },
    }).ClientLoginForm;

    const html = renderToStaticMarkup(React.createElement(ClientLoginForm, {
      locale: 'es',
      destination: '/acceso/blogger/sportmassagefuengirola',
    }));
    assert.match(
      html,
      /<input type="hidden" name="destination" value="\/acceso\/blogger\/sportmassagefuengirola"\/?>/,
    );
  });
}
