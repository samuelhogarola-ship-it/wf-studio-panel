import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { loadProjectModule } from './helpers/project-harness.mjs'

async function renderHome(counts) {
  const Page = loadProjectModule('src/app/paneladmin/(protected)/inicio/page.tsx', {
    '@/lib/auth': { requireAdmin: async () => ({ userId: 'admin-id', email: 'admin@example.com' }) },
    '@/lib/data/projects': { getAdminFavoriteProjects: async () => [] },
    '@/lib/data/admin': { getRecentClientAccessEvents: async () => [] },
    '@/lib/platform-requests/admin': { getPendingPlatformRequestCounts: async () => counts },
    '@/components/admin/client-access-notifications': { ClientAccessNotifications: () => null },
    '@/components/admin/favorite-project-card': { FavoriteProjectCard: () => null },
  }).default
  return renderToStaticMarkup(await Page())
}

test('Inicio hides request notices when every platform inbox is empty', async () => {
  const html = await renderHome({
    'vivir-fuengirola': 0,
    'vivir-fuengirola-negocios': 0,
    'conoce-fuengirola': 0,
  })
  assert.doesNotMatch(html, /Solicitudes nuevas/)
  assert.doesNotMatch(html, /Revisar solicitudes de/)
})

test('Inicio shows three independent notices with exact inbox links', async () => {
  const html = await renderHome({
    'vivir-fuengirola': 2,
    'vivir-fuengirola-negocios': 3,
    'conoce-fuengirola': 4,
  })
  assert.match(html, /Solicitudes nuevas/)
  for (const [label, count, href] of [
    ['Vivir · clientes', '2', '/paneladmin/vivir-en-fuengirola/solicitudes?scope=clients'],
    ['Vivir · negocios', '3', '/paneladmin/vivir-en-fuengirola/solicitudes?scope=businesses'],
    ['Conoce Fuengirola', '4', '/paneladmin/conoce-fuengirola/solicitudes'],
  ]) {
    assert.match(html, new RegExp(label))
    assert.match(html, new RegExp(`>${count}<`))
    assert.match(html, new RegExp(`href="${href.replaceAll('?', '\\?')}"`))
  }
})

test('Claude integration contract is self-contained and contains no private credential', async () => {
  const source = await readFile(new URL('../docs/integrations/platform-requests-api.md', import.meta.url), 'utf8').catch((error) => {
    assert.fail(`platform request integration contract must exist (${error.code})`)
  })
  for (const value of [
    'POST /api/platform-requests',
    'GET /api/platform-requests/config',
    'https://vivirenfuengirola.com',
    'https://www.vivirenfuengirola.com',
    'https://conocefuengirola.com',
    'https://www.conocefuengirola.com',
    'vivir-fuengirola-negocios',
    'subscription_interest',
    'sourceUrl',
    'turnstile-token',
    '201',
    'outcome',
    'curl',
    'WF Panel debe desplegarse antes',
  ]) assert.ok(source.includes(value), `missing integration detail: ${value}`)
  assert.doesNotMatch(source, /SUPABASE_(?:SECRET|SERVICE_ROLE)|private-secret|service_role\s*key/i)
})
