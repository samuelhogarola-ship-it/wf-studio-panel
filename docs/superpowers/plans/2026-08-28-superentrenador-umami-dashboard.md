# Superentrenador Umami Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a protected, native Umami analytics dashboard for Superentrenador inside WF-Panel.

**Architecture:** A server-only Umami client authenticates and fetches all dashboard datasets, while a small pure JavaScript core normalizes API responses and remains directly testable with Node's existing test runner. A protected Next.js Server Component renders the dashboard, with shared navigation across the three Superentrenador admin pages.

**Tech Stack:** Next.js 15 App Router, React 19 Server Components, TypeScript, Tailwind CSS, Node test runner, Umami REST API.

**Spec:** `docs/superpowers/specs/2026-08-28-superentrenador-umami-dashboard-design.md`

## Global Constraints

- Keep all Umami credentials server-only.
- Do not add a charting dependency or a public proxy API route.
- Support only 7, 30, and 90 day ranges; default to 30.
- Preserve the existing protected `AdminShell` and visual language.
- Treat missing configuration, empty traffic, and upstream failure as distinct states.

---

### Task 1: Testable Umami domain and API core

**Files:**
- Create: `src/lib/data/umami-core.mjs`
- Create: `src/types/umami-core.d.ts`
- Test: `tests/umami-dashboard.test.mjs`

**Interfaces:**
- Produces: `parseAnalyticsDays(value): 7 | 30 | 90`, `numberValue(metric): number`, `previousValue(metric): number`, `formatTrend(current, previous): string`, `buildUmamiDashboard({ config, days, now, fetchImpl }): Promise<object>`.

- [ ] **Step 1: Write failing unit tests**

Cover invalid period fallback, numeric/object normalization, trend formatting, login request, authenticated parallel endpoint requests, derived bounce rate and average duration, and sanitized upstream errors. Use a deterministic `fetchImpl` that records URLs and returns fixture JSON.

- [ ] **Step 2: Run the focused test and confirm red**

Run: `node --test tests/umami-dashboard.test.mjs`
Expected: FAIL because `umami-core.mjs` does not exist.

- [ ] **Step 3: Implement the minimal core**

Implement URL construction with `URL`, login through `/api/auth/login`, and requests for `/stats?compare=prev`, `/pageviews?unit=day`, plus `url`, `referrer`, `country`, `device`, and `event` metrics. Return normalized summary metrics, series, lists, funnel counts, `generatedAt`, and the selected period. Throw only a generic `UmamiRequestError` that contains status/endpoint but never credentials.

- [ ] **Step 4: Add the declaration file**

Declare the config, raw metric, series, normalized dashboard data, and exported function signatures so strict TypeScript consumers do not use `any`.

- [ ] **Step 5: Run focused tests and typecheck**

Run: `node --test tests/umami-dashboard.test.mjs && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/data/umami-core.mjs src/types/umami-core.d.ts tests/umami-dashboard.test.mjs
git commit -m "feat: add Umami dashboard data core"
```

### Task 2: Server-only configuration adapter

**Files:**
- Create: `src/lib/data/umami.ts`
- Modify: `.env.example`
- Modify: `README.md`
- Test: `tests/umami-dashboard.test.mjs`

**Interfaces:**
- Consumes: `buildUmamiDashboard` and its declared types from Task 1.
- Produces: `getSuperEntrenadorAnalytics(days): Promise<{ status: 'ready'; data } | { status: 'not-configured'; missing: string[] } | { status: 'error'; message: string }>`.

- [ ] **Step 1: Add failing source-contract tests**

Assert that the adapter imports `server-only`, reads exactly `UMAMI_URL`, `UMAMI_USERNAME`, `UMAMI_PASSWORD`, and `UMAMI_SUPERENTRENADOR_WEBSITE_ID`, and that none has a `NEXT_PUBLIC_` prefix.

- [ ] **Step 2: Run tests and confirm red**

Run: `node --test tests/umami-dashboard.test.mjs`
Expected: FAIL because the adapter and documented variables are absent.

- [ ] **Step 3: Implement the adapter**

Validate configuration before network access, call the core with the validated values, and convert thrown upstream errors to the discriminated error result. Use React `cache` to deduplicate identical calls within a render and rely on the Umami fetch cache policy for five-minute reuse.

- [ ] **Step 4: Document production configuration**

Add the four empty variables to `.env.example` and add rows to the Coolify environment table in `README.md`, explicitly noting that all are server-only and the UI degrades safely until configured.

- [ ] **Step 5: Verify**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/data/umami.ts .env.example README.md tests/umami-dashboard.test.mjs
git commit -m "feat: connect WF-Panel to Umami"
```

### Task 3: Superentrenador section navigation

**Files:**
- Create: `src/components/superentrenador/superentrenador-nav.tsx`
- Modify: `src/components/layout/app-shell.tsx`
- Modify: `src/app/paneladmin/(protected)/superentrenador/pt/page.tsx`
- Modify: `src/app/paneladmin/(protected)/superentrenador/usuarios/page.tsx`
- Test: `tests/umami-dashboard.test.mjs`

**Interfaces:**
- Produces: `SuperEntrenadorNav({ currentPath }: { currentPath: string })` with Estadísticas, Entrenadores, and Usuarios links.

- [ ] **Step 1: Add failing navigation contract tests**

Assert that the sidebar points Superentrenador to `/paneladmin/superentrenador/estadisticas`, and that all three section routes appear in the shared navigation source.

- [ ] **Step 2: Run tests and confirm red**

Run: `node --test tests/umami-dashboard.test.mjs`
Expected: FAIL while the old `/pt` menu target remains.

- [ ] **Step 3: Implement shared navigation**

Create accessible nav links styled with the existing brand, active, border, and responsive conventions. Change the sidebar target and add the shared nav immediately inside `AdminShell` on the PT and Usuarios pages.

- [ ] **Step 4: Verify**

Run: `npm test && npm run lint && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/superentrenador/superentrenador-nav.tsx src/components/layout/app-shell.tsx 'src/app/paneladmin/(protected)/superentrenador/pt/page.tsx' 'src/app/paneladmin/(protected)/superentrenador/usuarios/page.tsx' tests/umami-dashboard.test.mjs
git commit -m "feat: add Superentrenador admin navigation"
```

### Task 4: Native analytics dashboard UI

**Files:**
- Create: `src/components/superentrenador/analytics-chart.tsx`
- Create: `src/app/paneladmin/(protected)/superentrenador/estadisticas/page.tsx`
- Test: `tests/umami-dashboard.test.mjs`

**Interfaces:**
- Consumes: `parseAnalyticsDays`, `getSuperEntrenadorAnalytics`, `SuperEntrenadorNav`, `AdminShell`, and `Card`.
- Produces: protected analytics page at `/paneladmin/superentrenador/estadisticas`.

- [ ] **Step 1: Add failing page contract tests**

Assert that the page calls `requireAdmin`, validates `searchParams.days`, contains labels for all five summary metrics and five conversion events, and renders the shared section navigation.

- [ ] **Step 2: Run tests and confirm red**

Run: `node --test tests/umami-dashboard.test.mjs`
Expected: FAIL because the page is absent.

- [ ] **Step 3: Implement the SVG chart**

Render a responsive accessible SVG with pageview and visit polylines, axes reduced to essential labels, a legend, and an empty state. Keep calculations pure and clamp zero-only datasets safely.

- [ ] **Step 4: Implement the protected page and states**

Call `requireAdmin()` before data access. Render range links, shared navigation, cards with trends, the SVG chart, conversion list, top pages/referrers/countries/devices, and generated time. Render separate amber `not-configured`, red `error`, and neutral empty-data states without exposing secret values.

- [ ] **Step 5: Run focused and static verification**

Run: `npm test && npm run lint && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/superentrenador/analytics-chart.tsx 'src/app/paneladmin/(protected)/superentrenador/estadisticas/page.tsx' tests/umami-dashboard.test.mjs
git commit -m "feat: add Superentrenador analytics dashboard"
```

### Task 5: Full verification and production readiness

**Files:**
- Modify only files requiring corrections discovered during verification.

**Interfaces:**
- Consumes: completed Tasks 1-4.
- Produces: a buildable, tested dashboard ready for Coolify credentials.

- [ ] **Step 1: Run the full project test suite**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 2: Run code quality checks**

Run: `npm run lint && npm run typecheck`
Expected: both PASS with no warnings introduced by the feature.

- [ ] **Step 3: Run the production build**

Run: `npm run build`
Expected: PASS and the route `/paneladmin/superentrenador/estadisticas` appears in build output.

- [ ] **Step 4: Verify secret boundaries**

Run: `rg -n 'UMAMI_(USERNAME|PASSWORD|SUPERENTRENADOR_WEBSITE_ID)' src/app src/components`
Expected: no credential access in client components; access is confined to the server data adapter.

- [ ] **Step 5: Inspect the final diff**

Run: `git diff HEAD~4 --check && git status --short`
Expected: no whitespace errors and only the pre-existing untracked `.claude/` remains.

- [ ] **Step 6: Commit verification fixes if needed**

```bash
git add <only-files-fixed-during-verification>
git commit -m "fix: harden Superentrenador analytics dashboard"
```
