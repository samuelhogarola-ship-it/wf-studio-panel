# Bill-in Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a central Bill-in accounting dashboard, filterable history, expense classification, and quarterly preparation to the local administrator panel.

**Architecture:** A server-only data module reads existing invoice and expense ledgers and derives a small dashboard view model. A new protected page renders the view model and the existing administrator shell exposes it through the Bill-in group.

**Tech Stack:** Next.js 15 App Router, React server components, Supabase, Node test runner.

**Spec:** `docs/superpowers/specs/2026-10-28-billin-dashboard-design.md`

## Global Constraints

- Existing invoice and expense pages remain the only authoring and full-history screens.
- Proposals and void records never inflate financial totals.
- General and class accounting remain separately visible.
- The only new table is the administrator-only Bill-in account catalog; no external services, Cloud writes, or automatic tax filing.

## Review Focus

- Empty ledgers return zero summaries and empty recent lists.
- Proposals count as documents but not revenue.
- Void invoices and expenses do not affect financial totals.
- Collected and net totals use paid records only.
- Unknown accounting-area values cannot disappear silently; they fall back to General.
- Invalid month, year, or quarter query values fall back to the current period.
- Existing expense rows remain usable and are classified as one-off by migration default.

---

### Task 1: Bill-in summary model and protected dashboard

**Files:**
- Create: `src/lib/billin/summary.mjs`
- Create: `src/lib/data/billin.ts`
- Create: `src/app/paneladmin/(protected)/billin/page.tsx`
- Modify: `src/components/layout/app-shell.tsx`
- Test: `tests/billin-dashboard.test.mjs`

**Interfaces:**
- Consumes: invoice rows with `amount`, `status`, `document_type`, and `accounting_area`; expense rows with `amount`, `status`, and `accounting_area`.
- Produces: `summarizeBillin({ invoices, expenses })` and `getBillinDashboardData()` with totals, counts, and recent ledger rows.

- [ ] **Step 1: Write the failing dashboard test**

Assert the summary excludes proposals and void records, separates General and Clases, renders the four headline totals, recent ledger sections, direct actions, and a `Resumen` sidebar link.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/billin-dashboard.test.mjs`

- [ ] **Step 3: Implement the summary, data function, page, and navigation**

Keep all financial derivation in `summarizeBillin`; the data module only fetches source rows and selects recent items.

- [ ] **Step 4: Run focused and full verification**

Run: `node --test tests/billin-dashboard.test.mjs`

Run: `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build`.

### Task 4: Supabase accounts and expandable activity breakdown

**Files:**
- Create: `supabase/migrations/20261028200000_billin_accounts.sql`
- Create: `src/lib/actions/billing-accounts.ts`
- Create: `src/components/admin/billing-account-form.tsx`
- Create: `src/app/paneladmin/(protected)/billin/cuentas/page.tsx`
- Modify: invoice and expense forms, actions, data modules, Supabase types, Bill-in dashboard, and sidebar.
- Test: `tests/billin-accounts.test.mjs`

**Interfaces:**
- Consumes: existing invoice/expense creation and monthly summary data.
- Produces: administrator-only `billing_accounts`, nullable account links on both ledgers, account selectors, and per-area expandable account totals.

- [x] **Step 1: Write and run failing account persistence and UI tests**
- [x] **Step 2: Add migration, account management, and ledger assignment**
- [x] **Step 3: Add expandable per-account activity summaries**
- [x] **Step 4: Apply locally, run full verification, inspect in browser, and commit**

- [x] **Step 5: Verify the dashboard in the local browser and commit**

Open `/paneladmin/billin`, check summary labels and navigation, then commit the implementation.

### Task 2: Expense nature classification

**Files:**
- Create: `supabase/migrations/20261028190000_billin_expense_nature.sql`
- Modify: `src/components/admin/expense-form.tsx`
- Modify: `src/lib/actions/expenses.ts`
- Modify: `src/lib/data/expenses.ts`
- Modify: `src/lib/supabase/types.ts`
- Modify: `src/app/paneladmin/(protected)/gastos/page.tsx`
- Test: `tests/billin-expense-nature.test.mjs`

**Interfaces:**
- Consumes: the existing expense creation action and ledger.
- Produces: `expense_nature` with values `fixed`, `recurring`, or `one_off`, defaulting existing rows to `one_off`.

- [ ] **Step 1: Write and run a failing classification test**

Assert the migration constraint/default, the three form choices, action validation/persistence, and ledger labels.

- [ ] **Step 2: Implement the migration and application wiring**

- [ ] **Step 3: Run the focused test and commit**

Run: `node --test tests/billin-expense-nature.test.mjs tests/billin-expenses.test.mjs`

### Task 3: Filterable history and quarterly preparation

**Files:**
- Create: `src/lib/billin/periods.mjs`
- Create: `src/app/paneladmin/(protected)/billin/trimestres/page.tsx`
- Create: `src/app/paneladmin/(protected)/billin/trimestres/export/route.ts`
- Modify: `src/lib/data/billin.ts`
- Modify: `src/lib/data/invoices.ts`
- Modify: `src/app/paneladmin/(protected)/facturas/page.tsx`
- Modify: `src/components/layout/app-shell.tsx`
- Test: `tests/billin-periods.test.mjs`
- Test: `tests/billin-history-quarter.test.mjs`

**Interfaces:**
- Consumes: the Bill-in ledger rows and summary model from Task 1.
- Produces: validated `monthBounds`, `quarterBounds`, filtered invoice history, a printable quarter view, and a UTF-8 CSV export.

- [ ] **Step 1: Write and run failing period-boundary tests**

Assert month and quarter defaults, year transitions, and half-open boundaries.

- [ ] **Step 2: Implement period helpers and filtered data queries**

- [ ] **Step 3: Write and run failing UI/export tests**

Assert month/type/status/area invoice filters, monthly totals, quarter selection, General/Clases split, and CSV headers.

- [ ] **Step 4: Implement history controls, quarter page, export route, and navigation**

- [ ] **Step 5: Run full verification, visually inspect Bill-in, and commit**

Run: `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build`.

### Task 5: Accounting correctness and scale review

**Files:** summary/data modules, invoice history, quarterly CSV, and regression tests.

- [x] Attribute collections by `paid_at` instead of invoice issue date.
- [x] Exclude drafts from invoiced totals.
- [x] Paginate financial reads beyond Supabase's 1,000-row default limit.
- [x] Paginate invoice history and calculate totals across all filtered rows.
- [x] Neutralize spreadsheet-formula prefixes in CSV text cells.

