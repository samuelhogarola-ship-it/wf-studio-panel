import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { getBloggerEditorTarget } from '../src/lib/blogger/editor.mjs'

const sites = JSON.parse(readFileSync(new URL('../src/config/sites.json', import.meta.url), 'utf8'))

test('routes each Blogger runtime to its configured editor without mixing storage backends', () => {
  assert.deepEqual(getBloggerEditorTarget({ key: 'samuel', blogger: { runtime: 'central-multisite', url: 'https://admin.example/editor' } }), {
    kind: 'iframe', href: '/blogger/editor/index.html?siteKey=samuel',
  })
  assert.deepEqual(getBloggerEditorTarget({ key: 'sport', blogger: { runtime: 'central-legacy', url: 'https://sport.example/admin/blogger/' } }), {
    kind: 'iframe', href: '/blogger/index.html',
  })
  assert.deepEqual(getBloggerEditorTarget({ key: 'external', blogger: { runtime: 'external', url: 'https://external.example/admin/blogger/' } }), {
    kind: 'external', href: 'https://external.example/admin/blogger/',
  })
})

test('Sport Massage central access always resolves to the legacy Studio editor', () => {
  assert.deepEqual(getBloggerEditorTarget({
    key: 'sportmassagefuengirola',
    blogger: {
      enabled: true,
      runtime: 'central-legacy',
      url: 'https://sportmassagefuengirola.com/admin/blogger/',
    },
  }), { kind: 'iframe', href: '/blogger/index.html' })
})

test('Sport Massage registry describes only its direct URL without handoff metadata', () => {
  const site = sites.find(candidate => candidate.key === 'sportmassagefuengirola')

  assert.equal(site.blogger.url, 'https://sportmassagefuengirola.com/admin/blogger/')
  for (const key of ['launchUrl', 'healthUrl', 'adapter', 'capabilities']) {
    assert.equal(Object.hasOwn(site.blogger, key), false, key)
  }
})

test('fails closed for missing or unknown Blogger runtimes', () => {
  assert.equal(getBloggerEditorTarget({ key: 'site', blogger: { url: 'https://example.com' } }), null)
  assert.equal(getBloggerEditorTarget({ key: 'site', blogger: { runtime: 'unknown', url: 'https://example.com' } }), null)
})
