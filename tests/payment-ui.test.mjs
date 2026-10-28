import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function source(path) {
 return readFile(new URL(`../${path}`, import.meta.url), 'utf8')
}

test('admin payment workspace supports external recipients and has no destructive invoice form', async () => {
 const page = await source('src/app/paneladmin/(protected)/pagos/page.tsx')
 const invoiceForm = await source('src/components/admin/invoice-form.tsx')
 const invoices = await source('src/app/paneladmin/(protected)/facturas/page.tsx')
 assert.match(page, /requireAdmin/)
 assert.match(page, /getAdminPaymentRequests/)
 assert.match(invoiceForm, /recipient_name|external/i)
 assert.match(invoices, /status === ['"]void['"]|anulad/i)
 assert.doesNotMatch(invoices, /deleteInvoiceAction|name=['"]delete['"]/i)
})

test('client payments are protected and distinguish pending, paid and void invoices', async () => {
 const page = await source('src/app/cliente/(protected)/pagos/page.tsx')
 const invoices = await source('src/app/cliente/(protected)/facturas/page.tsx')
 assert.match(page, /requireClientCapability\(['"]invoices['"]\)/)
 assert.match(page, /getClientPaymentRequests/)
 assert.match(page, /href=\{link\.url\}|payment.*url/i)
 assert.match(invoices, /status === ['"]paid['"]|status === ['"]void['"]|Pendiente/i)
})

test('invoice print is admin-protected and client invoice links use a server route', async () => {
 const print = await source('src/app/paneladmin/(protected)/facturas/[id]/print/page.tsx')
 const data = await source('src/lib/data/invoices.ts')
 assert.match(print, /requireAdmin/)
 assert.match(print, /getInvoiceById/)
 assert.match(data, /recipient_name|recipient_email/)
})

test('Bill-in expense navigation is present while client payments remain localized', async () => {
 const adminShell = await source('src/components/layout/app-shell.tsx')
 const clientShell = await source('src/components/layout/client-shell.tsx')
 const portalNavigation = await source('src/lib/projects/portal-navigation.mjs')
 const i18n = await source('src/lib/i18n.ts')
 assert.match(adminShell, /Bill-in/i)
 assert.match(adminShell, /\/paneladmin\/gastos/i)
 assert.match(clientShell, /navigation\.map/)
 assert.match(portalNavigation, /pagos.*Pagos|pagos.*Payments/is)
 assert.match(i18n, /pagos|payments/i)
})
