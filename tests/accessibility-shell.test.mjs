import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('shared shells expose skip links, labelled navigation and current-page state', () => {
  for (const path of ['src/components/layout/app-shell.tsx', 'src/components/layout/client-shell.tsx']) {
    const source = read(path);
    assert.match(source, /href="#main-content"/);
    assert.match(source, /id="main-content"/);
    assert.match(source, /aria-label=/);
    assert.match(source, /aria-current=/);
    assert.match(source, /focus-visible:outline/);
  }
});

test('form feedback is announced and client fields have explicit labels', () => {
  assert.match(read('src/components/ui/form-message.tsx'), /aria-live/);
  assert.match(read('src/components/ui/form-message.tsx'), /role=/);
  for (const path of ['src/components/client/request-form.tsx', 'src/components/client/message-composer.tsx']) {
    const source = read(path);
    assert.match(source, /htmlFor=/);
    assert.match(source, /id=/);
  }
});

test('protected routes include loading, error and not-found boundaries', () => {
  for (const path of [
    'src/app/paneladmin/(protected)/loading.tsx',
    'src/app/paneladmin/(protected)/error.tsx',
    'src/app/cliente/(protected)/loading.tsx',
    'src/app/cliente/(protected)/error.tsx',
    'src/app/not-found.tsx',
  ]) assert.ok(read(path).length > 0, `missing ${path}`);
  assert.match(read('src/app/paneladmin/(protected)/error.tsx'), /reset/);
  assert.match(read('src/app/cliente/(protected)/error.tsx'), /reset/);
});

test('Samuel Coach premium is inside the standard admin shell and destructive action is confirmed accessibly', () => {
  const source = read('src/app/paneladmin/(protected)/samuel-coach/premium/page.tsx');
  assert.match(source, /AdminShell/);
  assert.match(source, /role="alert"|aria-live=/);
  assert.match(source, /confirm\(/);
});

test('accessibility boundary copy exists in both supported locales', () => {
  const source = read('src/lib/i18n.ts');
  for (const key of ['accessibility.skipToContent', 'boundary.loading', 'boundary.retry', 'boundary.notFound']) {
    assert.equal(source.match(new RegExp(`['"]${key.replace('.', '\\.') }['"]`, 'g'))?.length, 2, key);
  }
});
