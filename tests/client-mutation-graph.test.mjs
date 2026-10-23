import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { inventoryClientMutations } from './helpers/client-mutation-graph.mjs'

test('client mutation graph follows aliases, re-exports, dynamic imports and cycles by module plus export', () => {
  const inventory = inventoryClientMutations({
    projectRoot: 'tests/fixtures/client-mutation-graph',
    sourceRoot: 'src',
    entryDir: 'src/app/cliente',
  })

  assert.deepEqual(inventory.actions.map(action => action.id), [
    'src/lib/actions/barrel.ts#barrelFixtureAction',
    'src/lib/actions/default.ts#default',
    'src/lib/actions/dynamic.ts#dynamicFixtureAction',
    'src/lib/actions/namespace-target.ts#namespaceFixtureAction',
    'src/lib/actions/runtime-common.cts#ctsFixtureAction',
    'src/lib/actions/runtime-module.mts#mtsFixtureAction',
    'src/lib/actions/runtime-view.tsx#jsxFixtureAction',
    'src/lib/actions/runtime.ts#jsFixtureAction',
    'src/lib/actions/server-all.ts#default',
    'src/lib/actions/server-all.ts#reexportedFixtureAction',
    'src/lib/actions/server-all.ts#selectedFixtureAction',
    'src/lib/actions/server-all.ts#siblingFixtureAction',
    'src/lib/actions/server-all.ts#starFixtureAction',
    'src/lib/actions/unclassified.ts#unclassifiedFixtureAction',
  ])
  assert.equal(inventory.files.filter(file => file.endsWith('/cycle-a.ts')).length, 1)
  assert.equal(inventory.files.filter(file => file.endsWith('/cycle-b.ts')).length, 1)
})

test('client mutation graph never follows normalized, realpath or node_modules escapes from sourceRoot', () => {
  const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), 'client-mutation-graph-'))
  try {
    const sourceRoot = path.join(temporaryRoot, 'src')
    mkdirSync(path.join(sourceRoot, 'app', 'cliente'), { recursive: true })
    mkdirSync(path.join(sourceRoot, 'links'), { recursive: true })
    mkdirSync(path.join(sourceRoot, 'vendor', 'node_modules'), { recursive: true })
    writeFileSync(path.join(temporaryRoot, 'outside.ts'), "'use server'\nexport async function outsideAction() {}\n")
    writeFileSync(path.join(sourceRoot, 'vendor', 'node_modules', 'hidden.ts'), "'use server'\nexport async function hiddenAction() {}\n")
    symlinkSync(path.join(temporaryRoot, 'outside.ts'), path.join(sourceRoot, 'links', 'outside.ts'))
    writeFileSync(path.join(sourceRoot, 'app', 'cliente', 'page.ts'), [
      "import { outsideAction } from '../../../outside'",
      "import { outsideAction as linkedOutsideAction } from '../../links/outside'",
      "import { hiddenAction } from '../../vendor/node_modules/hidden'",
    ].join('\n'))

    const inventory = inventoryClientMutations({ projectRoot: temporaryRoot })

    assert.deepEqual(inventory.actions, [])
    assert.deepEqual(inventory.files, ['src/app/cliente/page.ts'])
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true })
  }
})

test('client mutation graph finds mutation routes independent of JSX attribute order and formatting', () => {
  const inventory = inventoryClientMutations({
    projectRoot: 'tests/fixtures/client-mutation-graph',
    sourceRoot: 'src',
    entryDir: 'src/app/cliente',
  })

  assert.deepEqual(inventory.routes.map(route => route.id), [
    'DELETE /api/fixture/global-fetch',
    'DELETE /api/fixture/new/asset',
    'PATCH /api/fixture/alternate',
    'PATCH /api/fixture/shorthand-options',
    'POST /api/fixture/const-options',
    'POST /api/fixture/new',
    'POST /api/fixture/static-template',
    'PUT /api/fixture/const-form',
  ])
  assert.deepEqual(inventory.dynamicMutations.map(surface => surface.reason).sort(), [
    'method',
    'method',
    'method',
    'options',
    'url',
    'url',
  ])
})
