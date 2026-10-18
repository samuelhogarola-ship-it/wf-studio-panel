import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const routes = [
  'src/app/api/posts/route.ts',
  'src/app/api/posts/[slug]/route.ts',
  'src/app/api/posts/[slug]/images/route.ts',
  'src/app/api/posts/[slug]/images/[file]/route.ts',
  'src/app/api/build/route.ts',
]

test('every legacy Sport Blogger mutation uses the shared same-origin guard', async () => {
  for (const route of routes) {
    const source = await readFile(new URL(`../${route}`, import.meta.url), 'utf8')
    assert.match(source, /assertTrustedMutation/)
    assert.match(source, /export async function (?:POST|PUT|DELETE)/)
  }
})

test('the obsolete guessed client Blogger route no longer exists', async () => {
  await assert.rejects(() => readFile(new URL('../src/app/cliente/(protected)/blogger/[siteKey]/page.tsx', import.meta.url), 'utf8'), error => error?.code === 'ENOENT')
})
