import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createContactRateLimiter,
  getTurnstileConfig,
} from '../src/lib/contact-protection.mjs'

test('disables Turnstile unless both public and secret keys exist', () => {
  assert.deepEqual(getTurnstileConfig({}), {
    enabled: false,
    siteKey: '',
    secretKey: '',
  })
  assert.equal(
    getTurnstileConfig({ NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'public' }).enabled,
    false,
  )
  assert.deepEqual(
    getTurnstileConfig({
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'public',
      TURNSTILE_SECRET_KEY: 'secret',
    }),
    { enabled: true, siteKey: 'public', secretKey: 'secret' },
  )
})

test('limits repeated contact requests and resets after the window', () => {
  let now = 1_000
  const limiter = createContactRateLimiter({
    limit: 2,
    windowMs: 60_000,
    now: () => now,
  })

  assert.equal(limiter.allow('203.0.113.1'), true)
  assert.equal(limiter.allow('203.0.113.1'), true)
  assert.equal(limiter.allow('203.0.113.1'), false)
  assert.equal(limiter.allow('203.0.113.2'), true)

  now += 60_001
  assert.equal(limiter.allow('203.0.113.1'), true)
})
