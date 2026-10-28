# Bill-in Period, Header and Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reusable accounting-period selector with a clean period summary, a compact colorful Bill-in H1 presentation, and faster protected navigation without redesigning WF-Studio.

**Architecture:** A pure period resolver turns URL parameters into optional half-open date bounds shared by Bill-in, invoices and expenses. A server-rendered GET filter preserves URL state and avoids new client-side state. `AdminShell` accepts an optional header node for the Bill-in-only visual treatment, while request-scoped React caching deduplicates repeated admin identity checks between the protected layout and page.

**Tech Stack:** Next.js 15 App Router, React 19 server components, TypeScript, Supabase SSR/PostgREST, Node test runner, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-10-28-billin-period-header-performance-design.md`

## Global Constraints

- Keep the existing sidebar, tables, cards and overall WF-Studio layout unchanged.
- Use a code-native SVG mark; do not add a raster logo or image-generation dependency.
- Preserve existing `month=YYYY-MM` links and current invoice/status/area filters.
- Keep every authorization boundary; only deduplicate repeated checks inside the same server render.
- Do not add or alter database schema, accounting records, numbering, permissions or RLS.
- Use half-open date bounds (`start` inclusive, `end` exclusive) for every database filter.
- Show facturado, cobrado, pendiente, gastos pagados, neto, invoice/proposal counts and activity/account breakdowns for the selected period; proposals and void documents never contribute to monetary totals.
- Do not add charts, trends or previous-period comparisons.

## Review Focus

- Invalid or contradictory range parameters must fall back safely and never produce an unbounded accidental query.
- A custom end date must include that whole calendar day by converting it to the following exclusive date.
- Existing query parameters such as client, area, type and status must survive period changes while page resets to 1.
- “Todo el histórico” must omit date bounds while all presets must resolve deterministically in UTC.
- Repeated `requireAdmin()` calls in one render must share one identity lookup, while separate requests remain isolated.

---

### Task 1: Shared accounting-period model and selector

**Files:**
- Modify: `src/lib/billin/periods.mjs`
- Create: `src/components/admin/billin-period-filter.tsx`
- Test: `tests/billin-periods.test.mjs`
- Create: `tests/billin-period-filter.test.mjs`

**Interfaces:**
- Consumes: existing `monthBounds(value, now)` and `quarterBounds(year, quarter, now)`.
- Produces: `resolveAccountingPeriod(input, now)` returning `{ key, label, start, end }`, where `start` and `end` are omitted for all-history mode; `BillinPeriodFilter({ action, period, preservedParams })` rendering a GET form.

- [ ] **Step 1: Write failing period-resolution tests**

Add assertions for `all`, current/previous month, current/previous quarter, current year, valid custom range, invalid custom range fallback, legacy `month`, and the exclusive day after a custom `to` date.

- [ ] **Step 2: Run the period tests and confirm failure**

Run: `node --test tests/billin-periods.test.mjs`

Expected: FAIL because `resolveAccountingPeriod` does not exist.

- [ ] **Step 3: Implement `resolveAccountingPeriod(input, now)`**

Accept `{ period?: string, month?: string, from?: string, to?: string }`; give valid legacy `month` compatibility, use UTC calendar arithmetic, and fall back to the current month for malformed or reversed custom ranges.

- [ ] **Step 4: Run the period tests and confirm pass**

Run: `node --test tests/billin-periods.test.mjs`

Expected: PASS.

- [ ] **Step 5: Write failing selector rendering tests**

Assert the exact options `all`, `this-month`, `previous-month`, `this-quarter`, `previous-quarter`, `this-year`, `custom`; assert `from`/`to` date inputs; assert hidden preserved filters and omission of `page`.

- [ ] **Step 6: Run the selector test and confirm failure**

Run: `node --test tests/billin-period-filter.test.mjs`

Expected: FAIL because the component does not exist.

- [ ] **Step 7: Implement `BillinPeriodFilter` as a server-rendered GET form**

Render the preset select, always-visible compact custom date inputs, preserved hidden parameters excluding `page`, an apply button and a clear all-history link.

- [ ] **Step 8: Run selector and period tests**

Run: `node --test tests/billin-periods.test.mjs tests/billin-period-filter.test.mjs`

Expected: PASS.

- [ ] **Step 9: Commit the shared period unit**

```bash
git add src/lib/billin/periods.mjs src/components/admin/billin-period-filter.tsx tests/billin-periods.test.mjs tests/billin-period-filter.test.mjs
git commit -m "feat: add reusable Bill-in period selector"
```

### Task 2: Apply periods to Bill-in, invoices and expenses

**Files:**
- Modify: `src/app/paneladmin/(protected)/billin/page.tsx`
- Modify: `src/app/paneladmin/(protected)/facturas/page.tsx`
- Modify: `src/app/paneladmin/(protected)/gastos/page.tsx`
- Modify: `src/lib/data/invoices.ts`
- Modify: `src/lib/data/expenses.ts`
- Modify: `tests/billin-dashboard.test.mjs`
- Modify: `tests/billin-history-quarter.test.mjs`
- Modify: `tests/billin-expenses.test.mjs`

**Interfaces:**
- Consumes: Task 1 `resolveAccountingPeriod` and `BillinPeriodFilter`.
- Produces: all three pages accepting `period`, `from`, `to` and legacy `month`; invoice and expense data loaders accepting optional `{ start, end }` bounds.

- [ ] **Step 1: Add failing page/data tests**

Assert each page renders the shared selector; all-history omits date predicates; presets/custom bounds apply `gte`/`lt`; existing type/status/area/client filters survive; pagination links retain period parameters; the Bill-in history link without a period reaches all invoices; the dashboard title reflects monthly, quarterly, annual, custom and historical periods; summary cards expose facturado, cobrado, pendiente, gastos, neto and document counts while proposals/void documents remain excluded from money.

- [ ] **Step 2: Run the focused tests and confirm failure**

Run: `node --test tests/billin-dashboard.test.mjs tests/billin-history-quarter.test.mjs tests/billin-expenses.test.mjs`

Expected: FAIL on missing shared selector and date-bound behavior.

- [ ] **Step 3: Wire the resolved period into the Bill-in dashboard**

Replace direct `monthBounds` usage with `resolveAccountingPeriod`; pass `undefined` to `getBillinDashboardData` for all history and bounded dates otherwise; render `BillinPeriodFilter`; label the summary from the resolved period and present the existing accounting totals as clean cards including an explicit pending amount, without adding charts or altering the tables.

- [ ] **Step 4: Wire the period into invoice history**

Extend `InvoiceFilters` with optional `start`/`end`; apply the same bounds to page and total queries; preserve existing document/status/area filters and reset pagination when the period changes.

- [ ] **Step 5: Wire the period into expense history**

Extend `getExpensesPageData` with optional bounds; apply them to the paginated query and a bounded amount summary query without changing the database schema; preserve area/client behavior and pagination state.

- [ ] **Step 6: Run focused tests and confirm pass**

Run: `node --test tests/billin-dashboard.test.mjs tests/billin-history-quarter.test.mjs tests/billin-expenses.test.mjs tests/billin-periods.test.mjs tests/billin-period-filter.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit the integrated period filtering**

```bash
git add 'src/app/paneladmin/(protected)/billin/page.tsx' 'src/app/paneladmin/(protected)/facturas/page.tsx' 'src/app/paneladmin/(protected)/gastos/page.tsx' src/lib/data/invoices.ts src/lib/data/expenses.ts tests/billin-dashboard.test.mjs tests/billin-history-quarter.test.mjs tests/billin-expenses.test.mjs
git commit -m "feat: filter Bill-in ledgers by accounting period"
```

### Task 3: Bill-in H1 presentation

**Files:**
- Create: `src/components/admin/billin-page-header.tsx`
- Modify: `src/components/layout/app-shell.tsx`
- Modify: `src/app/paneladmin/(protected)/billin/page.tsx`
- Test: `tests/billin-dashboard.test.mjs`
- Create: `tests/admin-shell-header.test.mjs`

**Interfaces:**
- Consumes: existing `AdminShell` title/description behavior.
- Produces: optional `header?: ReactNode` on `AdminShell`; `BillinPageHeader()` containing one accessible H1, compact SVG mark and restrained gradient/accent presentation.

- [ ] **Step 1: Write failing header tests**

Assert the default shell still renders its normal H1; custom header replaces only the page-header region; `BillinPageHeader` renders exactly one H1 containing `Bill-in`, the existing subtitle and an SVG marked decorative.

- [ ] **Step 2: Run header tests and confirm failure**

Run: `node --test tests/admin-shell-header.test.mjs tests/billin-dashboard.test.mjs`

Expected: FAIL because `header` and `BillinPageHeader` do not exist.

- [ ] **Step 3: Add the optional custom-header slot to `AdminShell`**

Keep current output byte-for-byte equivalent when `header` is absent; when present, render it in the existing fixed page-header region.

- [ ] **Step 4: Implement the compact colorful Bill-in header**

Use a small inline SVG mark, a restrained blue/violet/teal accent, the H1 `Bill-in`, and the existing subtitle; do not change the content cards or sidebar.

- [ ] **Step 5: Use the custom header only on `/paneladmin/billin`**

Pass `header={<BillinPageHeader />}` while retaining title and description props for the shell contract.

- [ ] **Step 6: Run header tests and confirm pass**

Run: `node --test tests/admin-shell-header.test.mjs tests/billin-dashboard.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit the visual change**

```bash
git add src/components/admin/billin-page-header.tsx src/components/layout/app-shell.tsx 'src/app/paneladmin/(protected)/billin/page.tsx' tests/admin-shell-header.test.mjs tests/billin-dashboard.test.mjs
git commit -m "feat: give Bill-in a focused page header"
```

### Task 4: Deduplicate admin identity work and verify navigation

**Files:**
- Modify: `src/lib/auth.ts`
- Create: `tests/admin-auth-cache.test.mjs`
- Modify: `tests/auth-boundaries.test.mjs`

**Interfaces:**
- Consumes: existing `requireAdmin(): Promise<AuthIdentity>` called by both protected layout and page.
- Produces: request-scoped cached `getProfileIdentity`/`requireAdmin` behavior with unchanged return types and redirects.

- [ ] **Step 1: Write a failing deduplication test**

Stub React `cache` with a request-local memoizer, call `requireAdmin()` twice, and assert one `auth.getUser()` plus one `profiles` lookup; separately instantiate the module again and assert a new request performs fresh checks.

- [ ] **Step 2: Run auth tests and confirm failure**

Run: `node --test tests/admin-auth-cache.test.mjs tests/auth-boundaries.test.mjs`

Expected: FAIL because repeated calls perform duplicate Supabase work.

- [ ] **Step 3: Cache the identity boundary for one render request**

Wrap the internal identity resolver with React `cache` and expose cached `requireAdmin` without changing middleware authorization or redirect behavior.

- [ ] **Step 4: Run auth tests and confirm pass**

Run: `node --test tests/admin-auth-cache.test.mjs tests/auth-boundaries.test.mjs`

Expected: PASS.

- [ ] **Step 5: Measure warm navigation before/after**

Use the existing local dev server after warm compilation; record five protected RSC navigations or server timings before and after. Confirm duplicate profile/user calls disappear and median warm navigation improves without authorization regressions.

- [ ] **Step 6: Run complete verification**

Run: `npm test && npm run lint && npm run typecheck && npm run build`

Expected: all tests pass (only documented skips), lint/typecheck exit 0, and production build succeeds.

- [ ] **Step 7: Commit the performance fix**

```bash
git add src/lib/auth.ts tests/admin-auth-cache.test.mjs tests/auth-boundaries.test.mjs
git commit -m "perf: deduplicate admin identity checks"
```

### Task 5: Final visual and functional verification

**Files:**
- Modify only if verification reveals a scoped defect in files already owned by Tasks 1–4.

**Interfaces:**
- Consumes: completed Tasks 1–4.
- Produces: verified local Bill-in flow with no additional features.

- [ ] **Step 1: Verify period flows in the browser**

Check all history, month, quarter, year and custom range on Bill-in, invoices and expenses; confirm preserved filters and correct empty states.

- [ ] **Step 2: Verify the visual boundary**

Confirm only the Bill-in H1 region is colorful; sidebar, CRM pages, cards and tables retain their current presentation on desktop and mobile.

- [ ] **Step 3: Verify protected navigation**

Confirm unauthenticated redirects, admin navigation, sign-out and client-area isolation still behave correctly.

- [ ] **Step 4: Review the branch diff**

Run: `git diff --check && git status --short`

Expected: no whitespace errors and only intended changes/plan documents.

