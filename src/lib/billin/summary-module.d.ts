declare module '@/lib/billin/summary.mjs' {
  export type BillinAreaSummary = {
    invoiced: number
    collected: number
    pending: number
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
    collections?: Array<{ amount: number | string; status: string; document_type: string; accounting_area: string }>
    expenses?: Array<{ amount: number | string; status: string; accounting_area: string }>
  }): BillinSummary
  export type BillinAccountSummary = { id: string | null; name: string; collected: number; expenses: number; net: number }
  export function summarizeAccounts(input?: {
    accounts?: Array<{ id: string; name: string }>
    invoices?: Array<{ amount: number | string; status: string; document_type: string; accounting_area: string; billing_account_id?: string | null }>
    collections?: Array<{ amount: number | string; status: string; document_type: string; accounting_area: string; billing_account_id?: string | null }>
    expenses?: Array<{ amount: number | string; status: string; accounting_area: string; billing_account_id?: string | null }>
  }): { general: BillinAccountSummary[]; classes: BillinAccountSummary[] }
}
