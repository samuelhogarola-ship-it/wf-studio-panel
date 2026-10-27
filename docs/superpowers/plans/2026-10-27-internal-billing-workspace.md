# Internal Billing Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an internal WF Studio workspace for proposals, invoices, collections, class income, expenses, attachments, client visibility, temporary shares and gestoría exports.

**Architecture:** Extend the existing Next.js/Supabase invoice foundation with normalized document lines, a persistent product catalogue and a simple ledger. Keep all mutations behind authenticated server actions/RPCs, expose clients through existing RLS, and expose temporary shares only through a hashed seven-day token route.

**Tech Stack:** Next.js 15, React 19, TypeScript, Zod, Supabase/PostgreSQL/Storage, Node test runner.

**Spec:** `docs/superpowers/specs/2026-10-27-internal-billing-workspace-design.md`

## Global Constraints

- This is an internal organiser and document generator; do not add AEAT, SII or VERI*FACTU communication.
- Store document and money snapshots so later catalogue edits do not rewrite history.
- Default to 21% VAT but support exempt and custom tax treatments.
- Temporary public links expire after seven days and reveal one document only.
- Payment links are manually supplied HTTPS URLs; no provider SDK or webhook.
- Use test-first development for every behavior change.

## Review Focus

- Rounding across multiple lines must equal displayed and stored totals; Task 1 tests cent-level rounding.
- Partial payments must never produce a negative balance; Task 3 tests overpayment rejection.
- Expired, revoked and cross-document share tokens must reveal nothing; Task 5 tests all three states.
- Manual monthly income must not be silently added to the individual subtotal; Task 6 tests separated totals.
- Invalid or oversized private attachments must be rejected and never exposed publicly; Task 7 tests policy and validation.

---

### Task 1: Billing calculations and validation contracts

**Files:**
- Create: `src/lib/billing/calculations.ts`
- Create: `src/lib/billing/schema.ts`
- Test: `tests/billing-domain.test.mjs`

**Interfaces:**
- Produces: `calculateLine(input): BillingLineAmounts`, `calculateDocument(lines): BillingTotals`, `remainingBalance(totalCents, paymentsCents): number`, and Zod schemas for product, document line, payment, income and expense input.

- [ ] Write failing tests for 650 EUR at 21%, 200 EUR deposit, 450 EUR remaining, exempt income, multiple-line rounding and overpayment rejection.
- [ ] Run `node --test tests/billing-domain.test.mjs` and confirm failure because billing modules do not exist.
- [ ] Implement integer-cent calculations and Zod input contracts.
- [ ] Run the focused test and then `npm test`; require all tests to pass.
- [ ] Commit the domain layer.

### Task 2: Persistent catalogue and document database

**Files:**
- Create: `supabase/migrations/202610270001_internal_billing_workspace.sql`
- Modify: `src/lib/supabase/types.ts`
- Test: `tests/internal-billing-migration.test.mjs`
- Test: `tests/internal-billing-postgres.test.mjs`

**Interfaces:**
- Produces tables `billing_products`, `billing_documents`, `billing_document_lines`, yearly sequences and admin RPCs `save_billing_product`, `save_billing_document_draft`, and `issue_billing_document`.

- [ ] Write failing static and PostgreSQL tests for catalogue persistence, nullable default prices, separate `PROP`/`WF` sequences, snapshot lines, total derivation and admin-only mutation.
- [ ] Run the focused tests and confirm schema/RPC failures.
- [ ] Add the migration, RLS, constraints, RPCs and generated TypeScript table types.
- [ ] Run focused tests and the full suite.
- [ ] Commit catalogue and document storage.

### Task 3: Collections, advance invoices and payment activation

**Files:**
- Extend: `supabase/migrations/202610270001_internal_billing_workspace.sql`
- Create: `src/lib/actions/billing-payments.ts`
- Create: `src/lib/data/billing-payments.ts`
- Test: `tests/billing-payments.test.mjs`
- Test: `tests/internal-billing-postgres.test.mjs`

**Interfaces:**
- Produces tables `billing_payments`, `billing_payment_options`; RPCs `record_billing_payment`, `reverse_billing_payment`, `set_billing_payment_option`; action `recordBillingPaymentAction` returning an optional advance-invoice draft id.

- [ ] Write failing tests for multiple payments, overpayment rejection, manual HTTPS link/transfer/cash activation and a 200 EUR + VAT proposal deposit creating one linked advance invoice draft.
- [ ] Run focused tests and confirm missing behavior.
- [ ] Implement storage, RPCs, server actions and data readers.
- [ ] Run focused tests and the full suite.
- [ ] Commit collections and advance invoices.

### Task 4: Admin document and catalogue workspace

**Files:**
- Create: `src/app/paneladmin/(protected)/contabilidad/page.tsx`
- Create: `src/app/paneladmin/(protected)/contabilidad/productos/page.tsx`
- Create: `src/app/paneladmin/(protected)/contabilidad/documentos/[id]/page.tsx`
- Create: `src/components/billing/product-catalogue.tsx`
- Create: `src/components/billing/document-editor.tsx`
- Create: `src/components/billing/payment-panel.tsx`
- Create: `src/lib/actions/billing-documents.ts`
- Create: `src/lib/data/billing-documents.ts`
- Modify: `src/components/layout/app-shell.tsx`
- Modify: `src/lib/i18n.ts`
- Test: `tests/billing-admin-ui.test.mjs`

**Interfaces:**
- Consumes Tasks 1-3 schemas/RPCs.
- Produces admin routes and forms for persistent catalogue CRUD, proposal/invoice drafts, issue, PDF/print, payment activation and payment recording.

- [ ] Write failing UI contract tests for catalogue persistence controls, editable snapshots, separate document types, totals and payment panel.
- [ ] Run the focused UI test and confirm route/component failures.
- [ ] Implement the smallest accessible admin workspace using existing UI primitives and server actions.
- [ ] Run focused tests, `npm run typecheck`, `npm run lint` and the full suite.
- [ ] Commit the admin workspace.

### Task 5: Client portal and seven-day private shares

**Files:**
- Extend: `supabase/migrations/202610270001_internal_billing_workspace.sql`
- Create: `src/app/d/[token]/page.tsx`
- Create: `src/lib/billing/share-token.ts`
- Create: `src/lib/actions/billing-shares.ts`
- Create: `src/lib/data/billing-shares.ts`
- Modify: `src/app/cliente/(protected)/facturas/page.tsx`
- Modify: `src/app/cliente/(protected)/pagos/page.tsx`
- Test: `tests/billing-share-links.test.mjs`
- Test: `tests/internal-billing-postgres.test.mjs`

**Interfaces:**
- Produces `billing_share_links`, `createBillingShareAction`, `revokeBillingShareAction`, and server-only `getSharedBillingDocument(rawToken)`.

- [ ] Write failing tests for hashed tokens, seven-day expiry, revocation, paid-document closure, one-document scope and registered-client RLS.
- [ ] Run focused tests and confirm missing behavior.
- [ ] Implement share storage/RPCs, public read-only route and client portal document/balance display.
- [ ] Run focused tests, typecheck, lint and full suite.
- [ ] Commit client and temporary access.

### Task 6: Income ledger and period summaries

**Files:**
- Extend: `supabase/migrations/202610270001_internal_billing_workspace.sql`
- Create: `src/lib/actions/ledger-income.ts`
- Create: `src/lib/data/ledger.ts`
- Create: `src/components/billing/income-form.tsx`
- Modify: `src/app/paneladmin/(protected)/contabilidad/page.tsx`
- Test: `tests/ledger-income.test.mjs`

**Interfaces:**
- Produces `ledger_income`, `createIncomeAction`, and `getLedgerSummary({ from, to })` with separate `individualTotal` and `manualSummaryTotal` fields.

- [ ] Write failing tests for exempt class income, 21% web income, individual monthly aggregation and separately labelled manual monthly totals.
- [ ] Run focused tests and confirm missing behavior.
- [ ] Implement income storage, validation, actions, summary query and UI.
- [ ] Run focused tests, typecheck, lint and full suite.
- [ ] Commit income tracking.

### Task 7: Expenses and private attachments

**Files:**
- Extend: `supabase/migrations/202610270001_internal_billing_workspace.sql`
- Create: `src/lib/actions/ledger-expenses.ts`
- Create: `src/lib/data/expense-attachments.ts`
- Create: `src/app/api/expense-attachments/[id]/route.ts`
- Create: `src/components/billing/expense-form.tsx`
- Modify: `src/app/paneladmin/(protected)/contabilidad/page.tsx`
- Test: `tests/ledger-expenses.test.mjs`

**Interfaces:**
- Produces `ledger_expenses`, `ledger_expense_attachments`, private bucket policies, `createExpenseAction`, and admin-only attachment download.

- [ ] Write failing tests for supplier/tax fields, deductible amount, PDF/JPEG/PNG/WebP validation, size rejection and admin-only retrieval.
- [ ] Run focused tests and confirm missing behavior.
- [ ] Implement expense storage, private uploads/downloads and admin UI.
- [ ] Run focused tests, typecheck, lint and full suite.
- [ ] Commit expenses and attachments.

### Task 8: Gestoría dashboard, CSV export and final verification

**Files:**
- Create: `src/app/api/contabilidad/export/route.ts`
- Create: `src/lib/billing/csv.ts`
- Create: `src/components/billing/period-summary.tsx`
- Modify: `src/app/paneladmin/(protected)/contabilidad/page.tsx`
- Modify: `README.md`
- Test: `tests/billing-export.test.mjs`

**Interfaces:**
- Consumes Tasks 2-7 data readers.
- Produces filtered month/quarter/year dashboard and authenticated CSV exports for documents, payments, income and expenses.

- [ ] Write failing tests for Spanish-compatible CSV quoting/decimal output, period boundaries and required columns.
- [ ] Run focused tests and confirm missing export behavior.
- [ ] Implement summary cards, category breakdown, filters and export route.
- [ ] Run `npm test`, `npm run typecheck`, `npm run lint` and `npm run build` and record exact results.
- [ ] Review the full branch diff for secrets, unintended files, access leaks and compatibility with existing invoice/payment pages.
- [ ] Commit documentation and exports.

