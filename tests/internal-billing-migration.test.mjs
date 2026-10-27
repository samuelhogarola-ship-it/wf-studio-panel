import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migrationUrl = new URL('../supabase/migrations/202610270001_internal_billing_workspace.sql', import.meta.url)

test('catalogue supports persistent editable products with nullable defaults', async () => {
  const sql = await readFile(migrationUrl, 'utf8')
  assert.match(sql, /create table public\.billing_products/i)
  assert.match(sql, /default_net_cents bigint/i)
  assert.match(sql, /insert into public\.billing_products[\s\S]*Web Lite[\s\S]*Web Express[\s\S]*Web Profesional/i)
  assert.match(sql, /65000/)
  assert.match(sql, /save_billing_product/i)
  assert.match(sql, /delete_billing_product/i)
})

test('documents use separate proposal and invoice sequences and immutable line snapshots', async () => {
  const sql = await readFile(migrationUrl, 'utf8')
  assert.match(sql, /create table public\.billing_documents/i)
  assert.match(sql, /document_type in \('proposal', 'invoice', 'advance_invoice'\)/i)
  assert.match(sql, /create table public\.billing_document_lines/i)
  assert.match(sql, /product_name text/i)
  assert.match(sql, /create table public\.billing_number_sequences/i)
  assert.match(sql, /'PROP-'|'PROP' \|\|/i)
  assert.match(sql, /'WF-'|'WF' \|\|/i)
})

test('draft save derives totals from line snapshots and issue consumes the final number', async () => {
  const sql = await readFile(migrationUrl, 'utf8')
  assert.match(sql, /create or replace function public\.save_billing_document_draft/i)
  assert.match(sql, /jsonb_array_elements\(p_lines\)/i)
  assert.match(sql, /sum\(net_cents\).*sum\(tax_cents\).*sum\(total_cents\)/is)
  assert.match(sql, /create or replace function public\.issue_billing_document/i)
  assert.match(sql, /for update/i)
  assert.match(sql, /billing_number_sequences/i)
  assert.match(sql, /status = 'issued'/i)
})

test('catalogue and document mutations are admin-only while clients can read their issued snapshots', async () => {
  const sql = await readFile(migrationUrl, 'utf8')
  assert.match(sql, /private\.is_admin\(\)/i)
  assert.match(sql, /alter table public\.billing_products enable row level security/i)
  assert.match(sql, /alter table public\.billing_documents enable row level security/i)
  assert.match(sql, /client_id = private\.current_portal_client_id\(\).*status in \('issued', 'paid'\)/is)
})
