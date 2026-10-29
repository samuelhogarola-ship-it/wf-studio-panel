import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { loadProjectModule } from './helpers/project-harness.mjs'

const shellProps = {
  title: 'Clientes', description: 'Gestiona el CRM.', currentPath: '/paneladmin/clientes',
  userEmail: 'admin@example.com', locale: 'es', children: React.createElement('div', null, 'Contenido'),
}

test('AdminShell keeps its standard H1 when no custom header is supplied', () => {
  const { AdminShell } = loadProjectModule('src/components/layout/app-shell.tsx', {
    '@/lib/i18n': { t: (_locale, key) => key },
  })
  const html = renderToStaticMarkup(React.createElement(AdminShell, shellProps))
  assert.match(html, /<h1[^>]*>Clientes<\/h1>/)
  assert.match(html, />Gestiona el CRM\.</)
})

test('AdminShell custom header replaces only the standard page heading region', () => {
  const { AdminShell } = loadProjectModule('src/components/layout/app-shell.tsx', {
    '@/lib/i18n': { t: (_locale, key) => key },
  })
  const customHeader = React.createElement('section', { 'data-custom-header': 'yes' }, React.createElement('h1', null, 'Cabecera propia'))
  const html = renderToStaticMarkup(React.createElement(AdminShell, { ...shellProps, header: customHeader }))
  assert.match(html, /data-custom-header="yes"/)
  assert.match(html, /<h1>Cabecera propia<\/h1>/)
  assert.doesNotMatch(html, /<h1[^>]*>Clientes<\/h1>/)
  assert.match(html, /Contenido/)
})

test('Bill-in header has one accessible title and a decorative native mark', () => {
  const { BillinPageHeader } = loadProjectModule('src/components/admin/billin-page-header.tsx')
  const html = renderToStaticMarkup(React.createElement(BillinPageHeader))
  assert.equal((html.match(/<h1[ >]/g) ?? []).length, 1)
  assert.match(html, /<h1[^>]*>Bill-in<\/h1>/)
  assert.match(html, /Facturación y contabilidad del estudio en un solo lugar\./)
  assert.match(html, /<svg[^>]*aria-hidden="true"/)
  assert.match(html, /data-billin-header="true"/)
})
