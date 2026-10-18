# Client Portal Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make WF Studio a configurable multi-project client portal whose navigation and access are derived from each client's active project capabilities.

**Architecture:** Add RLS-protected project and capability records beside the existing client-owned billing and service tables. Preserve every current client in `legacy` mode, then opt clients into server-derived navigation only after their projects and capabilities are configured.

**Tech Stack:** Next.js 15, React 19, TypeScript, Supabase/PostgreSQL RLS, Umami, Node test runner.

**Spec:** `docs/superpowers/specs/2026-10-17-client-portal-platform-design.md`

## Global Constraints

- Existing invoices, packs, services, resources and direct tool URLs remain the source of truth and must not be rewritten.
- Clients may read only their own active, client-visible projects and active capabilities; UI filtering is not an authorization boundary.
- A newly registered project does not expose Blogger by default.
- Existing clients remain in `legacy` mode until explicitly migrated.
- Client-facing analytics errors must not disclose infrastructure details or environment-variable names.

## Review Focus

- Same email in more than one Supabase client namespace resolves only the `wf-studio` client row; Task 1 tests this.
- A dynamic client with zero accessible projects sees a controlled empty state, never legacy navigation; Task 4 tests this.
- Archived and client-hidden projects cannot be reached by guessed URLs; Tasks 1 and 4 test this.
- Invalid, localhost, credential-bearing or foreign-host launch URLs cannot become active; Tasks 2 and 3 test this.
- Client analytics requests for another client's slug return the same non-revealing `404` as an unknown slug; Task 5 tests this.

---

### Task 1: Project and capability data model

**Files:**
- Create: `supabase/migrations/202610170002_client_portal_platform.sql`
- Create: `tests/client-projects-migration.test.mjs`
- Modify: `src/lib/supabase/types.ts`

**Interfaces:**
- Produces: `client_projects`, `project_capabilities`, `project_capability_audit`, `clients.portal_mode`, and project-scoped RLS helpers.

- [ ] **Step 1: Write the failing migration contract tests**

Assert the exact enums/checks, unique normalized slug/domain indexes, administrator policies, client read-only policies, audit trigger, `legacy` default, project-scoped client lookup and idempotent seed/upsert behavior.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `node --test tests/client-projects-migration.test.mjs`  
Expected: FAIL because the migration and generated types do not exist.

- [ ] **Step 3: Implement the migration and types**

Use capability keys `products|domains|hosting|invoices|bonuses_reports|blogger|analytics`, capability states `unavailable|available|active`, project states `draft|active|archived`, and portal modes `legacy|dynamic`. Add an append-only audit trigger. Seed known registry projects without activating unvalidated Blogger destinations.

- [ ] **Step 4: Run migration and regression tests**

Run: `node --test tests/client-projects-migration.test.mjs tests/migrations.test.mjs tests/client-resources.test.mjs`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/202610170002_client_portal_platform.sql src/lib/supabase/types.ts tests/client-projects-migration.test.mjs
git commit -m "feat: add client project capability model"
```

### Task 2: Pure project, URL and navigation rules

**Files:**
- Create: `src/lib/projects/model.mjs`
- Create: `src/lib/projects/model-module.d.ts`
- Create: `src/lib/projects/portal-navigation.mjs`
- Create: `src/lib/projects/portal-navigation-module.d.ts`
- Create: `tests/client-portal-navigation.test.mjs`
- Create: `tests/project-url-policy.test.mjs`

**Interfaces:**
- Consumes: Task 1 enums.
- Produces: `validateProjectDestination(rawUrl, canonicalDomain, production)` and `buildPortalNavigation({ mode, projects, locale })`.

- [ ] **Step 1: Write failing URL-policy and navigation tests**

Cover legacy preservation, dynamic active-only items, deduplicated invoices/reports, project-specific Blogger/statistics, hidden archived projects, Spanish/English labels, allowed HTTPS canonical/`www` hosts, and rejection of HTTP production URLs, credentials, IPs, localhost and foreign domains.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/client-portal-navigation.test.mjs tests/project-url-policy.test.mjs`  
Expected: FAIL for missing modules.

- [ ] **Step 3: Implement the pure modules and declarations**

Return immutable serializable navigation data so desktop and mobile consume the same structure.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/client-portal-navigation.test.mjs tests/project-url-policy.test.mjs`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/projects tests/client-portal-navigation.test.mjs tests/project-url-policy.test.mjs
git commit -m "feat: derive portal navigation from project capabilities"
```

### Task 3: Project repository and administrator controls

**Files:**
- Create: `src/lib/data/projects.ts`
- Create: `src/lib/actions/projects.ts`
- Create: `src/components/admin/project-form.tsx`
- Create: `src/components/admin/project-filters.tsx`
- Create: `src/components/admin/project-capabilities-form.tsx`
- Create: `src/components/admin/project-client-access-form.tsx`
- Create: `src/app/paneladmin/(protected)/proyectos/[id]/page.tsx`
- Create: `tests/project-data-contract.test.mjs`
- Create: `tests/project-admin-ui.test.mjs`
- Modify: `src/app/paneladmin/(protected)/proyectos/page.tsx`
- Modify: `src/lib/auth.ts`
- Modify: `src/lib/i18n.ts`

**Interfaces:**
- Consumes: Tasks 1-2.
- Produces: `getAdminProjects`, `getAdminProject`, `getClientPortalContext`, `getAccessibleClientProject`, `getActiveClientCapability`, `clientHasActiveCapability`; project upsert, assignment, access, portal-mode and capability actions.

- [ ] **Step 1: Write failing data and administrator UI tests**

Assert filter behavior, active-destination validation, Blogger/analytics activation prerequisites, audit rendering, safe client assignment and refusal to enable dynamic mode without an accessible active project.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/project-data-contract.test.mjs tests/project-admin-ui.test.mjs`  
Expected: FAIL for missing repository/actions/detail page.

- [ ] **Step 3: Implement server-only project data and actions**

All mutations require `requireAdmin()`. Client reads use the session Supabase client so RLS remains authoritative.

- [ ] **Step 4: Implement inventory and project detail UI**

Replace registry-only cards with database-backed search/filtering, configuration warnings, seven capability cards and an exact preview of client-visible access.

- [ ] **Step 5: Verify GREEN and regressions**

Run: `node --test tests/project-data-contract.test.mjs tests/project-admin-ui.test.mjs tests/site-registry.test.mjs tests/panel-navigation.test.mjs`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/data/projects.ts src/lib/actions/projects.ts src/components/admin src/app/paneladmin/'(protected)'/proyectos src/lib/auth.ts src/lib/i18n.ts tests/project-data-contract.test.mjs tests/project-admin-ui.test.mjs
git commit -m "feat: manage client projects in Studio"
```

### Task 4: Dynamic Client Portal and route guards

**Files:**
- Create: `src/components/client/project-selector.tsx`
- Create: `src/app/cliente/(protected)/proyectos/page.tsx`
- Create: `src/app/cliente/(protected)/proyectos/[slug]/page.tsx`
- Create: `tests/client-project-routes.test.mjs`
- Modify: `src/app/cliente/page.tsx`
- Modify: `src/app/cliente/(protected)/layout.tsx`
- Modify: `src/components/layout/client-shell.tsx`
- Modify: `src/app/cliente/(protected)/dashboard/page.tsx`
- Modify: client pages for `facturas`, `bonos`, `packs`, `historial`, `informes` and `servicios`
- Modify: `src/lib/i18n.ts`

**Interfaces:**
- Consumes: `getClientPortalContext`, `getAccessibleClientProject`, `clientHasActiveCapability`, `buildPortalNavigation`.
- Produces: single-project direct entry, multi-project selector, guarded account pages and one shared navigation model.

- [ ] **Step 1: Write failing client-route tests**

Cover legacy behavior, one/multiple/zero project entry, identical desktop/mobile actions, inactive capability route guesses, archived projects and cross-client slugs.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/client-project-routes.test.mjs tests/client-portal-navigation.test.mjs`  
Expected: FAIL for missing routes and static shell behavior.

- [ ] **Step 3: Implement server-derived layout and project routes**

Keep overview, messaging and pending actions as baseline. Aggregate invoices and packs at client level; identify project-specific Blogger/statistics destinations explicitly.

- [ ] **Step 4: Guard existing account routes**

Use active capability checks before loading page data; unauthorized and unconfigured access redirects to the controlled project overview.

- [ ] **Step 5: Verify GREEN**

Run: `node --test tests/client-project-routes.test.mjs tests/client-portal-navigation.test.mjs tests/security.test.mjs`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/client src/components/layout/client-shell.tsx src/app/cliente src/lib/i18n.ts tests/client-project-routes.test.mjs
git commit -m "feat: add capability-aware client portal"
```

### Task 5: Client-authorized statistics

**Files:**
- Create: `src/app/cliente/(protected)/proyectos/[slug]/estadisticas/page.tsx`
- Create: `tests/client-analytics-access.test.mjs`
- Modify: `src/app/api/analytics/[project]/route.ts`
- Modify: `src/components/analytics/project-analytics-panel.tsx`
- Modify: `src/lib/analytics/umami-dashboard.mjs`
- Modify: `tests/umami-dashboard.test.mjs`

**Interfaces:**
- Consumes: active analytics capability and `analytics_registry_key` from Task 3.
- Produces: client-safe analytics access while preserving every current administrator key.

- [ ] **Step 1: Write failing authorization and sanitization tests**

Assert own-project success, cross-client/unknown identical `404`, inactive analytics rejection, retained admin access and sanitized upstream errors.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/client-analytics-access.test.mjs tests/umami-dashboard.test.mjs`  
Expected: FAIL because the API trusts only the static registry/admin flow.

- [ ] **Step 3: Implement client project resolution and statistics page**

Resolve client path slugs to registry keys only after RLS-backed capability authorization.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/client-analytics-access.test.mjs tests/umami-dashboard.test.mjs tests/umami-panel-ui.test.mjs`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/analytics src/app/cliente/'(protected)'/proyectos src/components/analytics src/lib/analytics tests/client-analytics-access.test.mjs tests/umami-dashboard.test.mjs
git commit -m "feat: expose project statistics to authorized clients"
```

### Task 6: Registration API, migration pilot and release gate

**Files:**
- Create: `src/app/api/projects/provision/route.ts`
- Create: `src/lib/projects/provisioning.mjs`
- Create: `src/lib/projects/provisioning-module.d.ts`
- Create: `tests/project-provisioning.test.mjs`
- Modify: `.env.example`
- Modify: `README.md`

**Interfaces:**
- Produces: authenticated idempotent project registration by normalized domain/slug and documented manual recovery workflow.

- [ ] **Step 1: Write failing provisioning tests**

Assert secret authentication, idempotency, no invitation, Blogger not active by default, safe retry and conflict reporting for a domain already owned by another project.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/project-provisioning.test.mjs`  
Expected: FAIL for missing endpoint/module.

- [ ] **Step 3: Implement provisioning and documentation**

Store only the secret's environment-variable name in docs; never commit a value. Include a manual administrator fallback.

- [ ] **Step 4: Run the full release gate**

Run: `npm test && npm run lint && npm run typecheck && npm run build`  
Expected: all commands PASS.

- [ ] **Step 5: Pilot migration**

Apply the migration in staging, backfill known projects, map an existing cooperative client, verify legacy clients are unchanged, then enable that client's `dynamic` mode.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/projects src/lib/projects .env.example README.md tests/project-provisioning.test.mjs
git commit -m "feat: provision websites into Studio"
```
