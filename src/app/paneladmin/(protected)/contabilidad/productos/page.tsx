import { ProductCatalogue } from '@/components/billing/product-catalogue'
import { AdminShell } from '@/components/layout/app-shell'
import { requireAdmin } from '@/lib/auth'
import { getBillingWorkspaceData } from '@/lib/data/billing-documents'
import { getLocale } from '@/lib/locale'

export default async function BillingProductsPage() {
  const [identity, data, locale] = await Promise.all([requireAdmin(), getBillingWorkspaceData(), getLocale()])
  return <AdminShell title="Productos de facturación" description="Nombres, conceptos, precios e IVA predeterminados." currentPath="/paneladmin/contabilidad" userEmail={identity.email} locale={locale}><ProductCatalogue products={data.products} /></AdminShell>
}
