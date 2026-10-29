import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

test('client access manager chooses create/reset wording and keeps password ephemeral', () => {
  const source = readFileSync(new URL('../src/components/admin/client-access-manager.tsx', import.meta.url), 'utf8')
  assert.match(source, /Crear acceso y contraseña/)
  assert.match(source, /Generar nueva contraseña/)
  assert.match(source, /Contraseña temporal — visible una sola vez/)
  assert.match(source, />Copiar</)
  assert.match(source, /Al recargar desaparecerá/)
  assert.doesNotMatch(source, /localStorage|sessionStorage|document\.cookie|URLSearchParams/)
})
