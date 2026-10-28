# Bill-in Dashboard Design

## Objective

Turn Bill-in into a first-class module in the administrator panel instead of leaving invoices and expenses as isolated navigation entries.

## User experience

- Add `/paneladmin/billin` as the Bill-in home.
- Add a `Resumen` entry at the top of the Bill-in sidebar group.
- Show four historical totals: invoiced, collected, expenses, and net cash result.
- Split the accounting summary between `General` and `Clases` so class activity remains independently visible.
- Show document counts for invoices, proposals, pending invoices, and expenses.
- Provide direct actions to create a document or register an expense.
- Show recent invoices/proposals and recent expenses with links to their existing full histories.
- Make the invoice/proposal history filterable by month, document type, status, and accounting area, and show the filtered document count and amount.
- Show the current month's invoiced, collected, spent, and net totals by default, with month navigation.
- Add a quarterly preparation view that selects a year and quarter, separates General and Clases, and produces a printable/exportable ledger summary.
- Classify every expense as `Fijo`, `Recurrente variable`, or `Único`; existing expenses default to `Único`.
- Empty ledgers render zero values and useful calls to action, never errors.
- Use a compact, full-width accounting layout: one activity summary table and one unified movement ledger instead of sparse split cards.
- Store administrator-managed Bill-in accounts (bank, Stripe, cash, or other) in Supabase and allow each invoice or expense to select the account receiving or paying the money.
- Make General and Clases expandable to show collected income, paid expenses, and net cash movement per account; historical unassigned entries remain visible under `Sin cuenta asignada`.

## Data and architecture

The dashboard reads `invoices`, `expenses`, and the small `billing_accounts` catalog through server-only data functions. It does not duplicate ledger state. Proposals and drafts are excluded from invoiced and collected totals; void invoices and void expenses are excluded from financial totals. Invoicing is attributed by `issued_at`, while collections are attributed by `paid_at`; net cash result is collected invoice value minus paid expense value. Period bounds are half-open UTC date ranges so month and quarter transitions do not double count records. Financial reads paginate beyond Supabase's default 1,000-row response limit, and CSV exports neutralize spreadsheet-formula prefixes in text cells.

The current invoice and expense pages remain the authoring and full-history screens. The dashboard is a summary and navigation layer over those sources of truth. Expense classification labels the ledger and powers filters only; it does not create future expenses automatically. Account assignment is nullable for backward compatibility, and accounts are soft-disabled rather than deleted so historical ledger relations remain intact.

## Non-goals

- Automatic tax filing, tax advice, bank reconciliation, automatic recurring-entry generation, recurring invoices, and external payment-provider synchronization.
- Cloud migration or remote Supabase provisioning.
- Deleting the current demo records.
