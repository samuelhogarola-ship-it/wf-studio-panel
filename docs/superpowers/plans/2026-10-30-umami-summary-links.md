# Umami Summary Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace duplicated administrator-side analytics explorers with one consistent WF Panel summary that links directly to each website in its correct Umami instance.

**Architecture:** Keep the existing `UmamiAnalyticsPanel` as the summary UI and add a cached single-site server facade keyed by the canonical site registry. Existing operational panel pages keep their grouped summaries, while the generic administrator project statistics route switches from the custom explorer to the exact single-site summary. Client routes keep their current internal analytics and receive no external Umami link in this phase.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript/ES modules, Umami API, Node test runner, ESLint.

**Spec:** `docs/superpowers/specs/2026-10-30-umami-summary-links-design.md`

## Global Constraints

- Administrative links must resolve to `/websites/{websiteId}` on the site's configured `personal` or `agama` Umami base URL.
- No Umami credentials, bearer tokens or passwords may enter client components or client API responses.
- Direct links must rely only on Umami's normal per-origin browser session; WF Panel must not append credentials, tokens or auto-login parameters.
- Client project analytics must not gain an external Umami link in this phase.
- Missing connections or website IDs degrade only the affected summary and never produce an invented link.
- Do not change website trackers, Umami properties, Supabase data or production configuration.

## Review Focus

- A `reports-only` site opened through the generic project route must resolve only that site, not aggregate every reports-only site; pin in Task 1.
- A runtime-resolved website ID must generate the same direct link as an environment-provided ID; pin in Task 1.
- A personal site and an Agama site must use different Umami origins without crossing reports; pin in Task 1.
- Direct links must remain ordinary external links (`target="_blank"`, safe `rel`) so each Umami origin can reuse its own existing session cookie; pin in Task 1.
- An unavailable site must render its isolated status without an `Abrir Umami` URL containing `undefined`; pin in Task 1.
- Client routes must retain analytics but never import or render the administrator summary/link component; pin in Task 3.

---

### Task 1: Single-site Umami summary facade

**Files:**
- Modify: `src/lib/data/umami-dashboard.ts`
- Create: `src/components/admin/site-analytics-section.tsx`
- Modify: `src/components/admin/umami-analytics-panel.tsx`
- Test: `tests/umami-panel-ui.test.mjs`
- Test: `tests/umami-core.test.mjs`

**Interfaces:**
- Consumes: `getConfiguredUmamiSites(env)`, `getUmamiConnections(env)`, `fetchAllUmamiPanelData(...)`, `UmamiAnalyticsPanel`.
- Produces: `getSiteAnalytics(siteKey: string): Promise<UmamiSiteReport[]>` and `SiteAnalyticsSection({ siteKey }: { siteKey: string })`.

- [ ] **Step 1: Write failing tests for exact site selection and direct links**

Add tests asserting:

```js
assert.deepEqual(selectedReports.map(report => report.site.key), ['webfuengirola'])
assert.match(personalHtml, /href="https:\/\/analytics\.example\/websites\/wf-id"/)
assert.match(agamaHtml, /href="https:\/\/agama-analytics\.example\/websites\/todo-id"/)
assert.match(personalHtml, /target="_blank"/)
assert.doesNotMatch(personalHtml, /password=|token=|authorization=/i)
assert.doesNotMatch(unavailableHtml, /websites\/undefined|Abrir Umami/)
```

Cover both an environment-provided ID and an ID returned by `resolveUmamiSites`.

- [ ] **Step 2: Run focused tests and confirm the missing facade/link behavior fails**

Run: `node --test tests/umami-panel-ui.test.mjs tests/umami-core.test.mjs`

Expected: FAIL because `getSiteAnalytics` and `SiteAnalyticsSection` do not exist or the unavailable-link assertion is not yet guaranteed.

- [ ] **Step 3: Implement `getSiteAnalytics(siteKey: string): Promise<UmamiSiteReport[]>`**

Add a cache keyed by `siteKey`. Select exactly one canonical configured site before calling `fetchAllUmamiPanelData`; return an empty array for an unknown key rather than widening the query.

- [ ] **Step 4: Implement `SiteAnalyticsSection({ siteKey })`**

Resolve the same two source base URLs currently used by `PanelAnalyticsSection`, fetch only the requested report, and render `UmamiAnalyticsPanel`. Keep credentials confined to the server facade.

- [ ] **Step 5: Harden the direct-link rendering**

Keep the current `sourceUrl + /websites/{websiteId}` behavior, but render `Abrir Umami` only when a report has both a valid configured source URL and a non-empty resolved website ID.

- [ ] **Step 6: Run focused tests**

Run: `node --test tests/umami-panel-ui.test.mjs tests/umami-core.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/data/umami-dashboard.ts src/components/admin/site-analytics-section.tsx src/components/admin/umami-analytics-panel.tsx tests/umami-panel-ui.test.mjs tests/umami-core.test.mjs
git commit -m "feat: add direct Umami site summaries"
```

### Task 2: Remove duplicated advanced analytics from administrator surfaces

**Files:**
- Modify: `src/app/paneladmin/(protected)/dashboard/page.tsx`
- Modify: `src/app/paneladmin/(protected)/vivir-en-fuengirola/page.tsx`
- Modify: `src/app/paneladmin/(protected)/conoce-fuengirola/page.tsx`
- Modify: `src/app/paneladmin/(protected)/samuel-coach/page.tsx`
- Modify: `src/app/paneladmin/(protected)/vokabel-world/page.tsx`
- Modify: `src/app/paneladmin/(protected)/superentrenador/pt/page.tsx`
- Modify: `src/app/paneladmin/(protected)/todoplastico/page.tsx`
- Modify: `src/app/paneladmin/(protected)/proyectos/[id]/estadisticas/page.tsx`
- Delete: `src/components/admin/authorized-admin-analytics-panel.tsx`
- Delete: `src/components/admin/advanced-project-analytics-panel.tsx`
- Test: `tests/umami-panel-ui.test.mjs`

**Interfaces:**
- Consumes: `PanelAnalyticsSection({ panelKey })` for existing grouped operational pages and `SiteAnalyticsSection({ siteKey })` from Task 1 for an exact project.
- Produces: administrator pages with one summary surface and no `ProjectAnalyticsPanel` mount.

- [ ] **Step 1: Replace the old route-source assertions with the intended administrator contract**

For the seven operational pages, assert each still mounts its exact `PanelAnalyticsSection` and does not import `AuthorizedAdminAnalyticsPanel`. For the generic project route, assert it mounts `SiteAnalyticsSection` with `target.registryKey` and does not import `ProjectAnalyticsPanel`.

- [ ] **Step 2: Run the UI contract test and confirm it fails**

Run: `node --test tests/umami-panel-ui.test.mjs`

Expected: FAIL because the operational pages and generic project route still mount the advanced explorer.

- [ ] **Step 3: Remove `AuthorizedAdminAnalyticsPanel` from the seven operational pages**

Delete only the import and rendered component. Preserve each existing `PanelAnalyticsSection`, `Suspense` fallback and surrounding operational UI.

- [ ] **Step 4: Switch administrator project statistics to `SiteAnalyticsSection`**

After the existing `resolveAdminAnalyticsTarget(project.id)` authorization, pass `target.registryKey` to the single-site server component. Preserve invalid-configuration handling and the project back link.

- [ ] **Step 5: Delete the now-unused administrator advanced-wrapper components**

Delete `authorized-admin-analytics-panel.tsx` and `advanced-project-analytics-panel.tsx` only after `rg` confirms no remaining imports.

- [ ] **Step 6: Run administrator analytics tests**

Run: `node --test tests/umami-panel-ui.test.mjs tests/project-analytics-resolution.test.mjs tests/project-admin-ui.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/paneladmin src/components/admin tests/umami-panel-ui.test.mjs
git commit -m "refactor: delegate advanced analytics to Umami"
```

### Task 3: Preserve client isolation and document the future handoff

**Files:**
- Modify: `tests/client-analytics-access.test.mjs`
- Modify: `tests/client-project-routes.test.mjs`
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-10-30-umami-summary-links-design.md`

**Interfaces:**
- Consumes: the unchanged `ProjectAnalyticsPanel` client route and the administrator-only `SiteAnalyticsSection`.
- Produces: an explicit tested boundary: internal client analytics now, per-site Share URL later.

- [ ] **Step 1: Add failing/guard tests for the client boundary**

Assert the client statistics route still imports and renders `ProjectAnalyticsPanel`, does not import `SiteAnalyticsSection` or `UmamiAnalyticsPanel`, and does not contain `Abrir Umami`, `/websites/` or either administrative Umami origin.

- [ ] **Step 2: Run client analytics tests**

Run: `node --test tests/client-analytics-access.test.mjs tests/client-project-routes.test.mjs`

Expected: PASS if the administrator refactor remained isolated; any failure identifies accidental link exposure that must be removed before continuing.

- [ ] **Step 3: Document current and future access**

Update the analytics README section to state that administrator summaries link to the exact Umami website, client routes do not expose that link yet, and future client enablement uses a revocable read-only Share URL rather than administrator credentials.

- [ ] **Step 4: Run all targeted analytics and security tests**

Run: `node --test tests/umami-panel-ui.test.mjs tests/umami-core.test.mjs tests/project-analytics-resolution.test.mjs tests/client-analytics-access.test.mjs tests/client-project-routes.test.mjs tests/security.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/superpowers/specs/2026-10-30-umami-summary-links-design.md tests/client-analytics-access.test.mjs tests/client-project-routes.test.mjs
git commit -m "docs: define Umami client analytics handoff"
```

### Task 4: Full verification and integration readiness

**Files:**
- Modify only files required by failures attributable to Tasks 1-3.

**Interfaces:**
- Consumes: all deliverables from Tasks 1-3.
- Produces: a green, reviewable branch with no production-side changes.

- [ ] **Step 1: Run repository verification**

Run:

```bash
npm test
npm run typecheck
npm run lint
npm run build
git diff --check
```

Expected: every command exits 0; existing intentional skips remain documented by the test runner.

- [ ] **Step 2: Inspect final scope**

Run: `git status --short && git diff --stat main...HEAD && rg -n "AuthorizedAdminAnalyticsPanel|AdvancedProjectAnalyticsPanel" src tests`

Expected: only planned files changed; the removed wrappers have no references; client routes still use the internal panel.

- [ ] **Step 3: Commit any verification-only corrections**

```bash
git add <only-files-required-by-verification>
git commit -m "fix: complete Umami summary link verification"
```

Skip this commit when no corrections were needed.
