import test from 'node:test'
import assert from 'node:assert/strict'

import { assertTrustedMutation } from '../src/lib/security/mutations.mjs'

const request = ({ origin = 'https://admin.webfuengirola.com', contentType = 'application/json; charset=utf-8' } = {}) =>
  new Request('https://admin.webfuengirola.com/api/blogger/site/posts', {
    method: 'POST',
    headers: { origin, 'content-type': contentType },
  })

test('accepts exact same-origin JSON mutations', () => {
  assert.doesNotThrow(() => assertTrustedMutation(request(), { requireJson: true }))
})

test('rejects absent, foreign and lookalike origins', () => {
  for (const origin of [undefined, 'https://evil.example', 'https://admin.webfuengirola.com.evil.example']) {
    const headers = origin ? { origin, 'content-type': 'application/json' } : { 'content-type': 'application/json' }
    assert.throws(
      () => assertTrustedMutation(new Request('https://admin.webfuengirola.com/api/blogger/site/posts', { method: 'POST', headers }), { requireJson: true }),
      error => error?.status === 403,
    )
  }
})

test('requires JSON only for mutations that consume a JSON body', () => {
  assert.throws(() => assertTrustedMutation(request({ contentType: 'text/plain' }), { requireJson: true }), error => error?.status === 415)
  assert.doesNotThrow(() => assertTrustedMutation(request({ contentType: 'text/plain' })))
})
