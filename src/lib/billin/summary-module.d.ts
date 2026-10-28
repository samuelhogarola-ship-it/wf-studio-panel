declare module '@/lib/billin/summary.mjs' {
  export type BillinAreaSummary = {
    invoiced: number
    collected: number
    expenses: number
    net: number
  }

  export type BillinSummary = {
    totals: BillinAreaSummary
    counts: { invoices: number; proposals: number; pendingInvoices: number; expenses: number }
    areas: { general: BillinAreaSummary; classes: BillinAreaSummary }
  }

  export function summarizeBillin(input?: {
    invoices?: Array<{ amount: number | string; status: string; document_type: string; accounting_area: string }>
    expenses?: Array<{ amount: number | string; status: string; accounting_area: string }>
  }): BillinSummary
}
