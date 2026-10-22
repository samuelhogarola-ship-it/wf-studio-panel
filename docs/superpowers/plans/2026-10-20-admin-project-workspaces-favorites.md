# Admin Project Workspaces and Favorites Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn the administrator Projects area into the canonical operational catalog, with per-admin favorites on Inicio and validated shortcuts for every project tool.

**Architecture:** Keep `client_projects` as the canonical project inventory and `sites.json` as the technical site registry. Add an administrator-scoped favorites table, a pure capability-driven tool resolver, and thin server components/actions that reuse the existing project data layer. Project operations appear before configuration, while authorization continues to be enforced server-side.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Supabase/PostgreSQL with RLS, Node test runner.

**Spec:** `docs/superpowers/specs/2026-10-20-project-workspaces-and-direct-blogger-access-design.md`

## Global Constraints

- Work only in the `wf-studio-panel` repository on a dedicated `codex/` branch; do not edit the workspace copy under `apps/studio-panel`.
- Preserve every existing client assignment, capability state and local change.
- Do not place credentials, Umami IDs, repository tokens or raw capability metadata in rendered client components.
- Favorites are presentation preferences only and must never grant access or activate a capability.
- Keep project configuration available, but secondary to operational tools.
- Use test-driven development: add each failing test before its implementation and commit each coherent task.

## Review Focus

- Verify that all project and tool links come from canonical project/capability data rather than new hard-coded cards.
- Verify that a stale favorite cannot expose an archived or unauthorized project.
- Verify RLS scopes favorites to the authenticated administrator.
- Verify clients cannot reach any administrator route or configuration surface introduced here.

---

## Task 1: Persist administrator favorites safely

**Files:**

- Create: `supabase/migrations/202610200001_admin_project_favorites.sql`
- Modify: `src/lib/supabase/types.ts`
- Modify: `tests/helpers/project-harness.mjs`
- Create: `tests/project-favorites-migration.test.mjs`

- [ ] Write a failing migration contract test that requires `admin_project_favorites` with `admin_user_id`, `project_id`, `position`, `created_at`, a composite primary key, a cascading project foreign key, RLS, and policies restricted to `auth.uid() = admin_user_id` plus the existing administrator authorization predicate.
- [ ] Run `node --test tests/project-favorites-migration.test.mjs` and confirm the new assertions fail because the migration does not exist.
- [ ] Add the idempotent SQL migration, including an index for `(admin_user_id, position, created_at)` and no automatic favorite backfill.
- [ ] Add the generated-style `admin_project_favorites` Row/Insert/Update types to `src/lib/supabase/types.ts`.
- [ ] Extend the in-memory project harness with `admin_project_favorites: []` and a filtered `delete()` operation so action tests can remove exactly one preference row.
- [ ] Run `node --test tests/project-favorites-migration.test.mjs tests/project-data-contract.test.mjs` and confirm they pass.
- [ ] Commit with `git commit -m "feat: add administrator project favorites"`.

## Task 2: Resolve project tools from capability state

**Files:**

- Create: `src/lib/projects/tools.mjs`
- Create: `src/lib/projects/tools-module.d.ts`
- Create: `tests/project-tools.test.mjs`
- Modify: `src/lib/projects/portal-navigation.mjs`

Define the shared contract:

```ts
type ProjectTool = {
  id: "website" | "blogger" | "analytics" | "client" | "domains" | "hosting" | "invoices" | "reports" | "bonuses";
  label: string;
  href: string | null;
  state: "active" | "available" | "unavailable" | "misconfigured";
  audience: "admin" | "client" | "both";
  warning?: string;
};

buildProjectTools(input: {
  project: ProjectWithCapabilities;
  viewer: "admin" | "client";
  configurationIssues?: Record<string, string>;
}): ProjectTool[];
```

- [ ] Write failing tests for an active Blogger link, an active analytics link, available-but-not-active tools, missing registry configuration, admin-only configuration visibility, and client filtering.
- [ ] Run `node --test tests/project-tools.test.mjs` and confirm the module/test failures.
- [ ] Implement the pure resolver. Use internal authorized routes for Blogger and analytics; never return raw runtime secrets or metadata.
- [ ] Refactor `buildClientProjectNavigation` to consume the same capability rules without changing its existing public output.
- [ ] Run `node --test tests/project-tools.test.mjs tests/client-portal-navigation.test.mjs tests/project-url-policy.test.mjs` and confirm they pass.
- [ ] Commit with `git commit -m "refactor: centralize project tool resolution"`.

## Task 3: Add favorite queries and mutation boundaries

**Files:**

- Modify: `src/lib/data/projects.ts`
- Create: `src/lib/actions/project-favorites.ts`
- Create: `src/components/admin/project-favorite-form.tsx`
- Modify: `tests/project-data-contract.test.mjs`
- Create: `tests/project-favorite-actions.test.mjs`

Add these server interfaces:

```ts
getAdminFavoriteProjects(adminUserId: string): Promise<ProjectWithCapabilities[]>;
isAdminProjectFavorite(adminUserId: string, projectId: string): Promise<boolean>;
setProjectFavoriteAction(
  previousState: { error?: string; success?: string },
  formData: FormData,
): Promise<{ error?: string; success?: string }>;
```

- [ ] Write failing data tests proving favorites retain explicit `position`, omit archived/missing projects, and load current capability data rather than a saved snapshot.
- [ ] Write failing action tests proving `requireAdmin` executes before mutation, add uses an upsert scoped to the current administrator, remove uses a filtered delete, and both revalidate Inicio, Projects, and the project workspace.
- [ ] Run `node --test tests/project-data-contract.test.mjs tests/project-favorite-actions.test.mjs` and confirm the failures.
- [ ] Implement the queries and mutation action without service-role access.
- [ ] Add an accessible server-action form whose button text is `Añadir a Inicio` or `Quitar de Inicio`; include pending and error states but no optimistic authorization assumptions.
- [ ] Run the two focused tests and confirm they pass.
- [ ] Commit with `git commit -m "feat: manage project favorites"`.

## Task 4: Make Inicio a personal launcher

**Files:**

- Modify: `src/app/paneladmin/(protected)/inicio/page.tsx`
- Create: `src/components/admin/favorite-project-card.tsx`
- Modify: `tests/project-admin-ui.test.mjs`
- Modify: `tests/panel-navigation.test.mjs`

- [ ] Add failing render/source tests requiring a `Favoritos` section backed by `getAdminFavoriteProjects`, a canonical `Ver todos los proyectos` link, and validated project actions.
- [ ] Add a failing regression test requiring the Samuel Coach home card to include a direct Blogger shortcut to `/paneladmin/blogger/samuelcoachdealeman` while preserving alumnos, ejercicios, progreso and estadísticas.
- [ ] Run `node --test tests/project-admin-ui.test.mjs tests/panel-navigation.test.mjs` and confirm they fail.
- [ ] Render favorite cards above the existing static product panels. Show project name/domain, assigned client if present, state badges, `Abrir proyecto`, and only launchable Blogger/statistics/public-site shortcuts.
- [ ] Add the Samuel Coach Blogger shortcut without replacing its academy panel.
- [ ] Run the focused tests and verify the empty-favorites state invites the administrator to use the Projects catalog.
- [ ] Commit with `git commit -m "feat: add favorite projects to admin home"`.

## Task 5: Turn each project page into an operational workspace

**Files:**

- Create: `src/components/admin/project-tool-grid.tsx`
- Modify: `src/app/paneladmin/(protected)/proyectos/page.tsx`
- Modify: `src/app/paneladmin/(protected)/proyectos/[id]/page.tsx`
- Modify: `tests/project-admin-ui.test.mjs`

- [ ] Add failing UI tests requiring catalog capability badges, high-value actions, and a favorite control without hard-coding Sport Massage, aGama or Samuel Coach.
- [ ] Add failing project-page tests requiring this order: identity/favorite control, operational tools, client access, warnings, secondary configuration, audit history.
- [ ] Run `node --test tests/project-admin-ui.test.mjs` and confirm the assertions fail.
- [ ] Implement reusable tool cards with explicit active/available/unavailable/misconfigured states and disabled actions for incomplete configuration.
- [ ] Reorder the project page, preserving both existing forms and audit history. Use a `details` section or equivalent secondary visual treatment for configuration.
- [ ] Update catalog cards to show capability badges and links resolved by `buildProjectTools`.
- [ ] Run `node --test tests/project-admin-ui.test.mjs tests/project-data-contract.test.mjs` and confirm they pass.
- [ ] Commit with `git commit -m "feat: make project pages operational workspaces"`.

## Task 6: Reconcile registered sites without overwriting project data

**Files:**

- Create: `src/lib/projects/reconciliation.mjs`
- Create: `src/lib/projects/reconciliation-module.d.ts`
- Create: `tests/project-reconciliation.test.mjs`
- Modify: `src/lib/data/projects.ts`
- Modify: `src/app/paneladmin/(protected)/proyectos/page.tsx`

Define a read-only reconciliation result:

```ts
type ProjectRegistryIssue = {
  kind: "missing-project" | "missing-registry-site" | "domain-mismatch";
  projectId?: string;
  siteKey?: string;
  message: string;
};
```

- [ ] Write failing tests that compare database projects with the registry, identify a missing Sport Massage/aGama/Samuel Coach record, tolerate normalized `www.` domain differences, and never mutate assignments or capabilities.
- [ ] Run `node --test tests/project-reconciliation.test.mjs` and confirm failure.
- [ ] Implement the pure comparison and expose its warnings to administrators in the Projects catalog.
- [ ] Keep repair as an explicit later administrator action; do not auto-create or auto-activate projects during page rendering.
- [ ] Run `node --test tests/project-reconciliation.test.mjs tests/site-registry.test.mjs tests/project-admin-ui.test.mjs` and confirm they pass.
- [ ] Commit with `git commit -m "feat: surface project registry reconciliation"`.

## Task 7: Verify and open the WF Studio pull request

**Files:** No new product files unless verification finds a defect.

- [ ] Run `npm test`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.
- [ ] Start the app against a non-production/test configuration and manually verify: no favorites, add/remove favorite, Samuel Coach Blogger shortcut, complete project catalog, operational-first project page, and unavailable-tool warnings.
- [ ] Inspect `git diff --check`, `git status --short`, and the final diff for secrets or unrelated changes.
- [ ] Push the dedicated branch and open a Pull Request against `main`; attach the PR to the task.
