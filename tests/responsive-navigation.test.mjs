import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('admin and client mobile navigation remains keyboard reachable and horizontally usable', () => {
  for (const path of ['src/components/layout/app-shell.tsx', 'src/components/layout/client-shell.tsx']) {
    const source = read(path);
    assert.match(source, /lg:hidden/);
    assert.match(source, /overflow-x-auto/);
    assert.match(source, /aria-label=/);
    assert.match(source, /focus-visible:outline/);
  }
});

test('navigation links are not hidden from small viewport users', () => {
  for (const path of ['src/components/layout/app-shell.tsx', 'src/components/layout/client-shell.tsx']) {
    const source = read(path);
    assert.doesNotMatch(source, /lg:hidden[^\n]*>[\s\S]{0,80}hidden/);
  }
});
