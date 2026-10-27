"use client";

import { useActionState } from "react";
import {
  createIncomeAction,
  type LedgerIncomeActionState,
} from "@/lib/actions/ledger-income";
import { madridDateInputValue } from "@/lib/billing/date";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function IncomeForm() {
  const [state, action, pending] = useActionState(
    createIncomeAction,
    {} as LedgerIncomeActionState,
  );
  return (
    <section className="rounded-2xl border border-line bg-white p-6">
      <h2 className="text-xl font-bold">Registrar ingreso</h2>
      <p className="mt-1 text-sm text-muted">
        Las clases pueden marcarse exentas de IVA. Los totales mensuales
        directos se muestran aparte para no duplicar ingresos.
      </p>
      <form action={action} className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="income_category">Categoría</Label>
          <Input
            id="income_category"
            name="category"
            defaultValue="Clases"
            required
          />
        </div>
        <div>
          <Label htmlFor="income_mode">Tipo de registro</Label>
          <select
            id="income_mode"
            name="source_mode"
            className="mt-1 w-full rounded-lg border border-line px-3 py-2"
          >
            <option value="individual">Registro individual</option>
            <option value="monthly_summary">Total mensual directo</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="income_description">Concepto</Label>
          <Input id="income_description" name="description" required />
        </div>
        <div>
          <Label htmlFor="income_date">Fecha</Label>
          <Input
            id="income_date"
            name="occurred_on"
            type="date"
            defaultValue={madridDateInputValue()}
            required
          />
        </div>
        <div>
          <Label htmlFor="income_net">Importe base</Label>
          <Input
            id="income_net"
            name="net_euros"
            type="number"
            min="0.01"
            step="0.01"
            required
          />
        </div>
        <div>
          <Label htmlFor="income_tax_mode">IVA</Label>
          <select
            id="income_tax_mode"
            name="tax_mode"
            defaultValue="exempt"
            className="mt-1 w-full rounded-lg border border-line px-3 py-2"
          >
            <option value="exempt">Exento</option>
            <option value="taxable">Con IVA</option>
            <option value="non_taxable">No sujeto</option>
          </select>
        </div>
        <div>
          <Label htmlFor="income_tax_rate">Tipo de IVA (%)</Label>
          <Input
            id="income_tax_rate"
            name="tax_rate"
            type="number"
            min="0"
            max="100"
            step="0.01"
            defaultValue="21"
          />
        </div>
        <div className="sm:col-span-2">
          <FormMessage error={state.error} success={state.success} />
          <Button type="submit" disabled={pending}>
            Guardar ingreso
          </Button>
        </div>
      </form>
    </section>
  );
}
