import { z } from 'zod'

export const paymentStatusSchema = z.enum(['pending', 'paid', 'cancelled'])
export const invoiceStatusSchema = z.enum(['draft', 'issued', 'paid', 'void'])

export const stripePaymentLinkSchema = z.string().url().refine((value) => {
  const url = new URL(value)
  return url.protocol === 'https:' && ['buy.stripe.com', 'checkout.stripe.com'].includes(url.hostname)
}, 'El enlace debe ser un enlace de pago Stripe válido.')

export const registeredRecipientSchema = z.object({
  clientId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  email: z.string().email().max(320),
  company: z.string().trim().max(200).nullable().optional(),
})

export const externalRecipientSchema = z.object({
  clientId: z.null(),
  name: z.string().trim().min(1).max(200),
  email: z.string().email().max(320),
  company: z.string().trim().max(200).nullable().optional(),
})

export const recipientSnapshotSchema = z.union([registeredRecipientSchema, externalRecipientSchema])

export const invoiceDraftSchema = z.object({
  recipient: recipientSnapshotSchema,
  concept: z.string().trim().min(1).max(500),
  amount: z.number().finite().positive().max(10_000_000),
  paymentMethod: z.enum(['cash', 'card', 'transfer']),
  notes: z.string().trim().max(5000).nullable().optional(),
  issuedAt: z.string().date().optional(),
})

export function parseStripePaymentLink(value: unknown) {
  return stripePaymentLinkSchema.safeParse(value)
}
