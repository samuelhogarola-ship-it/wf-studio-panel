import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadProjectModule, database, boundary, form, projectId } from './helpers/project-harness.mjs';

const paths = [
  ['/paneladmin/inicio'],
  ['/paneladmin/proyectos'],
  [`/paneladmin/proyectos/${projectId}`],
];

function setup(seed = {}, extra = {}, failures = {}) {
  const db = database(seed, failures);
  const revalidated = [];
  const b = boundary(db, { 'next/cache': { revalidatePath: (...args) => revalidated.push(args) }, ...extra });
  return {
    db,
    events: b.events,
    revalidated,
    actions: () => loadProjectModule('src/lib/actions/project-favorites.ts', b.mocks),
  };
}

test('favorite mutation authenticates before validation or opening the session database', async () => {
  const s = setup({}, { '@/lib/auth': { requireAdmin: async () => { throw new Error('Denied'); } } });

  await assert.rejects(() => s.actions().setProjectFavoriteAction({}, form({})), /Denied/);

  assert.deepEqual(s.events, []);
  assert.deepEqual(s.db.calls, []);
});

test('adding a favorite upserts only the current administrator preference and revalidates every consumer', async () => {
  const s = setup({ admin_project_favorites: [{ admin_user_id: 'another-admin', project_id: projectId, position: 3, created_at: '2026-10-01T00:00:00Z' }] });

  const result = await s.actions().setProjectFavoriteAction({}, form({ project_id: projectId, favorite: 'true' }));

  assert.ok(result.success);
  assert.deepEqual(s.events, ['admin', 'session-db']);
  const call = s.db.calls.find(item => item.operation === 'upsert');
  assert.equal(call.table, 'admin_project_favorites');
  assert.deepEqual(call.payload, { admin_user_id: 'admin-id', project_id: projectId });
  assert.equal(call.conflict, 'admin_user_id,project_id');
  assert.deepEqual(s.db.tables.admin_project_favorites.map(row => row.admin_user_id).sort(), ['admin-id', 'another-admin']);
  assert.deepEqual(s.revalidated, paths);
});

test('removing a favorite deletes only the current administrator preference and revalidates every consumer', async () => {
  const s = setup({ admin_project_favorites: [
    { admin_user_id: 'admin-id', project_id: projectId, position: null, created_at: '2026-10-01T00:00:00Z' },
    { admin_user_id: 'another-admin', project_id: projectId, position: null, created_at: '2026-10-01T00:00:00Z' },
  ] });

  const result = await s.actions().setProjectFavoriteAction({}, form({ project_id: projectId, favorite: 'false' }));

  assert.ok(result.success);
  assert.deepEqual(s.db.tables.admin_project_favorites.map(row => row.admin_user_id), ['another-admin']);
  const call = s.db.calls.find(item => item.operation === 'delete');
  assert.equal(call.table, 'admin_project_favorites');
  assert.equal(call.filters.length, 2);
  assert.deepEqual(s.revalidated, paths);
});

test('invalid requests and failed writes never claim success or invalidate pages', async () => {
  for (const [input, failures] of [[{ project_id: 'invalid', favorite: 'true' }, {}], [{ project_id: projectId, favorite: 'true' }, { admin_project_favorites: 'write rejected' }]]) {
    const s = setup({}, {}, failures);
    const result = await s.actions().setProjectFavoriteAction({}, form(input));
    assert.ok(result.error);
    assert.equal(result.success, undefined);
    assert.deepEqual(s.revalidated, []);
  }
});

test('favorite form renders server-derived labels, pending state and an announced error', () => {
  const render = ({ isFavorite, state = {}, pending = false }) => {
    const b = boundary(database(), {
      react: { ...React, useActionState: () => [state, () => {}, pending] },
    });
    const { ProjectFavoriteForm } = loadProjectModule('src/components/admin/project-favorite-form.tsx', b.mocks);
    return renderToStaticMarkup(React.createElement(ProjectFavoriteForm, { projectId, isFavorite }));
  };

  const add = render({ isFavorite: false });
  assert.match(add, /Añadir a Inicio/);
  assert.match(add, /name="favorite" value="true"/);
  const remove = render({ isFavorite: true });
  assert.match(remove, /Quitar de Inicio/);
  assert.match(remove, /name="favorite" value="false"/);
  const pending = render({ isFavorite: false, pending: true });
  assert.match(pending, /disabled=""/);
  assert.match(pending, /Guardando…/);
  const failed = render({ isFavorite: false, state: { error: 'No se pudo guardar.' } });
  assert.match(failed, /role="alert"/);
  assert.match(failed, /No se pudo guardar\./);
});
