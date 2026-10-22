# Unified Client Webs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the client area into one additive panel for every active client, with a universal Webs workspace, visible product tiers, conditional analytics/Blogger tools, and a useful shared home.

**Architecture:** Keep account routes global and place project-scoped tools behind `Webs`. Preserve the existing RLS project assignment model, add a nullable product tier to each project, and derive all client visibility from active validated capabilities. Build the dashboard metric rotator from authorized summary-only analytics data so failures cannot break the rest of the home.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Supabase/PostgreSQL RLS, Node test runner, Tailwind CSS, Umami.

**Spec:** `docs/superpowers/specs/2026-10-22-unified-client-webs-design.md`

## Global Constraints

- Preserve every existing client route and all user-owned data.
- `Inicio` always resolves to `/cliente/dashboard`; it never redirects to a project.
- `Webs` always resolves to `/cliente/proyectos`, including for clients with zero projects.
- Product tier values are exactly `lite`, `express`, `pro`, or `null`.
- Client project and capability reads remain session-bound and RLS-authorized.
- Inactive, invalid, or misconfigured capabilities must not appear to clients.
- Do not activate TodoPlástico Blogger until its separate application adapter passes end-to-end verification.
- Do not commit `.env*`, credentials, `.claude/`, build output, caches, or generated dependencies.

## Review Focus

- An active client with zero projects must still open Inicio and every existing account route; Task 2 adds the navigation and route tests.
- A client with multiple projects must never see another client's project through URL manipulation; Task 3 extends authorized project route tests.
- A missing Umami connection or a single failed site must degrade only the metric card; Task 4 adds partial-failure tests.
- Null or unknown product tiers must render a safe fallback and never grant tools; Task 1 and Task 3 test this behavior.
- Reduced-motion and keyboard users must control the metric rotator without unexpected changes; Task 4 adds component behavior tests or pure state tests.

---

### Task 1: Product tier schema and administration

**Files:**
- Create: `supabase/migrations/202610220001_client_project_product_tier.sql`
- Modify: `src/lib/supabase/types.ts`
- Modify: `src/lib/data/projects.ts`
- Modify: `src/lib/actions/projects.ts`
- Modify: `src/components/admin/project-form.tsx`
- Modify: `src/lib/i18n.ts`
- Test: `tests/client-projects-migration.test.mjs`
- Test: `tests/project-admin-ui.test.mjs`

**Interfaces:**
- Produces: `ProductTier = 'lite' | 'express' | 'pro'` and `client_projects.product_tier: ProductTier | null`.
- Produces: project create/update validation accepting only the three exact database values or `null`.
- Consumes: existing `upsertProjectAction` and generated-style Supabase table types.

- [ ] **Step 1: Write failing migration and admin form tests**

Assert that the migration adds nullable `product_tier` with a check constraint, sets aGama and TodoPlástico to `pro` idempotently, and that the admin form renders the four choices `Por confirmar`, `Lite`, `Express`, `Pro`.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `node --test tests/client-projects-migration.test.mjs tests/project-admin-ui.test.mjs`

Expected: FAIL because the column, type, validation and form field do not exist.

- [ ] **Step 3: Add the migration and typed project field**

Add the nullable constrained column, idempotent aGama/TodoPlástico backfill, `ProductTier`, and the field in the `client_projects` Row/Insert/Update types.

- [ ] **Step 4: Add action validation and the administrator selector**

Extend `upsertProjectAction` and `ProjectForm` without changing existing required project fields. Empty selection persists `null`.

- [ ] **Step 5: Run focused tests**

Run: `node --test tests/client-projects-migration.test.mjs tests/project-admin-ui.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/202610220001_client_project_product_tier.sql src/lib/supabase/types.ts src/lib/data/projects.ts src/lib/actions/projects.ts src/components/admin/project-form.tsx src/lib/i18n.ts tests/client-projects-migration.test.mjs tests/project-admin-ui.test.mjs
git commit -m "feat: add website product tiers"
```

### Task 2: Universal client navigation and dashboard entry

**Files:**
- Modify: `src/lib/projects/portal-navigation.mjs`
- Modify: `src/lib/projects/portal-navigation-module.d.ts`
- Modify: `src/app/cliente/(protected)/dashboard/page.tsx`
- Modify: `src/app/cliente/(protected)/proyectos/page.tsx`
- Modify: `src/lib/i18n.ts`
- Test: `tests/portal-navigation.test.mjs`
- Test: `tests/client-project-routes.test.mjs`

**Interfaces:**
- Produces: `buildPortalNavigation({ mode, projects, locale })` with one compatible signature but mode-independent base navigation.
- Produces: universal navigation IDs `dashboard` and `projects`, with `projects.href === '/cliente/proyectos'`.
- Consumes: authorized projects from `getClientPortalContext()`.

- [ ] **Step 1: Write failing universal navigation tests**

Assert that both historical mode values produce the same base account routes, `Inicio` and `Webs` are first, project tools are not flattened into the sidebar, and zero projects still includes `Webs`.

- [ ] **Step 2: Write failing dashboard route tests**

Assert that `/cliente/dashboard` no longer redirects for either mode and `/cliente/proyectos` renders its empty state instead of redirecting when there is one or zero projects.

- [ ] **Step 3: Run focused tests and verify failure**

Run: `node --test tests/portal-navigation.test.mjs tests/client-project-routes.test.mjs`

Expected: FAIL on mode-specific navigation and dashboard/project redirects.

- [ ] **Step 4: Implement the shared base navigation**

Keep the current account route union intact, label dashboard as `Inicio`, add `Webs`, and retain capability-based global account links where they already apply. Remove project-specific Blogger/analytics links from the sidebar only.

- [ ] **Step 5: Remove dashboard and selector redirects**

Render the shared dashboard for every active client and keep `/cliente/proyectos` as the universal selector/empty state.

- [ ] **Step 6: Run focused tests**

Run: `node --test tests/portal-navigation.test.mjs tests/client-project-routes.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/projects/portal-navigation.mjs src/lib/projects/portal-navigation-module.d.ts src/app/cliente/\(protected\)/dashboard/page.tsx src/app/cliente/\(protected\)/proyectos/page.tsx src/lib/i18n.ts tests/portal-navigation.test.mjs tests/client-project-routes.test.mjs
git commit -m "feat: unify client portal navigation"
```

### Task 3: Web cards and project workspaces

**Files:**
- Modify: `src/components/client/project-selector.tsx`
- Modify: `src/app/cliente/(protected)/proyectos/[slug]/page.tsx`
- Modify: `src/lib/projects/tools.mjs`
- Modify: `src/lib/projects/tools-module.d.ts`
- Modify: `src/lib/i18n.ts`
- Test: `tests/project-tools.test.mjs`
- Test: `tests/client-project-routes.test.mjs`
- Test: `tests/project-data-contract.test.mjs`

**Interfaces:**
- Produces: `ProjectSelector` cards with tier labels and active tool summaries.
- Produces: `productTierLabel(tier, locale)` or an equivalent pure formatter returning the exact approved labels and fallback.
- Consumes: `buildProjectTools({ project, viewer: 'client' })`, which remains the sole tool visibility resolver.

- [ ] **Step 1: Write failing selector and workspace tests**

Cover two assigned projects, zero projects, all three tier labels, null fallback, active analytics/Blogger, and hidden `available`, `unavailable`, invalid or cross-client tools.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `node --test tests/project-tools.test.mjs tests/client-project-routes.test.mjs tests/project-data-contract.test.mjs`

Expected: FAIL because project cards do not expose tiers/tool summaries and the workspace still derives cards directly from raw capability rows.

- [ ] **Step 3: Render Webs cards from authorized project tools**

Pass only RLS-loaded projects to `ProjectSelector`. Each card renders name, domain, tier, and active Statistics/Blogger badges without exposing destinations.

- [ ] **Step 4: Render the project workspace from `buildProjectTools`**

Use the shared resolver so a raw active row with invalid configuration cannot create a client link. Keep account-level links and all existing project information.

- [ ] **Step 5: Run focused tests**

Run: `node --test tests/project-tools.test.mjs tests/client-project-routes.test.mjs tests/project-data-contract.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/client/project-selector.tsx src/app/cliente/\(protected\)/proyectos/\[slug\]/page.tsx src/lib/projects/tools.mjs src/lib/projects/tools-module.d.ts src/lib/i18n.ts tests/project-tools.test.mjs tests/client-project-routes.test.mjs tests/project-data-contract.test.mjs
git commit -m "feat: add client website workspaces"
```

### Task 4: Shared home summaries and rotating analytics metric

**Files:**
- Create: `src/components/client/rotating-analytics-summary.tsx`
- Create: `src/lib/analytics/client-summary.ts`
- Modify: `src/app/cliente/(protected)/dashboard/page.tsx`
- Modify: `src/lib/data/client.ts`
- Test: `tests/client-dashboard-summary.test.mjs`
- Test: `tests/client-analytics-access.test.mjs`

**Interfaces:**
- Produces: `getClientAnalyticsSummaries(projects, options?) -> Promise<ClientAnalyticsSummary[]>` using summary-only Umami requests and per-project failure isolation.
- Produces: `ClientAnalyticsSummary` with project slug/name and public pageviews/visitors/visits values only.
- Produces: `<RotatingAnalyticsSummary summaries intervalMs={6000} />` with pause, previous and next controls.
- Consumes: authorized active projects and the existing Umami dashboard facade.

- [ ] **Step 1: Write failing server summary tests**

Assert that only projects with a valid active analytics tool are queried, output contains no registry keys or credentials, one failed project does not discard successful summaries, and total failure yields an empty safe result.

- [ ] **Step 2: Write failing rotator state tests**

Extract a pure reducer/helper if necessary and test 6-second advancement, manual previous/next, pause, wraparound, zero/one-item stability and reduced-motion default pause.

- [ ] **Step 3: Run focused tests and verify failure**

Run: `node --test tests/client-dashboard-summary.test.mjs tests/client-analytics-access.test.mjs`

Expected: FAIL because the summary loader and rotator do not exist.

- [ ] **Step 4: Implement authorized summary loading**

Reuse the existing project analytics resolution and `fetchUmamiDashboard({ summaryOnly: true })`; use settled results so a VPS or website failure remains local.

- [ ] **Step 5: Implement the accessible rotator**

Display one metric at a time with project identity and link to its authorized statistics route. Pause on focus/hover and when reduced motion is requested; expose explicit controls with accessible names.

- [ ] **Step 6: Compose the dashboard**

Keep existing alerts, services, bonuses and activity. Add compact Novedades, statistics, internal messages and reports sections near the H1 using existing data sources and routes.

- [ ] **Step 7: Run focused tests**

Run: `node --test tests/client-dashboard-summary.test.mjs tests/client-analytics-access.test.mjs`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/client/rotating-analytics-summary.tsx src/lib/analytics/client-summary.ts src/app/cliente/\(protected\)/dashboard/page.tsx src/lib/data/client.ts tests/client-dashboard-summary.test.mjs tests/client-analytics-access.test.mjs
git commit -m "feat: add dynamic client home summaries"
```

### Task 5: Ángel project assignments and guarded capability activation

**Files:**
- Create: `supabase/migrations/202610220002_angel_agama_todoplastico_projects.sql`
- Test: `tests/client-projects-migration.test.mjs`
- Test: `tests/site-registry.test.mjs`
- Test: `tests/agama-project-statistics.test.mjs`

**Interfaces:**
- Produces: idempotent production data mapping for Ángel's existing client row by normalized `547@agama.com.mx`.
- Produces: aGama and TodoPlástico as active, client-accessible Pro projects with active analytics.
- Produces: aGama Blogger active only when its validated central destination is present.
- Leaves: TodoPlástico Blogger in `available` until its application adapter is separately verified.

- [ ] **Step 1: Write failing idempotent assignment tests**

Assert exact normalized client lookup, no client creation, two project assignments, preserved unrelated capabilities/services, Pro tiers, active analytics, validated aGama Blogger and non-active TodoPlástico Blogger.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `node --test tests/client-projects-migration.test.mjs tests/site-registry.test.mjs tests/agama-project-statistics.test.mjs`

Expected: FAIL because Ángel is unassigned and the activation migration does not exist.

- [ ] **Step 3: Implement the guarded migration**

Use an idempotent transaction that raises a clear exception if the exact active WF Studio client is missing or duplicated. Update only the two named project rows and their intended capabilities.

- [ ] **Step 4: Keep TodoPlástico Blogger dormant in Studio**

Do not enable its registry entry or active capability in this task. Document the required adapter handoff in the migration comment and deployment checklist.

- [ ] **Step 5: Run focused tests**

Run: `node --test tests/client-projects-migration.test.mjs tests/site-registry.test.mjs tests/agama-project-statistics.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/202610220002_angel_agama_todoplastico_projects.sql tests/client-projects-migration.test.mjs tests/site-registry.test.mjs tests/agama-project-statistics.test.mjs
git commit -m "feat: provision angel project access"
```

### Task 6: Full verification and delivery

**Files:**
- Modify if required: `README.md`
- Modify if required: `ADMIN_PANEL_OPERATIONS.md`

**Interfaces:**
- Consumes: Tasks 1-5.
- Produces: a reviewable WF Studio branch that remains safe before the separate TodoPlástico Blogger adapter is integrated.

- [ ] **Step 1: Run the full local quality suite**

Run: `npm test && npm run lint && npm run typecheck && npm run build`

Expected: all commands exit 0.

- [ ] **Step 2: Review the complete diff and secret hygiene**

Run: `git diff --check origin/codex/project-portals-favorites...HEAD && git status --short`

Expected: no whitespace errors; only intentional source/docs changes and the untouched user-owned `.claude/` entry.

- [ ] **Step 3: Update operational documentation if runtime steps changed**

Record migration order, capability activation gates and post-deploy checks without including credentials.

- [ ] **Step 4: Commit documentation changes if any**

```bash
git add README.md ADMIN_PANEL_OPERATIONS.md
git commit -m "docs: document unified client web rollout"
```

- [ ] **Step 5: Push and open a stacked Pull Request**

Push `codex/unified-client-webs` and open it against `codex/project-portals-favorites` while PR #18 remains open. After #18 merges, retarget to `main` and confirm the diff contains only this plan's changes.

- [ ] **Step 6: Production verification after approval and deployment**

Verify as administrator, Ángel, Sofía and an active client without projects. Confirm route preservation, project isolation, two Ángel analytics pages, aGama Blogger, dashboard partial-failure handling and responsive navigation.
