import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'

import {
  buildCanonicalClientCallbackUrl,
  buildCanonicalClientDestinationUrl,
  buildCanonicalClientLoginUrl,
  sanitizeClientDestination,
} from '../src/lib/security/redirects.mjs'

const obsoleteRoutePath = new URL('../src/app/acceso/blogger/[siteKey]/page.tsx', import.meta.url)

test('the obsolete direct Blogger application route does not exist', () => {
  assert.equal(existsSync(obsoleteRoutePath), false)
})

test('direct Blogger destinations fall back to the portal dashboard', () => {
  const direct = '/acceso/blogger/sportmassagefuengirola'

  assert.equal(sanitizeClientDestination(direct), '/cliente/dashboard')
  assert.equal(
    buildCanonicalClientDestinationUrl(direct).toString(),
    'https://portal.webfuengirola.com/cliente/dashboard',
  )
  assert.equal(
    buildCanonicalClientLoginUrl(direct).toString(),
    'https://portal.webfuengirola.com/cliente?redirectedFrom=%2Fcliente%2Fdashboard',
  )
  assert.equal(
    buildCanonicalClientCallbackUrl(direct).toString(),
    'https://portal.webfuengirola.com/auth/callback?next=%2Fcliente%2Fdashboard',
  )
})
