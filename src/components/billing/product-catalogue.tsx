'use client'

import { useActionState } from 'react'

import { deleteBillingProductAction, saveBillingProductAction, type BillingDocumentActionState } from '@/lib/actions/billing-documents'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FormMessage } from '@/components/ui/form-message'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Product = { id: string; name: string; description: string | null; default_net_cents: number | null; tax_mode: string; tax_rate_bps: number; active: boolean; sort_order: number }
const initialState: BillingDocumentActionState = {}

function ProductForm({ product }: { product?: Product }) {
  const [state, action, pending] = useActionState(saveBillingProductAction, initialState)
  return <form action={action} className="grid gap-3 rounded-xl border border-line p-4 md:grid-cols-6">
    <input type="hidden" name="id" value={product?.id ?? ''} />
    <div className="md:col-span-2"><Label htmlFor={`name-${product?.id ?? 'new'}`}>Nombre</Label><Input id={`name-${product?.id ?? 'new'}`} name="name" defaultValue={product?.name ?? ''} required /></div>
    <div><Label htmlFor={`price-${product?.id ?? 'new'}`}>Precio base</Label><Input id={`price-${product?.id ?? 'new'}`} name="default_price" type="number" min="0.01" step="0.01" defaultValue={product?.default_net_cents == null ? '' : product.default_net_cents / 100} /></div>
    <div><Label htmlFor={`tax-${product?.id ?? 'new'}`}>IVA %</Label><Input id={`tax-${product?.id ?? 'new'}`} name="tax_rate" type="number" min="0" step="0.01" defaultValue={(product?.tax_rate_bps ?? 2100) / 100} /></div>
    <div><Label htmlFor={`mode-${product?.id ?? 'new'}`}>Tratamiento</Label><select id={`mode-${product?.id ?? 'new'}`} name="tax_mode" defaultValue={product?.tax_mode ?? 'taxable'} className="mt-1 w-full rounded-lg border border-line px-3 py-2"><option value="taxable">Con IVA</option><option value="exempt">Exento</option><option value="non_taxable">No sujeto</option></select></div>
    <input type="hidden" name="active" value={String(product?.active ?? true)} /><input type="hidden" name="sort_order" value={product?.sort_order ?? 0} />
    <div className="flex items-end"><Button type="submit" disabled={pending}>{pending ? 'Guardando…' : product ? 'Guardar' : 'Añadir'}</Button></div>
    <div className="md:col-span-6"><Label htmlFor={`description-${product?.id ?? 'new'}`}>Descripción predeterminada</Label><Input id={`description-${product?.id ?? 'new'}`} name="description" defaultValue={product?.description ?? ''} /></div>
    <div className="md:col-span-6"><FormMessage error={state.error} success={state.success} /></div>
  </form>
}

export function ProductCatalogue({ products }: { products: Product[] }) {
  return <Card className="p-6"><h2 className="text-xl font-bold">Productos y precios</h2><p className="mt-1 text-sm text-muted">Los cambios se conservan para las próximas sesiones; los documentos anteriores mantienen su copia.</p><div className="mt-5 grid gap-4"><ProductForm />{products.map(product => <div key={product.id}><ProductForm product={product} /><form action={deleteBillingProductAction} className="mt-2 text-right"><input type="hidden" name="id" value={product.id} /><Button type="submit" variant="danger">Borrar</Button></form></div>)}</div></Card>
}
