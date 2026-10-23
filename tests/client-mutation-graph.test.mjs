import test from 'node:test'
import assert from 'node:assert/strict'

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
    'src/lib/actions/unclassified.ts#unclassifiedFixtureAction',
  ])
  assert.equal(inventory.files.filter(file => file.endsWith('/cycle-a.ts')).length, 1)
  assert.equal(inventory.files.filter(file => file.endsWith('/cycle-b.ts')).length, 1)
})

test('client mutation graph finds mutation routes independent of JSX attribute order and formatting', () => {
  const inventory = inventoryClientMutations({
    projectRoot: 'tests/fixtures/client-mutation-graph',
    sourceRoot: 'src',
    entryDir: 'src/app/cliente',
  })

  assert.deepEqual(inventory.routes.map(route => route.id), [
    'DELETE /api/fixture/[fixtureId]/asset',
    'PATCH /api/fixture/alternate',
    'POST /api/fixture/[fixtureId]',
  ])
})
