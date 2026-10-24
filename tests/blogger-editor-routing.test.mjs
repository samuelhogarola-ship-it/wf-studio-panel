import test from 'node:test'
import assert from 'node:assert/strict'

import { getBloggerEditorTarget } from '../src/lib/blogger/editor.mjs'

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
      url: 'https://admin.webfuengirola.com/acceso/blogger/sportmassagefuengirola',
    },
  }), { kind: 'iframe', href: '/blogger/index.html' })
})

test('fails closed for missing or unknown Blogger runtimes', () => {
  assert.equal(getBloggerEditorTarget({ key: 'site', blogger: { url: 'https://example.com' } }), null)
  assert.equal(getBloggerEditorTarget({ key: 'site', blogger: { runtime: 'unknown', url: 'https://example.com' } }), null)
})
