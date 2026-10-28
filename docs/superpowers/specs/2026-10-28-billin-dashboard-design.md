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

## Data and architecture

The dashboard reads the existing `invoices` and `expenses` tables through one server-only data function. It does not create new accounting records or duplicate state. Proposals are counted but excluded from invoiced and collected totals; void invoices and void expenses are excluded from financial totals. Net cash result is collected invoice value minus paid expense value. Period bounds are half-open UTC date ranges so month and quarter transitions do not double count records.

The current invoice and expense pages remain the authoring and full-history screens. The dashboard is a summary and navigation layer over those sources of truth. Expense classification labels the ledger and powers filters only; it does not create future expenses automatically.

## Non-goals

- Automatic tax filing, tax advice, bank reconciliation, automatic recurring-entry generation, recurring invoices, and external payment-provider synchronization.
- Cloud migration or remote Supabase provisioning.
- Deleting the current demo records.

