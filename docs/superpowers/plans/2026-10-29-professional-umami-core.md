# Professional Umami Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable Umami instrumentation core and a professional WF-Panel explorer that can combine business section, content language, device, source, market, and event without touching Área cliente.

**Architecture:** `core-general` owns the browser runtime and the validated analytics profile contract. Web Fuengirola supplies only its route/event profile and consumes that runtime. WF-Panel reads the same safe profile, builds server-side Umami filters, precomputes useful section/language summaries, and runs high-cardinality drilldowns on demand.

**Tech Stack:** Browser JavaScript without runtime dependencies, Node.js test runner, static HTML/JavaScript, Next.js 15, React, TypeScript, Umami HTTP API.

**Spec:** `docs/superpowers/specs/2026-10-29-professional-umami-core-design.md`

## Global Constraints

- Área cliente, `portal.webfuengirola.com`, and its outbound link are excluded from instrumentation and UI.
- Tracking remains anonymous and cookieless; do not add PII, `distinctId`, or user-level profiling.
- One Umami website property remains the source of truth for each public website.
- Content language is derived from controlled route rules; browser language remains a separate Umami dimension.
- Browser-supplied filter values never become regular expressions or registry keys.
- Existing Umami environment names and public configuration remain backward compatible.
- No direct reads from Umami's internal database schema.
- Each repository uses a dedicated branch and Pull Request; never implement this directly on `main`.
- Preserve unrelated user changes and verify upstream state before editing each repository.

## Review Focus

- Overlapping route rules: the most specific exact/prefix match must win, with no accidental classification of `/en/blog/` as Spanish.
- Hidden or suspended tabs: engagement time must pause while `document.visibilityState !== "visible"` and emit each threshold at most once.
- Duplicate initialization: repeated `init()` or event binding must not load a second tracker, add duplicate listeners, or double-count events.
- Tampered explorer queries: unknown sections, languages, devices, sources, events, and raw regex-like values must fail closed or normalize to the unfiltered view.
- Partial Umami support: unavailable optional metrics or event-data endpoints must produce an explicit unavailable state while core traffic remains usable.

---

### Task 1: Define the reusable analytics profile contract in `core-general`

**Files:**
- Create: `src/analytics/profile.js`
- Modify: `src/index.js`
- Modify: `package.json`
- Test: `test/analytics-profile.test.js`

**Interfaces:**
- Produces: `ANALYTICS_SCHEMA_VERSION = 1`.
- Produces: `normalizeAnalyticsProfile(input): AnalyticsProfile`.
- Produces: `resolveAnalyticsContext(profile, { pathname, documentLanguage }): { contentLanguage, section }`.
- `AnalyticsProfile` contains `schemaVersion`, `languages`, `sections`, `allowedEvents`, `allowedContextKeys`, and `excludedDestinations`.
- Route matching accepts only normalized `exact` paths and `prefixes`; it does not accept caller-provided regex.

- [ ] **Step 1: Write failing profile tests**

Add tests proving that invalid keys/paths are rejected, duplicate keys are rejected, unknown properties are removed or rejected consistently, longest matching prefix wins, exact matches beat prefixes, `/en/blog/post/` resolves to English + Blog, and excluded portal destinations remain present but inert data.

- [ ] **Step 2: Run the profile test and verify RED**

Run: `node --test test/analytics-profile.test.js`

Expected: FAIL because `src/analytics/profile.js` and its exports do not exist.

- [ ] **Step 3: Implement the minimal profile normalizer and resolver**

Keep the module dependency-free. Normalize paths to a leading slash, cap labels/keys/path counts and lengths, sort candidates by specificity, and return empty strings when no rule matches.

- [ ] **Step 4: Export the contract**

Export it from `src/index.js` and add `./analytics/profile` to `package.json#exports`.

- [ ] **Step 5: Verify GREEN**

Run: `node --test test/analytics-profile.test.js && npm run check && npm run lint`

Expected: all commands pass.

- [ ] **Step 6: Commit Task 1**

```bash
git add src/analytics/profile.js src/index.js package.json test/analytics-profile.test.js
git commit -m "feat: define reusable analytics profiles"
```

### Task 2: Build the dependency-free browser runtime in `core-general`

**Files:**
- Create: `src/analytics/umami-browser.js`
- Create: `test/umami-browser.test.js`
- Modify: `package.json`
- Modify: `README.md`

**Interfaces:**
- Consumes: normalized profile shape from Task 1, serialized as browser configuration.
- Produces globals: `window.UmamiAnalyticsCore` and the exact alias `window.WFAnalytics`.
- Produces methods: `init(config)`, `trackEvent(name, data)`, `trackPageview(path, title)`, `bindAutoEvents(options?)`, `grantConsent()`, `revokeConsent()`, `_reset()`.
- `init(config)` accepts `websiteId`, `scriptSrc`, `hostUrl`, `domains`, `autoTrack`, `profile`, and optional `engagementThresholds`.

- [ ] **Step 1: Write failing runtime tests in a VM-backed fake browser**

Test one behavior per case:

- one script element is added for a valid website ID;
- a missing/placeholder ID remains inert;
- queued custom events flush after tracker load;
- `WFAnalytics === UmamiAnalyticsCore`;
- event data includes `schemaVersion`, `contentLanguage`, and `section` from the current path;
- disallowed event names and context fields are dropped;
- `trackPageview()` uses a pageview payload instead of creating a custom event named `pageview`;
- repeated `init()` and `bindAutoEvents()` remain idempotent;
- hidden-tab time does not advance engagement;
- 15/30/60/120-second thresholds emit once each after visible elapsed time;
- excluded destinations, including Área cliente, never emit a click event.

- [ ] **Step 2: Run runtime tests and verify RED**

Run: `node --test test/umami-browser.test.js`

Expected: FAIL because the runtime does not exist.

- [ ] **Step 3: Implement loader, queue, aliases, and safe context**

Use classic browser JavaScript without imports so the file can be copied into static sites. Keep the old loader semantics and add typed queue entries for pageviews versus custom events.

- [ ] **Step 4: Implement idempotent declarative events and engagement thresholds**

`bindAutoEvents()` handles elements with `data-analytics-event` and accepts a site-owned `inferEvent(element)` callback. Engagement uses visible elapsed time and clears all timers/listeners in `_reset()`.

- [ ] **Step 5: Export the browser asset path and document the public API**

Add `./analytics/umami-browser` to package exports and document the two globals, event-data privacy rules, and threshold semantics.

- [ ] **Step 6: Verify GREEN**

Run: `node --test test/umami-browser.test.js && npm test && npm run check && npm run lint && npm run format:check`

Expected: complete `core-general` suite passes.

- [ ] **Step 7: Commit Task 2**

```bash
git add src/analytics/umami-browser.js test/umami-browser.test.js package.json README.md
git commit -m "feat: add reusable Umami browser runtime"
```

### Task 3: Extend canonical site onboarding with analytics profiles

**Files:**
- Modify: `src/sites/registry.js`
- Modify: `scripts/site-onboard.mjs`
- Modify: `docs/site-onboarding.md`
- Modify: `README.md`
- Test: `test/site-registry.test.js`
- Test: `test/site-onboard.test.js`

**Interfaces:**
- Consumes: `normalizeAnalyticsProfile()` from Task 1.
- Produces manifest field: `site.analytics.profile` when supplied.
- Produces CLI option: `--analytics-profile /absolute/path/profile.json`.
- Produces installed files: `umami-analytics-core.js` and `analytics-profile.json` in the target site when the option is used.
- Produces result field: `analyticsInstalled: boolean`.

- [ ] **Step 1: Write failing registry tests**

Assert that profiles survive normalize/upsert round trips, an omitted profile preserves old manifests exactly, and invalid profiles fail before writes.

- [ ] **Step 2: Run registry tests and verify RED**

Run: `node --test test/site-registry.test.js`

Expected: FAIL because analytics profiles are not preserved.

- [ ] **Step 3: Implement manifest profile preservation**

Normalize only through Task 1 and keep all existing analytics aliases/source fields unchanged.

- [ ] **Step 4: Write failing onboarding tests**

Assert that `--analytics-profile` copies the canonical browser file, writes normalized JSON, updates both manifests, remains idempotent, and performs no partial write for an invalid profile.

- [ ] **Step 5: Run onboarding tests and verify RED**

Run: `node --test test/site-onboard.test.js`

Expected: FAIL because the option and copied files do not exist.

- [ ] **Step 6: Implement onboarding and documentation**

Resolve the profile path absolutely, validate before any write, and use the existing copy/write patterns. Document that website IDs and private credentials never belong in the profile.

- [ ] **Step 7: Verify GREEN**

Run: `node --test test/site-registry.test.js test/site-onboard.test.js && npm test && npm run lint && npm run format:check`

Expected: all pass.

- [ ] **Step 8: Commit Task 3 and open the `core-general` PR**

```bash
git add src/sites/registry.js scripts/site-onboard.mjs docs/site-onboarding.md README.md test/site-registry.test.js test/site-onboard.test.js
git commit -m "feat: onboard sites with analytics profiles"
```

Push the dedicated branch and open a PR against `main`; do not merge before its checks pass.

### Task 4: Adopt the common runtime in Web Fuengirola

**Files:**
- Create: `analytics-profile.json`
- Replace from canonical source: `umami-analytics-core.js`
- Modify: `script.js`
- Modify: `tests/commercial-analytics.test.mjs`
- Modify: `tests/umami-config.test.mjs`
- Create: `tests/umami-runtime-integration.test.mjs`
- Modify: `docs/umami-integration-runbook.md`

**Interfaces:**
- Consumes: Task 2 runtime and Task 3 profile format.
- Profile languages: `es`, `en`, `de`, `fi` using exact/prefix route rules.
- Profile sections: `home`, `services`, `portfolio`, `blog`, `solidarity`.
- Allowed events: `language_switch`, `blog_to_landing`, `email_click`, `phone_click`, `form_start`, `form_submit`, `form_error`, `audit_request`, and the four engagement events.
- Excluded destination: `https://portal.webfuengirola.com`.

- [ ] **Step 1: Inspect branch/worktree/upstream before editing**

Run: `git status --short --branch && git fetch origin && git rev-list --left-right --count HEAD...origin/main`

Expected: dedicated branch based on current `origin/main`; stop and report if unrelated changes or divergence exist.

- [ ] **Step 2: Write failing profile and runtime integration tests**

Assert that representative Spanish/English/German/Finnish URLs resolve correctly; translated portfolio and blog paths map to the same sections; every existing commercial event is allowlisted; `WFAnalytics` is provided; portal links do not emit; event payloads contain no form PII.

- [ ] **Step 3: Run targeted tests and verify RED**

Run: `node --test tests/umami-runtime-integration.test.mjs tests/commercial-analytics.test.mjs tests/umami-config.test.mjs`

Expected: FAIL because the common profile/runtime is not installed and the alias is missing.

- [ ] **Step 4: Add the real Web Fuengirola profile**

Use explicit route lists/prefixes from the repository. Do not infer content language from `navigator.language`, and do not classify legal/contact/portal URLs as business sections.

- [ ] **Step 5: Replace the local loader and update initialization**

Load both public configuration and `analytics-profile.json`, call `UmamiAnalyticsCore.init()` once, then bind the existing site-specific event inference through the common runtime. Remove the duplicate delegated listener from `script.js` after equivalent tests exist.

- [ ] **Step 6: Preserve current form and commercial event calls**

The existing `WFAnalytics.trackEvent()` calls should work unchanged through the alias. Confirm that `contact-form.js` never sends user-entered values.

- [ ] **Step 7: Verify GREEN and full website checks**

Run: `node --test tests/umami-runtime-integration.test.mjs tests/commercial-analytics.test.mjs tests/umami-config.test.mjs && npm run test:unit && npm run check && npm run lint && npm run format:check`

Expected: all pass; if repository scripts differ, use the equivalent documented full commands and record them in the PR.

- [ ] **Step 8: Commit and open the Web Fuengirola PR**

```bash
git add analytics-profile.json umami-analytics-core.js script.js tests/commercial-analytics.test.mjs tests/umami-config.test.mjs tests/umami-runtime-integration.test.mjs docs/umami-integration-runbook.md
git commit -m "feat: adopt professional Umami instrumentation"
```

Push the dedicated branch and open a PR after the `core-general` PR is reviewable.

### Task 5: Add reusable profile-driven filters and breakdowns to WF-Panel

**Files:**
- Create: `src/lib/analytics/analytics-profile.mjs`
- Create: `src/lib/analytics/analytics-profile-module.d.ts`
- Modify: `src/lib/sites/manifest.ts`
- Modify: `src/config/sites.json`
- Modify: `src/lib/analytics/umami-dashboard.mjs`
- Modify: `src/lib/analytics/umami-dashboard-module.d.ts`
- Test: `tests/umami-dashboard.test.mjs`
- Test: `tests/site-registry.test.mjs`

**Interfaces:**
- Consumes: the same serialized profile shape from `core-general`.
- Produces: `getAnalyticsDimensions(projectKey)` with safe language/section/event options.
- Produces: `resolveAnalyticsDrilldown(projectKey, input)` returning selected dimension keys plus server-built Umami filters.
- Extends `fetchUmamiDashboard(options)` with `section`, `contentLanguage`, `device`, `referrer`, and `event`.
- Extends successful dashboard payload with `dimensions` and `breakdowns.sections` / `breakdowns.contentLanguages`.

- [ ] **Step 1: Write failing profile/filter tests**

Cover overlapping language/section filters, composition with all four existing market modes, fixed device allowlist, allowed events, bounded referrer values, unknown keys, raw regex attempts, and projects without profiles.

- [ ] **Step 2: Run dashboard tests and verify RED**

Run: `node --test tests/umami-dashboard.test.mjs tests/site-registry.test.mjs`

Expected: FAIL because profile dimensions and drilldown resolution do not exist.

- [ ] **Step 3: Implement the server-only profile adapter**

Generate anchored regex filters only from trusted exact/prefix rules. Allocate `path`, `path1`, etc. without overwriting market filters and force `match=all` when independent dimensions are combined.

- [ ] **Step 4: Write failing breakdown tests**

Assert that full loads request stats for each configured section/language concurrently, summary-only refresh skips those calls, unavailable optional breakdowns do not break base traffic, and results include pageviews, visitors, visits, bounce rate, pages/visit, and average visit seconds.

- [ ] **Step 5: Run tests and verify RED**

Run: `node --test tests/umami-dashboard.test.mjs`

Expected: FAIL because breakdowns are absent.

- [ ] **Step 6: Implement breakdown fetching and types**

Reuse authentication/website caches and summary normalization. Limit concurrency to the configured profile size and keep optional failures explicit per row.

- [ ] **Step 7: Verify GREEN**

Run: `node --test tests/umami-dashboard.test.mjs tests/site-registry.test.mjs && npm run typecheck`

Expected: pass.

- [ ] **Step 8: Commit Task 5**

```bash
git add src/lib/analytics/analytics-profile.mjs src/lib/analytics/analytics-profile-module.d.ts src/lib/sites/manifest.ts src/config/sites.json src/lib/analytics/umami-dashboard.mjs src/lib/analytics/umami-dashboard-module.d.ts tests/umami-dashboard.test.mjs tests/site-registry.test.mjs
git commit -m "feat: add profile-driven Umami drilldowns"
```

### Task 6: Expose safe drilldowns through the analytics API

**Files:**
- Modify: `src/app/api/analytics/[project]/route.ts`
- Modify: `src/components/admin/authorized-admin-analytics-panel.tsx`
- Modify: `src/app/cliente/(protected)/proyectos/[slug]/estadisticas/page.tsx`
- Test: `tests/client-analytics-access.test.mjs`

**Interfaces:**
- Consumes: Task 5 dimension keys and `fetchUmamiDashboard()` options.
- API query keys: `section`, `language`, `device`, `source`, `event`.
- Produces only sanitized selections and public dimension labels in browser responses.

- [ ] **Step 1: Write failing API authorization/validation tests**

Prove that both administrator and assigned client can request allowed combinations for their authorized project; unknown/tampered values never reach Umami; registry keys remain server-owned; and Web Fuengirola profile filters cannot be applied to another project.

- [ ] **Step 2: Run API tests and verify RED**

Run: `node --test tests/client-analytics-access.test.mjs`

Expected: FAIL because drilldown query keys are ignored.

- [ ] **Step 3: Implement bounded query parsing and forwarding**

Parse once at the API boundary, call Task 5 resolution server-side, and preserve existing public/admin error privacy behavior.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/client-analytics-access.test.mjs tests/umami-dashboard.test.mjs`

Expected: pass.

- [ ] **Step 5: Commit Task 6**

```bash
git add src/app/api/analytics/[project]/route.ts src/components/admin/authorized-admin-analytics-panel.tsx src/app/cliente/(protected)/proyectos/[slug]/estadisticas/page.tsx tests/client-analytics-access.test.mjs
git commit -m "feat: expose safe analytics drilldowns"
```

### Task 7: Build the professional SEO explorer in WF-Panel

**Files:**
- Modify: `src/components/analytics/project-analytics-panel.tsx`
- Test: `tests/umami-panel-ui.test.mjs`
- Modify: `docs/deliveries/2026-10-29-webfuengirola-umami-audit.md`

**Interfaces:**
- Consumes: `dashboard.dimensions`, `dashboard.breakdowns`, and the Task 6 API query contract.
- Produces overview tables for section and content language.
- Produces cumulative explorer filters for market, section, content language, device, source, and event.
- Keeps the existing Umami language metric labelled explicitly as `Idioma del navegador`.

- [ ] **Step 1: Write failing UI behavior tests**

Assert that the source renders distinct content/browser language labels, every configured section summary, cumulative filters, active filter chips, reset action, loading/error states, unavailable optional metrics, percentage shares, and no Área cliente option.

- [ ] **Step 2: Run UI tests and verify RED**

Run: `node --test tests/umami-panel-ui.test.mjs`

Expected: FAIL because the explorer and breakdown tables are absent.

- [ ] **Step 3: Implement the section/language overview**

Prioritize business-readable labels and show count + share before secondary KPIs. Clearly distinguish zero traffic from unavailable instrumentation.

- [ ] **Step 4: Implement cumulative explorer controls**

Keep selections URL-query-backed inside the analytics request, reset all filters predictably, abort stale requests using the existing coordinator, and preserve market selection behavior.

- [ ] **Step 5: Implement events and engagement quality views**

Group commercial events separately from engagement thresholds and explain thresholds as reached milestones, not exact exit duration.

- [ ] **Step 6: Verify GREEN and accessibility**

Run: `node --test tests/umami-panel-ui.test.mjs tests/client-analytics-access.test.mjs && npm run typecheck && npm run lint`

Expected: pass with labelled controls, keyboard operation, and no duplicate headings.

- [ ] **Step 7: Commit Task 7**

```bash
git add src/components/analytics/project-analytics-panel.tsx tests/umami-panel-ui.test.mjs docs/deliveries/2026-10-29-webfuengirola-umami-audit.md
git commit -m "feat: add professional SEO analytics explorer"
```

### Task 8: Cross-repository verification and delivery

**Files:**
- Modify as evidence requires: PR descriptions and delivery documentation only.

**Interfaces:**
- Consumes all previous tasks.
- Produces three passing PRs, ordered `core-general` → Web Fuengirola → WF-Panel.

- [ ] **Step 1: Run full `core-general` verification**

Run: `npm test && npm run check && npm run lint && npm run format:check && npm run audit:deps`

Expected: all pass; document any environment-only secret scan separately.

- [ ] **Step 2: Run full Web Fuengirola verification**

Run every documented unit, integration, lint, format, security, and build command. Confirm the generated/public core matches the reviewed canonical runtime and that no secret or real website ID was newly committed.

- [ ] **Step 3: Run full WF-Panel verification**

Run: `npm run typecheck && npm run lint && npm test && npm run build && git diff --check`

Expected: zero failures; report skipped tests exactly.

- [ ] **Step 4: Perform controlled browser verification before production claims**

Using a non-personal test visit, verify Spanish home, Finnish blog on a mobile viewport, one language switch, one blog-to-landing click, and one form-start event. Confirm expected requests in Umami without submitting personal form data.

- [ ] **Step 5: Verify the professional explorer**

Confirm that `Blog + Finnish + Mobile` returns the controlled traffic/event subset; content language and browser language remain separate; engagement thresholds are labelled honestly; Área cliente is absent.

- [ ] **Step 6: Open/refresh PRs and attach them to the task**

Each PR description includes scope, privacy guarantees, tests, rollout order, rollback, and the fact that historical missing events cannot be reconstructed.

- [ ] **Step 7: Deploy only in dependency order after approved PRs**

Deploy `core-general` consumer assets first, then Web Fuengirola instrumentation, then WF-Panel. Re-run the controlled verification after each production deployment and stop rollout on any double-counting or filter mismatch.
