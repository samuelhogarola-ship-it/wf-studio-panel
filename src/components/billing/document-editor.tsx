"use client";

import { useActionState, useMemo, useState } from "react";

import { calculateDocument } from "@/lib/billing/calculations";
import { madridDateInputValue } from "@/lib/billing/date";
import {
  saveBillingDocumentAction,
  type BillingDocumentActionState,
} from "@/lib/actions/billing-documents";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Product = {
  id: string;
  name: string;
  description: string | null;
  default_net_cents: number | null;
  tax_mode: string;
  tax_rate_bps: number;
  active: boolean;
};
type Client = {
  id: string;
  name: string;
  email: string;
  company: string | null;
  status: string;
};
type EditableLine = {
  productId: string | null;
  productName: string | null;
  description: string;
  quantity: number;
  unitNetCents: number;
  taxMode: "taxable" | "exempt" | "non_taxable";
  taxRateBps: number;
};
const initialState: BillingDocumentActionState = {};
const blankLine = (): EditableLine => ({
  productId: null,
  productName: null,
  description: "",
  quantity: 1,
  unitNetCents: 0,
  taxMode: "taxable",
  taxRateBps: 2100,
});
const money = (cents: number) =>
  (cents / 100).toLocaleString("es-ES", { style: "currency", currency: "EUR" });

export function DocumentEditor({
  products,
  clients,
}: {
  products: Product[];
  clients: Client[];
}) {
  const [state, action, pending] = useActionState(
    saveBillingDocumentAction,
    initialState,
  );
  const [lines, setLines] = useState<EditableLine[]>([blankLine()]);
  const totals = useMemo(() => {
    try {
      return calculateDocument(lines);
    } catch {
      return { netCents: 0, taxCents: 0, totalCents: 0 };
    }
  }, [lines]);
  const updateLine = (index: number, change: Partial<EditableLine>) =>
    setLines((current) =>
      current.map((line, itemIndex) =>
        itemIndex === index ? { ...line, ...change } : line,
      ),
    );
  const chooseProduct = (index: number, productId: string) => {
    const product = products.find((item) => item.id === productId);
    if (!product)
      return updateLine(index, { productId: null, productName: null });
    updateLine(index, {
      productId: product.id,
      productName: product.name,
      description: product.description || product.name,
      unitNetCents: product.default_net_cents ?? 0,
      taxMode: product.tax_mode as EditableLine["taxMode"],
      taxRateBps: product.tax_rate_bps,
    });
  };
  const addLine = () => setLines((current) => [...current, blankLine()]);
  return (
    <Card className="p-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-brand">
        Nuevo documento
      </p>
      <h2 className="mt-2 text-xl font-bold">Propuesta o factura</h2>
      <form action={action} className="mt-5 grid gap-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <Label htmlFor="document_type">Tipo</Label>
            <select
              id="document_type"
              name="document_type"
              className="mt-1 w-full rounded-lg border border-line px-3 py-2"
            >
              <option value="proposal">Propuesta</option>
              <option value="invoice">Factura</option>
            </select>
          </div>
          <div>
            <Label htmlFor="document_date">Fecha</Label>
            <Input
              id="document_date"
              name="document_date"
              type="date"
              defaultValue={madridDateInputValue()}
              required
            />
          </div>
          <div>
            <Label htmlFor="due_date">Vencimiento</Label>
            <Input id="due_date" name="due_date" type="date" />
          </div>
        </div>
        <div>
          <Label htmlFor="client_id">Cliente del panel</Label>
          <select
            id="client_id"
            name="client_id"
            className="mt-1 w-full rounded-lg border border-line px-3 py-2"
          >
            <option value="">Destinatario externo</option>
            {clients
              .filter((client) => client.status === "active")
              .map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name} · {client.email}
                </option>
              ))}
          </select>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <Label htmlFor="recipient_name">Nombre externo</Label>
            <Input id="recipient_name" name="recipient_name" />
          </div>
          <div>
            <Label htmlFor="recipient_email">Email externo</Label>
            <Input id="recipient_email" name="recipient_email" type="email" />
          </div>
          <div>
            <Label htmlFor="recipient_company">Empresa</Label>
            <Input id="recipient_company" name="recipient_company" />
          </div>
        </div>
        <div>
          <Label htmlFor="title">Título o concepto general</Label>
          <Input
            id="title"
            name="title"
            placeholder="Propuesta web profesional"
            required
          />
        </div>
        <div className="grid gap-3">
          {lines.map((line, index) => (
            <div
              key={index}
              className="grid gap-3 rounded-xl border border-line p-4 lg:grid-cols-12"
            >
              <div className="lg:col-span-3">
                <Label htmlFor={`product-${index}`}>Producto</Label>
                <select
                  id={`product-${index}`}
                  value={line.productId ?? ""}
                  onChange={(event) => chooseProduct(index, event.target.value)}
                  className="mt-1 w-full rounded-lg border border-line px-3 py-2"
                >
                  <option value="">Personalizado</option>
                  {products
                    .filter((product) => product.active)
                    .map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="lg:col-span-4">
                <Label htmlFor={`description-${index}`}>Concepto</Label>
                <Input
                  id={`description-${index}`}
                  value={line.description}
                  onChange={(event) =>
                    updateLine(index, { description: event.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor={`quantity-${index}`}>Cantidad</Label>
                <Input
                  id={`quantity-${index}`}
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={line.quantity}
                  onChange={(event) =>
                    updateLine(index, { quantity: Number(event.target.value) })
                  }
                />
              </div>
              <div className="lg:col-span-2">
                <Label htmlFor={`price-${index}`}>Precio sin IVA</Label>
                <Input
                  id={`price-${index}`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.unitNetCents / 100}
                  onChange={(event) =>
                    updateLine(index, {
                      unitNetCents: Math.round(
                        Number(event.target.value) * 100,
                      ),
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor={`tax-${index}`}>IVA %</Label>
                <Input
                  id={`tax-${index}`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.taxRateBps / 100}
                  onChange={(event) =>
                    updateLine(index, {
                      taxRateBps: Math.round(Number(event.target.value) * 100),
                      taxMode:
                        Number(event.target.value) === 0 ? "exempt" : "taxable",
                    })
                  }
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    setLines((current) =>
                      current.length === 1
                        ? current
                        : current.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                >
                  Quitar
                </Button>
              </div>
            </div>
          ))}
        </div>
        <Button type="button" variant="secondary" onClick={addLine}>
          Añadir línea
        </Button>
        <input type="hidden" name="lines_json" value={JSON.stringify(lines)} />
        <input type="hidden" name="notes" value="" />
        <div className="grid grid-cols-3 gap-3 rounded-xl bg-slate-50 p-4 text-right">
          <div>
            <p className="text-xs text-muted">Base</p>
            <p className="font-bold">{money(totals.netCents)}</p>
          </div>
          <div>
            <p className="text-xs text-muted">IVA</p>
            <p className="font-bold">{money(totals.taxCents)}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Total</p>
            <p className="text-xl font-black">{money(totals.totalCents)}</p>
          </div>
        </div>
        <FormMessage error={state.error} success={state.success} />
        {state.documentId ? (
          <a
            href={`/paneladmin/contabilidad/documentos/${state.documentId}`}
            className="font-semibold text-brand underline"
          >
            Abrir borrador
          </a>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar borrador"}
        </Button>
      </form>
    </Card>
  );
}
