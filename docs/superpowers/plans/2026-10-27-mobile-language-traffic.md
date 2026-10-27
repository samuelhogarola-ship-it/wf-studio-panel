# Mobile Language Traffic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open the client dashboard at the top and show an accessible top-three language traffic diagram for each website.

**Architecture:** Extend the existing Umami summary fetch with an opt-in content-language event dimension, aggregate the explicit `page-language:<code>` contract into a public project summary, and render it inside the existing rotating analytics card. Reset scroll with a dashboard-scoped client component.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS, Node test runner.

**Spec:** `docs/superpowers/specs/2026-10-27-mobile-language-traffic-design.md`

## Global Constraints

- Sport Massage order and colors are fixed: Spanish red, English green, Finnish blue.
- Other projects show their top three normalized base languages.
- Detailed analytics remain unchanged.
- No new charting dependency and no private Umami configuration in client data.

## Review Focus

- Regional language variants must aggregate before ranking.
- Empty Sport data must still produce all three fixed languages with zero values.
- Empty general data must render an honest empty state.
- Summary refreshes that do not request languages must retain their existing request budget.
- Scroll reset must run on dashboard entry without affecting other client pages.

---

### Task 1: Opt-in Umami page-language summary

**Files:**
- Modify: `src/lib/analytics/umami-dashboard.mjs`
- Modify: `src/lib/analytics/umami-dashboard-module.d.ts`
- Test: `tests/umami-dashboard.test.mjs`

**Interfaces:**
- Produces: `fetchUmamiDashboard({ includeContentLanguages?: boolean })`; with `summaryOnly: true`, `metrics.contentLanguageEvents` is populated only when opted in.

- [x] Write a failing test proving summary-only fetches exactly the complete event-name dimension when opted in and none otherwise.
- [x] Run the focused test and confirm the missing option fails.
- [x] Implement the minimal opt-in request and type declaration.
- [x] Run the focused test and confirm it passes.

### Task 2: Public language aggregation

**Files:**
- Modify: `src/lib/analytics/client-summary.ts`
- Test: `tests/client-analytics-access.test.mjs`

**Interfaces:**
- Consumes: `metrics.contentLanguageEvents` from Task 1 and filters the `page-language:` contract.
- Produces: `ClientAnalyticsSummary.languages: { code; label; value; color }[]`.

- [x] Write failing tests for regional aggregation, general top-three ranking, and fixed Sport ES/EN/FI output.
- [x] Run focused tests and confirm the language assertions fail.
- [x] Implement normalization, sanitization, ranking, labels, and colors.
- [x] Run focused tests and confirm they pass.

### Task 3: Compact diagram and scroll reset

**Files:**
- Create: `src/components/client/language-traffic-chart.tsx`
- Create: `src/components/client/dashboard-scroll-reset.tsx`
- Modify: `src/components/client/rotating-analytics-summary.tsx`
- Modify: `src/app/cliente/(protected)/dashboard/page.tsx`
- Test: `tests/client-dashboard-summary.test.mjs`

**Interfaces:**
- Consumes: `ClientAnalyticsSummary.languages` from Task 2.

- [x] Write failing component tests for the fixed colors, values, percentages, accessible label, empty state, and dashboard scroll reset.
- [x] Run focused tests and confirm the new behavior is absent.
- [x] Implement the stacked bar, legend, and dashboard-only layout-effect scroll reset.
- [x] Run focused tests and confirm they pass.

### Task 4: Whole branch verification

**Files:**
- Modify: documentation only if verification reveals a contract correction.

- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run typecheck`.
- [x] Run `npm run build`.
- [x] Run `git diff --check` and review the diff against the spec.
