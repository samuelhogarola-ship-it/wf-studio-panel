import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

const actionUrl = new URL('../src/lib/actions/fichero-admin.ts', import.meta.url)

test('every Fichero mutation is admin-derived and server-validates canonical input', async () => {
  const source = await readFile(actionUrl, 'utf8')
  for (const action of ['saveDirectoryProfileAction', 'reviewDirectoryProfileAction', 'retryDirectoryProfileChannelAction']) {
    const body = source.match(new RegExp(`export async function ${action}\\([\\s\\S]*?\\n}`, 'm'))?.[0] ?? ''
    assert.match(body, /await requireAdmin\(\)/, `${action} must authenticate before mutation`)
  }
  assert.match(source, /parseDirectoryProfileInput/)
  assert.match(source, /findDirectoryProfileDuplicates/)
  assert.match(source, /review_directory_profile/)
  assert.match(source, /confirm_publish/)
  assert.match(source, /La nota es obligatoria/)
  assert.match(source, /publishApprovedProfile/)
  assert.match(source, /retryProfileChannel/)
})

test('Fichero routes live only below the protected admin layout', async () => {
  const pages = [
    'fichero/page.tsx', 'fichero/[catalogKey]/page.tsx', 'fichero/[catalogKey]/solicitudes/page.tsx',
    'fichero/[catalogKey]/fichas/page.tsx', 'fichero/[catalogKey]/fichas/nueva/page.tsx',
    'fichero/[catalogKey]/fichas/[profileId]/page.tsx', 'fichero/[catalogKey]/publicaciones/page.tsx',
  ]
  for (const page of pages) {
    const url = new URL(`../src/app/paneladmin/(protected)/${page}`, import.meta.url)
    const source = await readFile(url, 'utf8')
    assert.match(source, /requireAdmin\(\)/)
  }
})

test('list query supports server pagination and canonical business filters', async () => {
  const source = await readFile(new URL('../src/lib/fichero/admin.ts', import.meta.url), 'utf8')
  assert.match(source, /\.range\(/)
  assert.match(source, /display_name/)
  assert.match(source, /legal_name/)
  assert.match(source, /canonical_slug/)
  assert.match(source, /contact_email/)
  assert.match(source, /cif/)
  assert.match(source, /review_status/)
  assert.match(source, /last_publication_status/)
})
