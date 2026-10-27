import { z } from 'zod'

export const taxModeSchema = z.enum(['taxable', 'exempt', 'non_taxable'])
export const paymentMethodSchema = z.enum(['manual_link', 'transfer', 'cash', 'card', 'other'])

const cents = z.number().int().min(0).max(1_000_000_000)
const positiveCents = cents.min(1)
const taxRateBps = z.number().int().min(0).max(10_000)

export const billingProductInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2_000).nullable().optional(),
  defaultNetCents: positiveCents.nullable(),
  taxMode: taxModeSchema.default('taxable'),
  taxRateBps: taxRateBps.default(2_100),
  active: z.boolean().default(true),
})

export const billingLineInputSchema = z.object({
  productId: z.string().uuid().nullable().optional(),
  productName: z.string().trim().max(200).nullable().optional(),
  description: z.string().trim().min(1).max(1_000),
  quantity: z.number().finite().positive().max(10_000).refine(value => Number.isInteger(value * 1_000), 'La cantidad admite como máximo tres decimales.'),
  unitNetCents: cents,
  taxMode: taxModeSchema,
  taxRateBps,
})

export const billingPaymentInputSchema = z.object({
  amountCents: positiveCents,
  paidOn: z.string().date(),
  method: paymentMethodSchema,
  note: z.string().trim().max(1_000).nullable().optional(),
})

export const ledgerIncomeInputSchema = z.object({
  category: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(1_000),
  occurredOn: z.string().date(),
  sourceMode: z.enum(['individual', 'monthly_summary']),
  netCents: positiveCents,
  taxMode: taxModeSchema,
  taxRateBps,
})

export const ledgerExpenseInputSchema = z.object({
  supplierName: z.string().trim().min(1).max(200),
  supplierTaxId: z.string().trim().max(40).nullable().optional(),
  invoiceReference: z.string().trim().max(120).nullable().optional(),
  category: z.string().trim().min(1).max(120),
  occurredOn: z.string().date(),
  netCents: cents,
  taxRateBps,
  taxCents: cents,
  deductibleTaxCents: cents,
  totalCents: positiveCents,
  paymentMethod: paymentMethodSchema,
  notes: z.string().trim().max(2_000).nullable().optional(),
}).superRefine((value, context) => {
  if (value.deductibleTaxCents > value.taxCents) {
    context.addIssue({ code: 'custom', path: ['deductibleTaxCents'], message: 'El IVA deducible no puede superar el IVA soportado.' })
  }
  if (value.netCents + value.taxCents !== value.totalCents) {
    context.addIssue({ code: 'custom', path: ['totalCents'], message: 'El total no coincide con base más IVA.' })
  }
})
