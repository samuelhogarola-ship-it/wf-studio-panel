"use client";

import { useActionState } from "react";
import {
  createExpenseAction,
  type LedgerExpenseActionState,
} from "@/lib/actions/ledger-expenses";
import { madridDateInputValue } from "@/lib/billing/date";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ExpenseForm() {
  const [state, action, pending] = useActionState(
    createExpenseAction,
    {} as LedgerExpenseActionState,
  );
  return (
    <section className="rounded-2xl border border-line bg-white p-6">
      <h2 className="text-xl font-bold">Registrar gasto</h2>
      <p className="mt-1 text-sm text-muted">
        Guarda proveedor, importes y justificante privado.
      </p>
      <form action={action} className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="supplier_name">Proveedor</Label>
          <Input id="supplier_name" name="supplier_name" required />
        </div>
        <div>
          <Label htmlFor="supplier_tax_id">NIF/CIF</Label>
          <Input id="supplier_tax_id" name="supplier_tax_id" />
        </div>
        <div>
          <Label htmlFor="invoice_reference">Nº factura</Label>
          <Input id="invoice_reference" name="invoice_reference" />
        </div>
        <div>
          <Label htmlFor="expense_category">Categoría</Label>
          <Input id="expense_category" name="category" required />
        </div>
        <div>
          <Label htmlFor="expense_date">Fecha</Label>
          <Input
            id="expense_date"
            name="occurred_on"
            type="date"
            defaultValue={madridDateInputValue()}
            required
          />
        </div>
        <div>
          <Label htmlFor="expense_method">Método</Label>
          <select
            id="expense_method"
            name="payment_method"
            className="mt-1 w-full rounded-lg border border-line px-3 py-2"
          >
            <option value="transfer">Transferencia</option>
            <option value="card">Tarjeta</option>
            <option value="cash">Efectivo</option>
            <option value="other">Otro</option>
          </select>
        </div>
        <div>
          <Label htmlFor="expense_net">Base (€)</Label>
          <Input
            id="expense_net"
            name="net_euros"
            type="number"
            min="0"
            step="0.01"
            required
          />
        </div>
        <div>
          <Label htmlFor="expense_tax_rate">IVA (%)</Label>
          <Input
            id="expense_tax_rate"
            name="tax_rate"
            type="number"
            min="0"
            max="100"
            step="0.01"
            defaultValue="21"
            required
          />
        </div>
        <div>
          <Label htmlFor="expense_tax">IVA soportado (€)</Label>
          <Input
            id="expense_tax"
            name="tax_euros"
            type="number"
            min="0"
            step="0.01"
            required
          />
        </div>
        <div>
          <Label htmlFor="expense_deductible">IVA deducible (€)</Label>
          <Input
            id="expense_deductible"
            name="deductible_tax_euros"
            type="number"
            min="0"
            step="0.01"
            required
          />
        </div>
        <div>
          <Label htmlFor="expense_total">Total (€)</Label>
          <Input
            id="expense_total"
            name="total_euros"
            type="number"
            min="0.01"
            step="0.01"
            required
          />
        </div>
        <div>
          <Label htmlFor="expense_attachment">Justificante</Label>
          <Input
            id="expense_attachment"
            name="attachment"
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="expense_notes">Notas</Label>
          <Input id="expense_notes" name="notes" />
        </div>
        <div className="sm:col-span-2">
          <FormMessage error={state.error} success={state.success} />
          <Button type="submit" disabled={pending}>
            Guardar gasto
          </Button>
        </div>
      </form>
    </section>
  );
}
