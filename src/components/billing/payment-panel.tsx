"use client";

import { useActionState } from "react";
import {
  recordBillingPaymentAction,
  reverseBillingPaymentAction,
  setBillingPaymentOptionAction,
  type BillingPaymentActionState,
} from "@/lib/actions/billing-payments";
import { madridDateInputValue } from "@/lib/billing/date";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: BillingPaymentActionState = {};
type Payment = {
  id: string;
  amount_cents: number;
  paid_on: string;
  method: string;
  reversed_at: string | null;
};
type Option = {
  method: string;
  url: string | null;
  instructions: string | null;
  active: boolean;
} | null;

export function PaymentPanel({
  documentId,
  totalCents,
  payments,
  paymentOption,
}: {
  documentId: string;
  totalCents: number;
  payments: Payment[];
  paymentOption: Option;
}) {
  const [paymentState, paymentAction, paymentPending] = useActionState(
    recordBillingPaymentAction,
    initialState,
  );
  const [optionState, optionAction, optionPending] = useActionState(
    setBillingPaymentOptionAction,
    initialState,
  );
  const paidCents = payments
    .filter((payment) => !payment.reversed_at)
    .reduce((sum, payment) => sum + payment.amount_cents, 0);
  const balanceCents = totalCents - paidCents;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-xl border border-line p-5">
        <h2 className="text-lg font-bold">Cobros</h2>
        <p className="mt-1 text-sm text-muted">
          Pendiente:{" "}
          {(balanceCents / 100).toLocaleString("es-ES", {
            style: "currency",
            currency: "EUR",
          })}
        </p>
        {payments.length ? (
          <ul className="mt-4 divide-y divide-line rounded-lg border border-line">
            {payments.map((payment) => (
              <li
                key={payment.id}
                className="flex items-center justify-between gap-3 p-3 text-sm"
              >
                <span>
                  {payment.paid_on} ·{" "}
                  {(payment.amount_cents / 100).toLocaleString("es-ES", {
                    style: "currency",
                    currency: "EUR",
                  })}{" "}
                  · {payment.method}
                </span>
                {payment.reversed_at ? (
                  <span className="text-muted">Anulado</span>
                ) : (
                  <form action={reverseBillingPaymentAction}>
                    <input type="hidden" name="payment_id" value={payment.id} />
                    <Button type="submit" variant="danger">
                      Anular
                    </Button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        ) : null}
        <form action={paymentAction} className="mt-4 grid gap-3">
          <input type="hidden" name="document_id" value={documentId} />
          <div>
            <Label htmlFor="amount_euros">Importe cobrado</Label>
            <Input
              id="amount_euros"
              name="amount_euros"
              type="number"
              min="0.01"
              max={balanceCents / 100}
              step="0.01"
              required
            />
          </div>
          <div>
            <Label htmlFor="paid_on">Fecha</Label>
            <Input
              id="paid_on"
              name="paid_on"
              type="date"
              defaultValue={madridDateInputValue()}
              required
            />
          </div>
          <div>
            <Label htmlFor="payment_method">Método</Label>
            <select
              id="payment_method"
              name="method"
              className="mt-1 w-full rounded-lg border border-line px-3 py-2"
            >
              <option value="transfer">Transferencia</option>
              <option value="cash">Efectivo</option>
              <option value="manual_link">Enlace</option>
              <option value="card">Tarjeta</option>
              <option value="other">Otro</option>
            </select>
          </div>
          <Input name="note" placeholder="Nota opcional" />
          <FormMessage
            error={paymentState.error}
            success={paymentState.success}
          />
          {paymentState.advanceInvoiceId ? (
            <a
              className="font-semibold text-brand underline"
              href={`/paneladmin/contabilidad/documentos/${paymentState.advanceInvoiceId}`}
            >
              Revisar factura de anticipo
            </a>
          ) : null}
          <Button type="submit" disabled={paymentPending || balanceCents <= 0}>
            Registrar cobro
          </Button>
        </form>
      </section>
      <section className="rounded-xl border border-line p-5">
        <h2 className="text-lg font-bold">Forma de pago visible</h2>
        <form action={optionAction} className="mt-4 grid gap-3">
          <input type="hidden" name="document_id" value={documentId} />
          <div>
            <Label htmlFor="option_method">Método</Label>
            <select
              id="option_method"
              name="method"
              defaultValue={paymentOption?.method ?? "transfer"}
              className="mt-1 w-full rounded-lg border border-line px-3 py-2"
            >
              <option value="manual_link">Enlace manual</option>
              <option value="transfer">Transferencia</option>
              <option value="cash">Efectivo</option>
            </select>
          </div>
          <div>
            <Label htmlFor="payment_url">Enlace HTTPS</Label>
            <Input
              id="payment_url"
              name="payment_url"
              type="url"
              defaultValue={paymentOption?.url ?? ""}
            />
          </div>
          <div>
            <Label htmlFor="instructions">Instrucciones</Label>
            <Input
              id="instructions"
              name="instructions"
              defaultValue={paymentOption?.instructions ?? ""}
            />
          </div>
          <div>
            <Label htmlFor="active">Estado</Label>
            <select
              id="active"
              name="active"
              defaultValue={String(paymentOption?.active ?? false)}
              className="mt-1 w-full rounded-lg border border-line px-3 py-2"
            >
              <option value="false">Oculto</option>
              <option value="true">Activo para el cliente</option>
            </select>
          </div>
          <FormMessage
            error={optionState.error}
            success={optionState.success}
          />
          <Button type="submit" disabled={optionPending}>
            Guardar forma de pago
          </Button>
        </form>
      </section>
    </div>
  );
}
