import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('admin and client project details keep distinct authorization boundaries', () => {
  assert.match(read('src/app/paneladmin/(protected)/proyectos/[id]/page.tsx'), /requireAdmin/);
  assert.match(read('src/app/cliente/(protected)/proyectos/[slug]/page.tsx'), /getAccessibleClientProject/);
  assert.doesNotMatch(read('src/app/cliente/(protected)/proyectos/[slug]/page.tsx'), /requireAdmin/);
});
