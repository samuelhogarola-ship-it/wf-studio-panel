// @ts-nocheck -- this isolated fixture owns a separate @/ alias root.
import { selectedFixtureAction } from '@/lib/actions/server-all'
import { jsFixtureAction } from '@/lib/actions/runtime.js'
import { jsxFixtureAction } from '@/lib/actions/runtime-view.js'
import { mtsFixtureAction } from '@/lib/actions/runtime-module.mjs'
import { ctsFixtureAction } from '@/lib/actions/runtime-common.cjs'
import { fixtureActions } from '@/lib/actions/namespace'
import { escapedFixtureAction } from '../../outside-source-action'

const postMethod = 'POST'
const postUrl = '/api/fixture/const-options'
const postOptions = { method: postMethod }
const method = 'PATCH'
const patchOptions = { method }
const patchUrl = '/api/fixture/shorthand-options'
const deleteMethod = 'DELETE'
const deleteUrl = '/api/fixture/global-fetch'
const computedMethodKey = 'method'
const formMethod = 'PUT'
const formAction = '/api/fixture/const-form'

declare function runtimeMethod(): string
declare function runtimeUrl(): string
declare function runtimeOptions(): RequestInit

window.fetch(postUrl, postOptions)
globalThis.fetch(patchUrl, patchOptions)
global.fetch(deleteUrl, { method: deleteMethod })
fetch('/api/fixture/dynamic-method', { method: runtimeMethod() })
fetch('/api/fixture/computed-method', { [computedMethodKey]: runtimeMethod() })
window.fetch(runtimeUrl(), { method: 'POST' })
globalThis.fetch('/api/fixture/dynamic-options', runtimeOptions())

export function AdversarialFixture() {
  void selectedFixtureAction
  void jsFixtureAction
  void jsxFixtureAction
  void mtsFixtureAction
  void ctsFixtureAction
  void fixtureActions
  void escapedFixtureAction
  return <button formAction={formAction} formMethod={formMethod}>Run const form route</button>
}
