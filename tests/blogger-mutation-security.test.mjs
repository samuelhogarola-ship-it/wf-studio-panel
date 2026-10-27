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

test('accepts the public origin reported by the trusted reverse proxy', () => {
  const proxiedRequest = new Request('http://localhost:3000/api/blogger/site/posts', {
    method: 'POST',
    headers: {
      origin: 'https://admin.webfuengirola.com',
      'content-type': 'application/json; charset=utf-8',
      'x-forwarded-host': 'admin.webfuengirola.com',
      'x-forwarded-proto': 'https',
    },
  })

  assert.doesNotThrow(() => assertTrustedMutation(proxiedRequest, { requireJson: true }))
})

test('accepts branded Blogger mutations through the exact Coolify proxy host', () => {
  const proxiedRequest = new Request('http://wf-studio-panel:3000/api/posts', {
    method: 'POST',
    headers: {
      origin: 'https://blogger.sportmassagefuengirola.com',
      'content-type': 'application/json',
      'x-forwarded-host': 'blogger.sportmassagefuengirola.com',
      'x-forwarded-proto': 'https',
    },
  })
  assert.doesNotThrow(() => assertTrustedMutation(proxiedRequest, { requireJson: true }))
})

test('rejects contradictory branded proxy headers before accepting a mutation', () => {
  for (const forwardedHost of [
    'portal.webfuengirola.com',
    'blogger.sportmassagefuengirola.com, portal.webfuengirola.com',
  ]) {
    const forged = new Request('https://blogger.sportmassagefuengirola.com/api/posts', {
      method: 'POST',
      headers: {
        origin: 'https://blogger.sportmassagefuengirola.com',
        'content-type': 'application/json',
        'x-forwarded-host': forwardedHost,
        'x-forwarded-proto': 'https',
      },
    })
    assert.throws(() => assertTrustedMutation(forged, { requireJson: true }), error => error?.status === 403)
  }
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
