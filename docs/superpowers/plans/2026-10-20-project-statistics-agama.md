# Project Statistics and aGama Blogger Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Give administrators and authorized clients correctly scoped statistics for each project, and activate aGama analytics and Blogger access without altering its existing reports, bonuses or other client services.

**Architecture:** Reuse the existing Umami adapter, `ProjectAnalyticsPanel`, and centralized Blogger authorization. Resolve each tool target only after project authorization and registry validation, then expose thin admin and client routes over those shared checks. Capability activation remains explicit and is allowed only when the project has a valid registry binding and the tool's required configuration.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Supabase/PostgreSQL, Umami API adapter, Node test runner.

**Spec:** `docs/superpowers/specs/2026-10-20-project-workspaces-and-direct-blogger-access-design.md`

## Global Constraints

- Do not replace, migrate or redesign aGama reports, bonuses, invoices, hosting, domains or client assignments.
- Do not copy Umami credentials or website IDs into source, migrations, rendered HTML or test fixtures.
- A project must never fall back to another project's Umami configuration.
- Clients see statistics only for active analytics capabilities on active assigned projects with client access enabled.
- Administrators may see configuration warnings, but clients must not see internal registry or environment details.
- Production capability activation happens only after masked configuration validation; code and migrations must remain safe in environments without Umami secrets.

## Review Focus

- Compare aGama service rows before and after activation; only its analytics and Blogger capabilities may change.
- Exercise cross-project and disabled-capability requests to prevent analytics data leakage.
- Confirm both routes resolve the same canonical project key and no browser-provided Umami site ID is trusted.

---

## Task 1: Pin the existing aGama service model with regression tests

**Files:**

- Create: `tests/agama-project-statistics.test.mjs`
- Modify: `tests/client-projects-migration.test.mjs`
- Modify: `tests/site-registry.test.mjs`

- [ ] Write failing/expanding tests that require the aGama registry entry to use key `agama`, domain `agama.com.mx`, and analytics source/env suffix `AGAMA` without containing a secret or website ID.
- [ ] Add migration regression assertions that the existing aGama project migration only inserts absent rows, preserves assigned clients, and never downgrades or overwrites configured capability rows.
- [ ] Add an explicit invariant fixture with active `bonuses_reports`, reports and other account data, then assert analytics and Blogger activation changes none of those values.
- [ ] Run `node --test tests/agama-project-statistics.test.mjs tests/client-projects-migration.test.mjs tests/site-registry.test.mjs` and confirm the new behavior is not yet fully represented.
- [ ] Make only the minimum fixture/contract changes needed to express the preserved aGama model; do not change product behavior in this task.
- [ ] Re-run the focused tests.
- [ ] Commit with `git commit -m "test: preserve agama services while adding statistics"`.

## Task 2: Centralize authorized analytics target resolution

**Files:**

- Create: `src/lib/analytics/project-access.ts`
- Modify: `src/app/api/analytics/[project]/route.ts`
- Modify: `src/app/cliente/(protected)/proyectos/[slug]/estadisticas/page.tsx`
- Modify: `tests/client-analytics-access.test.mjs`
- Create: `tests/project-analytics-resolution.test.mjs`

Add these server-only interfaces:

```ts
type AnalyticsTarget = {
  projectId: string;
  projectSlug: string;
  registryKey: string;
};

resolveAdminAnalyticsTarget(projectId: string): Promise<AnalyticsTarget>;
resolveClientAnalyticsTarget(projectSlug: string): Promise<AnalyticsTarget>;
```

- [ ] Write failing tests for: valid administrator resolution, valid assigned-client resolution, disabled capability, inactive project, disabled client access, missing registry key, invalid registry configuration, and a cross-project access attempt.
- [ ] Run `node --test tests/project-analytics-resolution.test.mjs tests/client-analytics-access.test.mjs` and confirm failure.
- [ ] Implement server-only resolvers that call existing project access functions and validate `hasProjectAnalytics` before returning the registry key.
- [ ] Refactor the API and existing client statistics page to use the resolver. Preserve the existing sanitized client response shape.
- [ ] Run the focused tests and confirm all project keys remain exact.
- [ ] Commit with `git commit -m "refactor: authorize analytics by canonical project"`.

## Task 3: Add administrator project statistics

**Files:**

- Create: `src/app/paneladmin/(protected)/proyectos/[id]/estadisticas/page.tsx`
- Modify: `src/components/admin/project-tool-grid.tsx`
- Modify: `tests/project-admin-ui.test.mjs`
- Modify: `tests/umami-panel-ui.test.mjs`

- [ ] Add failing tests requiring `/paneladmin/proyectos/[id]/estadisticas` to call `requireAdmin`, resolve the exact project, and render `ProjectAnalyticsPanel` with the registry key.
- [ ] Add a failing tool-card test requiring the analytics action to link to that route only when active and correctly configured.
- [ ] Run `node --test tests/project-admin-ui.test.mjs tests/umami-panel-ui.test.mjs` and confirm failure.
- [ ] Implement the thin administrator page and breadcrumb/back link; reuse the existing analytics component instead of duplicating dashboard logic.
- [ ] Ensure a configuration error renders an administrator-safe warning and does not query Umami.
- [ ] Run the focused tests and confirm they pass.
- [ ] Commit with `git commit -m "feat: add statistics to admin project workspaces"`.

## Task 4: Add safe analytics and Blogger activation guards

**Files:**

- Modify: `src/lib/actions/projects.ts`
- Modify: `src/components/admin/project-capabilities-form.tsx`
- Modify: `tests/project-data-contract.test.mjs`
- Modify: `tests/project-admin-ui.test.mjs`

- [ ] Write failing action tests proving analytics cannot transition to `active` when `analytics_registry_key` is absent, the registry site is unknown, or required Umami configuration is unavailable.
- [ ] Write failing action tests proving Blogger cannot transition to `active` when its project-to-site binding or Blogger runtime configuration is invalid.
- [ ] Add failing success tests proving only the selected project's requested `analytics` or `blogger` capability row changes when that tool's configuration is valid.
- [ ] Run the focused tests and confirm failure.
- [ ] Add the activation guards using `hasProjectAnalytics(project)`, the existing Blogger registry validation, and the existing mutation boundary. Return a useful administrator error while leaving all rows untouched on failure.
- [ ] Display the corresponding validation result beside each capability control.
- [ ] Run `node --test tests/project-data-contract.test.mjs tests/project-admin-ui.test.mjs tests/agama-project-statistics.test.mjs` and confirm aGama's reports/bonuses fixture is unchanged.
- [ ] Commit with `git commit -m "fix: validate project tool activation"`.

## Task 5: Validate and activate aGama statistics and Blogger in the target environment

**Files:** No secrets or hard-coded production IDs are added to Git.

- [ ] Inspect only masked presence/absence for the aGama Umami variables expected by the registry (`UMAMI_*_AGAMA` as defined by the existing environment loader); never print their values.
- [ ] If variables are missing, stop this production step and tell Samuel exactly which variable names he must add himself. Do not retrieve or reuse passwords/tokens.
- [ ] With valid configuration, use the normal authenticated administrator capability action to set only aGama `analytics` and `blogger` to `active`, recording the existing audit entries.
- [ ] Read back aGama's project and capability rows; compare its reports/bonuses and every capability other than analytics/Blogger with the pre-change fixture/snapshot.
- [ ] Log in as the authorized aGama client and confirm `Estadísticas` and `Blogger` appear while informes and bonos still work.
- [ ] Open aGama Blogger from its project portal and from `/acceso/blogger/agama`; both paths must resolve the aGama editor and neither may render administrator navigation.
- [ ] Confirm another client cannot load aGama statistics and aGama cannot load another project's metrics.
- [ ] Commit no environment or production-data material.

## Task 6: Verify and open the statistics pull request

**Files:** No new product files unless verification finds a defect.

- [ ] Run `npm test`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.
- [ ] Manually verify one administrator project and two separate client projects against mocked or non-production analytics data.
- [ ] Inspect `git diff --check`, `git status --short`, and the final diff for secrets and unintended aGama service changes outside analytics/Blogger entitlement.
- [ ] Push the dedicated branch and open a Pull Request against `main`; attach the PR to the task.
