import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('project and client repositories bound list reads with stable ordering', () => {
  const projects = read('src/lib/data/projects.ts');
  const client = read('src/lib/data/client.ts');
  assert.match(projects, /from\('client_projects'\)\.select\('\*'\)\.order\('name'\)[\s\S]{0,120}\.limit\(/);
  assert.match(projects, /from\('clients'\)\.select\([^)]*\)\.eq\('project', 'wf-studio'\)\.order\('name'\)[\s\S]{0,80}\.limit\(/);
  for (const table of ['pending_items', 'invoices', 'messages']) {
    assert.match(client, new RegExp(`from\\('${table}'\\)[\\s\\S]{0,500}\\.limit\\(`), table);
  }
});

test('project detail pages share the canonical identity presentation', () => {
  assert.match(read('src/app/paneladmin/(protected)/proyectos/[id]/page.tsx'), /ProjectIdentity/);
  assert.match(read('src/app/cliente/(protected)/proyectos/[slug]/page.tsx'), /ProjectIdentity/);
  assert.match(read('src/components/projects/project-detail.tsx'), /export function ProjectIdentity/);
});
