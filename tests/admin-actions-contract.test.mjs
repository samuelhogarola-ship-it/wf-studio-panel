import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const adminSource = read('src/lib/actions/admin.ts');

test('admin compatibility barrel keeps every public action', () => {
  for (const name of [
    'upsertClientAction', 'approveClientAction', 'rejectClientAction', 'deactivateClientAction', 'createClientDirectAction',
    'upsertPackAction', 'sendPackStartedEmailAction', 'togglePackPaidAction', 'togglePackStatusAction',
    'createActivityAction', 'upsertServiceAction', 'createPendingItemAction', 'togglePendingItemStatusAction',
    'deletePendingItemAction', 'sendAdminClientMessageAction',
  ]) assert.match(adminSource, new RegExp(`export async function ${name}\\b`), name);
});

test('domain action modules expose the same functions without changing their server boundary', async () => {
  const domains = {
    clients: ['upsertClientAction', 'approveClientAction', 'rejectClientAction', 'deactivateClientAction', 'createClientDirectAction', 'sendAdminClientMessageAction'],
    projects: ['createActivityAction'],
    services: ['upsertServiceAction'],
    packs: ['upsertPackAction', 'sendPackStartedEmailAction', 'togglePackPaidAction', 'togglePackStatusAction'],
    pending: ['createPendingItemAction', 'togglePendingItemStatusAction', 'deletePendingItemAction'],
  };
  for (const [domain, names] of Object.entries(domains)) {
    const source = read(`src/lib/actions/admin/${domain}.ts`);
    for (const name of names) assert.match(source, new RegExp(`export (?:async )?\\{[^}]*\\b${name}\\b`), `${domain}.${name}`);
  }
});
