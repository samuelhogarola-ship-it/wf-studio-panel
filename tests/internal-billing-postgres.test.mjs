import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

test('internal billing database behavior can run against the support database', { skip: !process.env.WF_SUPPORT_TEST_DATABASE_URL }, async () => {
  assert.ok(process.env.WF_SUPPORT_TEST_DATABASE_URL)
})

test('deleting a catalogue product clears only its reference on an issued line', { skip: !process.env.WF_SUPPORT_TEST_DATABASE_URL }, async () => {
  const { Client } = await import('pg')
  const database = new Client({ connectionString: process.env.WF_SUPPORT_TEST_DATABASE_URL })
  const productId = randomUUID()
  const documentId = randomUUID()
  await database.connect()
  try {
    await database.query('insert into public.billing_products(id, name, default_net_cents) values ($1, $2, 25000)', [productId, `Producto ${productId}`])
    await database.query(`
      insert into public.billing_documents(
        id, document_type, status, recipient_name, recipient_email, title,
        document_date, net_cents, tax_cents, total_cents
      ) values ($1, 'invoice', 'draft', 'Cliente', 'cliente@example.test', 'Web a medida', current_date, 25000, 5250, 30250)
    `, [documentId])
    await database.query(`
      insert into public.billing_document_lines(
        document_id, product_id, product_name, description, quantity, unit_net_cents,
        tax_mode, tax_rate_bps, net_cents, tax_cents, total_cents
      ) values ($1, $2, $3, 'Instantánea histórica', 1, 25000, 'taxable', 2100, 25000, 5250, 30250)
    `, [documentId, productId, `Producto ${productId}`])
    await database.query("update public.billing_documents set status = 'issued' where id = $1", [documentId])

    await database.query('delete from public.billing_products where id = $1', [productId])
    const line = (await database.query(`
      select product_id, product_name, description, net_cents, tax_cents, total_cents
      from public.billing_document_lines where document_id = $1
    `, [documentId])).rows[0]
    assert.deepEqual(line, {
      product_id: null,
      product_name: `Producto ${productId}`,
      description: 'Instantánea histórica',
      net_cents: '25000',
      tax_cents: '5250',
      total_cents: '30250',
    })
  } finally {
    await database.end()
  }
})
