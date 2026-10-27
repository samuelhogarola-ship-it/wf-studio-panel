# Legacy Final Invoices Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import the existing final invoices into the new accounting workspace once, preserving their verified fiscal snapshots and making uncertain historical tax splits explicit.

**Architecture:** A forward-only Supabase migration adds provenance and review metadata to `billing_documents`, copies every legacy `invoices` row as an `invoice`, and creates one matching line and any known payment without touching the source row. It then reconciles the three locally verified final invoices idempotently: preserves Gimnasio and SuVilla by exact reference and creates Bionatura as a new final invoice because its local source is only a proposal. A unique legacy ID makes source imports idempotent; the accounting detail screen and CSV expose whether any other historical tax split still needs review.

**Tech Stack:** PostgreSQL/Supabase migrations and RLS, Next.js 15, TypeScript, React, Node test runner.

**Spec:** `docs/superpowers/specs/2026-10-27-legacy-final-invoices-import-design.md`

## Global Constraints

- Import final invoices only; never create proposals from legacy data.
- Preserve source invoice number, client link, recipient snapshot (including CIF text), concept, date, status, payment method, notes and amount.
- Do not modify or delete `public.invoices`.
- Do not invent a tax classification for an ambiguous historical total.
- SuVilla `WF-2026-002` uses the verified split: net 65000 cents, tax 13650 cents, total 78650 cents, paid 78650 cents and balance 0 cents.
- Gimnasio Nuevo Estilo `WF-2026-001` uses CIF `J29227907`, date `2026-07-20`, net 20000 cents, tax 4200 cents and total 24200 cents.
- Bionatura del Sur SL uses CIF `B92371301`, net 20000 cents, tax 4200 cents and total 24200 cents; its local proposal is evidence for a newly created final invoice, never a proposal import.
- All three reconciled final invoices must be `paid` with one idempotent payment covering their full total and a zero balance.
- Re-running the migration must not duplicate documents, lines or payments.

## Review Focus

- A legacy invoice whose number already exists in the new module must be linked or skipped safely, never duplicated or overwritten.
- A client/company snapshot containing multiline CIF and address text must remain intact and render with line breaks.
- Draft, issued, paid and void legacy statuses must map to valid final-invoice states without producing a proposal.
- A paid legacy invoice creates exactly one payment; an issued invoice creates none unless an exact partial payment is verified.
- Existing invoice sequence numbers must advance the `WF` sequence far enough to prevent the next issued invoice from colliding.

---

### Task 1: Idempotent legacy invoice migration

**Files:**
- Create: `tests/legacy-final-invoices-import.test.mjs`
- Create: `supabase/migrations/202610270002_import_legacy_final_invoices.sql`

**Interfaces:**
- Consumes: `public.invoices`, `public.billing_documents`, `public.billing_document_lines`, `public.billing_payments`, `public.billing_number_sequences`.
- Produces: nullable unique `billing_documents.legacy_invoice_id`, boolean `billing_documents.tax_breakdown_review_required`, and imported final invoices linked to their source UUID.

- [x] **Step 1: Write the failing migration contract tests**

Assert that the migration adds a unique source link and review flag; inserts only `document_type = 'invoice'`; preserves source snapshots; handles existing document numbers safely; imports one line per legacy invoice; maps statuses; records full idempotent payments for the three reconciled invoices; applies the exact `WF-2026-001` and `WF-2026-002` data; creates the Bionatura final invoice from its verified fiscal snapshot under the next free `WF-2026` reference; reserves the greatest `WF-YYYY-NNNN` value; and uses conflict-safe predicates for documents, lines and payments.

- [x] **Step 2: Run the focused test and verify it fails**

Run: `node --test tests/legacy-final-invoices-import.test.mjs`

Expected: FAIL because `202610270002_import_legacy_final_invoices.sql` does not exist.

- [x] **Step 3: Implement the migration**

Import all rows from `public.invoices` with recipient fields copied verbatim. Store ambiguous historical amounts as intact totals with `tax_breakdown_review_required = true` and a technical zero-tax line whose description and document notes explicitly state that the tax split is pending review, not exempt/non-taxable accounting treatment. Reconcile Gimnasio and SuVilla by exact reference and verified totals, clear both review flags, and record full payments once. Create Bionatura directly as a paid final invoice with the next free 2026 number and its locally verified fiscal snapshot; do not import or retain a proposal document. All three reconciled invoices finish with status `paid` and balance zero.

- [x] **Step 4: Run the focused migration contract test**

Run: `node --test tests/legacy-final-invoices-import.test.mjs`

Expected: PASS.

- [x] **Step 5: Run the complete migration-focused test set**

Run: `node --test tests/internal-billing-migration.test.mjs tests/billing-payments.test.mjs tests/legacy-final-invoices-import.test.mjs`

Expected: all tests pass.

- [x] **Step 6: Commit the migration**

```bash
git add supabase/migrations/202610270002_import_legacy_final_invoices.sql tests/legacy-final-invoices-import.test.mjs
git commit -m "feat: import legacy final invoices"
```

### Task 2: Surface fiscal snapshot and review state

**Files:**
- Modify: `src/lib/supabase/types.ts`
- Modify: `src/app/paneladmin/(protected)/contabilidad/documentos/[id]/page.tsx`
- Modify: `src/app/api/contabilidad/export/route.ts`
- Create: `tests/legacy-invoice-review-ui.test.mjs`

**Interfaces:**
- Consumes: `billing_documents.legacy_invoice_id`, `billing_documents.tax_breakdown_review_required`, and the preserved multiline `recipient_company` snapshot.
- Produces: a visible admin warning on ambiguous imported invoices, legible CIF/address lines, and an export column identifying rows that require fiscal review.

- [x] **Step 1: Write the failing UI/export contract tests**

Assert that the document view renders recipient company data with preserved whitespace, shows a Spanish “desglose fiscal pendiente de revisar” warning when the flag is true, and the documents CSV exports a review-status column.

- [x] **Step 2: Run the focused test and verify it fails**

Run: `node --test tests/legacy-invoice-review-ui.test.mjs`

Expected: FAIL because the type and warning/export copy are absent.

- [x] **Step 3: Extend generated database types and document presentation**

Add the two new columns to `billing_documents` Row/Insert/Update types. Render the full recipient snapshot with `whitespace-pre-line`; show the warning only to the admin when `tax_breakdown_review_required` is true.

- [x] **Step 4: Extend accounting export**

Add a stable Spanish CSV column for review state without changing existing amount columns.

- [x] **Step 5: Run the focused UI/export test**

Run: `node --test tests/legacy-invoice-review-ui.test.mjs`

Expected: PASS.

- [x] **Step 6: Commit the presentation change**

```bash
git add src/lib/supabase/types.ts 'src/app/paneladmin/(protected)/contabilidad/documentos/[id]/page.tsx' src/app/api/contabilidad/export/route.ts tests/legacy-invoice-review-ui.test.mjs
git commit -m "feat: flag imported invoice tax reviews"
```

### Task 3: Reconcile evidence and verify the complete branch

**Files:**
- Modify: `docs/superpowers/specs/2026-10-27-legacy-final-invoices-import-design.md`
- Modify: `docs/superpowers/plans/2026-10-27-legacy-final-invoices-import.md`

**Interfaces:**
- Consumes: Gmail evidence and the migration/UI tests from Tasks 1–2.
- Produces: a checked evidence note recording what is verified and what must be sourced from `public.invoices` at migration time.

- [x] **Step 1: Record the evidence review**

Document the local invoice review: Gimnasio `WF-2026-001` and its CIF/totals are verified from the original final invoice; Bionatura's CIF/totals are verified from its original proposal but no final invoice exists locally; SuVilla `WF-2026-002` and its exact split/payment are verified from its final invoice. Explicitly exclude the accounting email as evidence.

- [x] **Step 2: Run all project checks**

Run: `npm test`

Expected: all tests pass (environment-dependent PostgreSQL tests may remain explicitly skipped when Docker is unavailable).

Run: `npm run typecheck`

Expected: exit 0.

Run: `npm run lint`

Expected: exit 0.

Run: `npm run build`

Expected: exit 0.

- [x] **Step 3: Inspect the final diff and status**

Run: `git diff main...HEAD --check && git status --short`

Expected: no whitespace errors; only the approved design/plan documentation may remain uncommitted before the final documentation commit.

- [x] **Step 4: Commit documentation**

```bash
git add docs/superpowers/specs/2026-10-27-legacy-final-invoices-import-design.md docs/superpowers/plans/2026-10-27-legacy-final-invoices-import.md
git commit -m "docs: record legacy invoice import design"
```
