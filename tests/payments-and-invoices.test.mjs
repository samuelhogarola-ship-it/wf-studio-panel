import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { loadProjectModule } from './helpers/project-harness.mjs'

const schema = loadProjectModule('src/lib/payments/schema.ts')

test('payment schema supports registered and external recipients', () => {
 assert.equal(schema.recipientSnapshotSchema.safeParse({ clientId: '11111111-1111-4111-8111-111111111111', name: 'Ana', email: 'ana@example.com' }).success, true)
 assert.equal(schema.recipientSnapshotSchema.safeParse({ clientId: null, name: 'Proveedor', email: 'billing@example.com' }).success, true)
 assert.equal(schema.recipientSnapshotSchema.safeParse({ clientId: null, name: 'x', email: 'not-an-email' }).success, false)
})

test('Stripe payment links require HTTPS and approved Stripe hosts', () => {
 assert.equal(schema.parseStripePaymentLink('https://buy.stripe.com/test_123').success, true)
 assert.equal(schema.parseStripePaymentLink('http://buy.stripe.com/test_123').success, false)
 assert.equal(schema.parseStripePaymentLink('https://evil.example/stripe').success, false)
})

test('invoice lifecycle and immutable audit model are represented in the migration', async () => {
 const sql = await readFile(new URL('../supabase/migrations/202610240002_payments_and_invoices.sql', import.meta.url), 'utf8')
 assert.match(sql, /status in \('draft', 'issued', 'paid', 'void'\)/i)
 assert.match(sql, /recipient_name text not null/i)
 assert.match(sql, /client_id uuid references public\.clients/i)
 assert.match(sql, /create table if not exists public\.invoice_audit/i)
 assert.match(sql, /create trigger invoices_append_audit/i)
 assert.match(sql, /before delete on public\.invoices/i)
 assert.match(sql, /old\.status = 'draft' and new\.status = 'issued'/i)
 assert.match(sql, /old\.status = 'issued' and new\.status in \('paid', 'void'\)/i)
 assert.match(sql, /create unique index .*payment_links_invoice_unique/i)
})

test('invoice numbering and payment-link association are atomic RPCs', async () => {
 const sql = await readFile(new URL('../supabase/migrations/202610240002_payments_and_invoices.sql', import.meta.url), 'utf8')
 assert.match(sql, /create table if not exists public\.invoice_number_sequences/i)
 assert.match(sql, /for update/i)
 assert.match(sql, /create or replace function public\.issue_invoice_with_payment_link/i)
 assert.match(sql, /insert into public\.payment_links/i)
 assert.match(sql, /raise exception/i)
})

test('invoice actions do not expose physical deletion and validate links server-side', async () => {
 const source = await readFile(new URL('../src/lib/actions/invoices.ts', import.meta.url), 'utf8')
 const payments = await readFile(new URL('../src/lib/actions/payments.ts', import.meta.url), 'utf8')
 assert.doesNotMatch(source, /\.delete\(\)/i)
 assert.match(source, /create_invoice|next_invoice_number/i)
 assert.match(payments, /parseStripePaymentLink/i)
 assert.match(payments, /requireAdmin/i)
})

test('client payment reads are scoped to the authenticated portal client', async () => {
 const source = await readFile(new URL('../src/lib/data/payments.ts', import.meta.url), 'utf8')
 assert.match(source, /requirePortalViewer/i)
 assert.match(source, /client_id.*viewer\.client\.id|eq\(['"]client_id['"], viewer\.client\.id\)/is)
 assert.doesNotMatch(source, /getSupabaseAdminClient/i)
})
