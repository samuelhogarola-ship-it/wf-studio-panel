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

test('password login redirects to the sanitized client destination', async () => {
  const { actions, passwordCalls } = loadAuthActions();

  await assert.rejects(
    () => actions.clientPasswordLoginAction({}, form({
      email: client.email,
      password: 'secret-password',
      destination: '/acceso/blogger/sportmassagefuengirola',
    })),
    { message: 'redirect:/acceso/blogger/sportmassagefuengirola' },
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
    { message: 'redirect:/cliente/dashboard' },
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
      emailRedirectTo: 'https://portal.webfuengirola.com/auth/callback?next=%2Facceso%2Fblogger%2Fsportmassagefuengirola',
    },
  }]);
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

for (const [requested, expected] of [
  ['/acceso/blogger/sportmassagefuengirola', '/acceso/blogger/sportmassagefuengirola'],
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
