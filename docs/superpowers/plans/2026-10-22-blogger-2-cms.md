# Blogger 2.0 CMS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Sport Massage first as a complete independent Blogger product with remembered secure login and mobile editing, then turn the existing WF Studio Blogger into a profile-driven CMS and connect Vivir en Fuengirola, Conoce Fuengirola and TodoPlástico without changing their public URLs.

**Architecture:** WF Studio owns the normalized content contract, profile validation, administrator/client authorization and central editor. Existing Blogger storage is wrapped by an adapter, while external websites expose the same server-to-server content contract through project-specific adapters. Hosted editors retain direct site credentials and accept Studio's existing one-time launch tickets as a separate recovery entry.

**Tech Stack:** Next.js 15, React 19, TypeScript/ES modules, Supabase, plain browser JavaScript for the existing Blogger editor, Node test runner; Node 22 static Blogger service for Sport Massage.

**Spec:** `docs/superpowers/specs/2026-10-22-blogger-2-cms-design.md`

## Global Constraints

- Preserve every existing Blogger route, post URL and published document during the foundation rollout.
- `Blogger` means one post destination; `Blogger 2.0` means multiple configured content types/destinations over the same editor core.
- Profiles and adapter credentials are server-owned; browser configuration never contains secrets, filesystem roots, table names or unrestricted endpoints.
- Direct website credentials are independent from WF Studio credentials and are never copied, disclosed or reused by Studio.
- Studio/client-panel entry uses 60-second, single-use, audience-bound launch tickets and works without the direct password.
- A forgotten direct password is replaced, never recovered; portal access remains available to an authorized client.
- Existing content remains canonical in its current repository/database. Do not duplicate it into a new Studio content database.
- Activate capabilities only after direct login, portal launch, health, draft, preview and publish checks pass.
- Every repository uses its own dedicated `codex/` branch, commits and Pull Request; never mix repositories or modify dirty primary checkouts.
- Use test-driven development: every behavior change starts with a focused failing test, then minimal implementation, then the full repository suite.
- Treat Task 0 as a release gate. Do not begin the shared Blogger 2.0 foundation or other site adapters until Sport Massage passes its repository tests and mobile acceptance flow.

## Review Focus

- A profile containing unknown fields, duplicate type keys, duplicate destinations or unsafe public paths fails closed; Task 1 pins this.
- Existing simple Blogger posts containing legacy optional metadata round-trip without field loss; Task 2 pins this.
- An authorized user cannot select a different adapter, schema, site, project or type by changing API parameters; Task 3 pins this.
- Structured content with malformed URLs, unsafe HTML, repeated IDs or unsupported modules is rejected without losing the editor draft; Tasks 1 and 4 pin this.
- Direct credentials, handoff secrets and remote adapter errors never appear in browser configuration, logs or client-visible failures; Tasks 0, 3, 6, 7 and 8 pin this.

---

### Task 0: Ship the independent Sport Massage editor first

**Repositories:** `sportmassage` and `wf-studio-panel` in separate worktrees and commits.

**Sport Massage files:**
- Modify: `scripts/generate-site-release.mjs`
- Modify: `deploy/public-manifest.json`
- Modify: `deploy/nginx-blogger.conf.example`
- Modify: `docs/blogger-deployment.md`
- Modify: `admin/blogger/index.html`
- Modify: `admin/blogger/blogger-auth.js`
- Modify: `admin/blogger/styles.css`
- Modify: `scripts/blogger-launch-session.mjs`
- Modify: `scripts/post-manager-server.mjs`
- Modify: `tests/review-round-1-build.test.mjs`
- Modify: `tests/post-manager-server.test.mjs`
- Modify: `tests/blogger-browser-auth.test.mjs`
- Modify: `tests/final-review-security.test.mjs`
- Modify: `tests/site-integration.test.mjs`

**WF Studio files:**
- Modify: `src/config/sites.json`
- Modify: `.env.example`
- Modify: `tests/site-registry.test.mjs`
- Modify: `tests/blogger-tool-launch.test.mjs`

**Interfaces:**
- Produces direct Sport entry at `https://sportmassagefuengirola.com/admin/blogger/` instead of a Studio redirect.
- Uses direct username `sportsmassage`; the operator-supplied password is converted to `BLOGGER_DIRECT_PASSWORD_HASH` and never written to source, documentation, logs or test fixtures.
- Extends `POST /admin/blogger/login` with boolean `remember`; unchecked sessions remain short-lived, while checked sessions use a 30-day cookie and persistent server-side record in the ignored `.blogger-state` directory.
- Preserves `HttpOnly`, `Secure`, `SameSite=Strict`, exact-origin mutation checks, rate limits, session rotation and immediate logout revocation.
- Preserves browser password-manager support with `autocomplete="username"` and `autocomplete="current-password"`; no JavaScript, localStorage or source file stores credentials.
- Consumes existing `wf-blogger-handoff/v1` and `POST /api/tool-launch/exchange` for password-independent Studio/client-portal entry.

- [ ] **Step 1: Create isolated branches from current remote main in both repositories**

  Preserve both primary checkouts. Use `samuelhogarola-ship-it/sportmassage` as Sport Massage source of truth and the separate `wf-studio-panel` repository for Studio changes.

- [ ] **Step 2: Write the failing Sport release and remembered-session tests**

  Replace the generated-release redirect assertion with an allowlisted local-editor assertion. Add tests for `remember: true`, a 30-day cookie, restart persistence, expired-record pruning, session rotation, logout deletion, state-file mode and absence of passwords/tokens from audit and errors. Keep the existing short-session behavior for `remember: false`.

- [ ] **Step 3: Write the failing mobile/editor assertions**

  Require a default-enabled `Recordarme en este dispositivo` control, correct autocomplete attributes, 44 px touch targets, 16 px editable/input text, mobile-sticky save/publish controls, wrapping or horizontal scrolling toolbars, no page-level horizontal overflow and an explicit paste path that preserves safe common formatting while rejecting scripts and event attributes.

- [ ] **Step 4: Run the focused tests and confirm the intended failures**

  Run: `node --test tests/review-round-1-build.test.mjs tests/post-manager-server.test.mjs tests/blogger-browser-auth.test.mjs tests/site-integration.test.mjs tests/final-review-security.test.mjs`

  Expected: FAIL on the current redirect, in-memory-only 24-hour session limit and missing mobile/remember behavior.

- [ ] **Step 5: Serve the existing editor and implement persistent remembered sessions**

  Copy only allowlisted `admin/blogger` assets into immutable releases and keep API routes proxied to the local service. Store only random session identifiers plus metadata in an atomically written, permission-restricted `.blogger-state/sessions.json`; sign tokens, cap records, prune expiry and delete on logout. Never persist the password or its plaintext equivalent.

- [ ] **Step 6: Make the editor comfortable on mobile**

  Keep the proven WYSIWYG/image flow. Add the remember control, responsive post/editor navigation, touch-safe controls, non-clipping toolbars, mobile-sticky primary actions and safe paste normalization. Verify copy, paste, select, edit, save draft, upload/insert image and publish at 360 x 800 and 390 x 844.

- [ ] **Step 7: Complete the Sport handoff registry in WF Studio**

  Add Sport's exact HTTPS `launchUrl`, `healthUrl`, adapter capabilities and environment secret name. Assert no secret value enters `sites.json`, `.env.example`, browser serialization or logs. Keep capability activation tied to successful production health.

- [ ] **Step 8: Verify both repositories and perform the product acceptance flow**

  Sport: `npm test && npm run check && npm run build:site`.

  WF Studio: `node --test tests/site-registry.test.mjs tests/blogger-tool-launch.test.mjs && npm test`.

  Browser acceptance: direct login with the configured username and operator-provided password; create/edit a draft on mobile width; paste formatted text; publish; open the public URL; restart the service and confirm the remembered session remains; logout and confirm it is revoked; enter again from WF Studio without the direct password.

- [ ] **Step 9: Commit and open separate Pull Requests**

  Sport: `git commit -m "feat: ship independent Sport Blogger editor"`.

  WF Studio: `git commit -m "feat: complete Sport Blogger handoff"`.

  Stop and present the Sport product for acceptance before Task 1.

---

### Task 1: Normalized document and content-profile contracts

**Repository:** `wf-studio-panel`

**Files:**
- Create: `src/lib/blogger/content-model.mjs`
- Create: `src/lib/blogger/content-model-module.d.ts`
- Create: `src/lib/blogger/content-profiles.mjs`
- Create: `src/lib/blogger/content-profiles-module.d.ts`
- Create: `tests/blogger-content-model.test.mjs`
- Create: `tests/blogger-content-profiles.test.mjs`
- Modify: `src/lib/sites/registry.mjs`
- Modify: `src/lib/sites/registry-module.d.ts`

**Interfaces:**
- Produces: `normalizeContentDocument(input, context): ContentDocument` where `context` contains `siteKey` and one validated `ContentTypeProfile`.
- Produces: `parseContentProfile(site): ContentProfile | null`.
- Produces: `serializeContentProfileForBrowser(profile): BrowserContentProfile`.
- Produces: profile mode values exactly `'blogger' | 'cms'` and document status values exactly `'draft' | 'published' | 'archived'`.

- [ ] **Step 1: Write failing document-contract tests**

  Test a complete guide with rich body, hero image, sections, FAQs, sources, relations, premium CTA and SEO; assert trimming/defaults, stable structured IDs and exact normalized output. Test unsafe HTML/URLs, duplicate structured IDs, unknown keys and profile-disabled modules; assert controlled validation errors.

- [ ] **Step 2: Write failing profile-contract tests**

  Test simple Blogger and CMS profiles. Reject duplicate/invalid type keys, duplicate public bases, non-root-relative public bases, empty field sets, unknown modules and any browser serialization containing `adapter`, credentials, table names or endpoints.

- [ ] **Step 3: Run the focused tests**

  Run: `node --test tests/blogger-content-model.test.mjs tests/blogger-content-profiles.test.mjs`

  Expected: FAIL because the contract modules do not exist.

- [ ] **Step 4: Implement the contracts and registry validation**

  Keep validation pure and dependency-free. Rich HTML uses an explicit allowlist for headings, paragraphs, emphasis, links, lists, quotes, figures and images; reject scripts, event attributes, unsafe schemes and unknown structured fields.

- [ ] **Step 5: Verify focused and registry tests**

  Run: `node --test tests/blogger-content-model.test.mjs tests/blogger-content-profiles.test.mjs tests/site-registry.test.mjs`

  Expected: PASS.

- [ ] **Step 6: Commit**

  ```bash
  git add src/lib/blogger/content-model.mjs src/lib/blogger/content-model-module.d.ts src/lib/blogger/content-profiles.mjs src/lib/blogger/content-profiles-module.d.ts src/lib/sites/registry.mjs src/lib/sites/registry-module.d.ts tests/blogger-content-model.test.mjs tests/blogger-content-profiles.test.mjs
  git commit -m "feat: define Blogger 2.0 content contracts"
  ```

### Task 2: Adapter boundary and legacy Blogger compatibility

**Repository:** `wf-studio-panel`

**Files:**
- Create: `src/lib/blogger/adapters/registry.mjs`
- Create: `src/lib/blogger/adapters/registry-module.d.ts`
- Create: `src/lib/blogger/adapters/static-content.mjs`
- Create: `src/lib/blogger/adapters/static-content-module.d.ts`
- Create: `src/lib/blogger/adapters/signed-site.mjs`
- Create: `src/lib/blogger/adapters/signed-site-module.d.ts`
- Create: `tests/blogger-adapter-contract.test.mjs`
- Modify: `src/lib/blogger/content-store.mjs`
- Modify: `src/lib/blogger/content-store.d.ts`
- Modify: `tests/blogger-runtime-contract.test.mjs`

**Interfaces:**
- Consumes: Task 1 `ContentDocument`, `ContentProfile`, `ContentTypeProfile`.
- Produces: `resolveContentAdapter({ site, root, fetchImpl }): ContentAdapter`.
- Produces: adapter methods `list`, `read`, `saveDraft`, `publish`, `archive`, `uploadImage` and optional `listRelations`, all accepting `{ siteKey, typeKey, ... }`.
- Produces: `createSignedSiteAdapter({ siteKey, baseUrl, secret, fetchImpl })`; credentials remain server-only.

- [ ] **Step 1: Write the failing adapter contract suite**

  Use one shared conformance helper against the static adapter and a fake signed-site server. Assert list/read/draft/publish/archive/image shapes, timeout behavior, neutral remote errors, exact site/type binding and no secret leakage.

- [ ] **Step 2: Add failing legacy round-trip fixtures**

  Cover Samuel, Personal Trainer and Sport Massage metadata, including category, level, tags, language, translated languages and HTML/Markdown bodies. Assert no field or URL changes after read/save/read.

- [ ] **Step 3: Run focused tests**

  Run: `node --test tests/blogger-adapter-contract.test.mjs tests/blogger-runtime-contract.test.mjs tests/blogger-publisher.test.mjs`

  Expected: FAIL because the adapter registry does not exist.

- [ ] **Step 4: Implement the adapter registry and static wrapper**

  Delegate current file operations to `content-store.mjs`; do not duplicate path/security logic. The signed-site adapter uses only an HTTPS allowlisted base URL and a server environment secret resolved from the canonical site key.

- [ ] **Step 5: Verify focused tests and all existing Blogger tests**

  Run: `node --test tests/blogger-*.test.mjs`

  Expected: PASS with current simple Blogger behavior unchanged.

- [ ] **Step 6: Commit**

  ```bash
  git add src/lib/blogger/adapters src/lib/blogger/content-store.mjs src/lib/blogger/content-store.d.ts tests/blogger-adapter-contract.test.mjs tests/blogger-runtime-contract.test.mjs
  git commit -m "refactor: route Blogger storage through adapters"
  ```

### Task 3: Profile-driven Blogger content API

**Repository:** `wf-studio-panel`

**Files:**
- Create: `src/lib/blogger/content-context.ts`
- Create: `src/app/api/blogger/[siteKey]/content/config/route.ts`
- Create: `src/app/api/blogger/[siteKey]/content/[typeKey]/route.ts`
- Create: `src/app/api/blogger/[siteKey]/content/[typeKey]/[slug]/route.ts`
- Create: `src/app/api/blogger/[siteKey]/content/[typeKey]/[slug]/publish/route.ts`
- Create: `src/app/api/blogger/[siteKey]/content/[typeKey]/[slug]/images/route.ts`
- Create: `src/app/api/blogger/[siteKey]/content/[typeKey]/[slug]/images/[file]/route.ts`
- Create: `src/app/api/blogger/[siteKey]/content/[typeKey]/relations/route.ts`
- Create: `tests/blogger-content-api.test.mjs`
- Modify: `tests/blogger-authorization.test.mjs`
- Modify: `tests/blogger-mutation-security.test.mjs`

**Interfaces:**
- Consumes: Task 1 profile/document contracts and Task 2 `resolveContentAdapter`.
- Produces: `authorizeContentContext(siteKey, typeKey?): Promise<{ identity, project, site, profile, type?, adapter }>`.
- Produces: browser API under `/api/blogger/:siteKey/content` for sanitized config, list/create, read/update/archive, publish, complete image lifecycle and relation choices.

- [ ] **Step 1: Write failing authorization and parameter-binding tests**

  Cover administrator, assigned client, foreign client, inactive capability, unknown type, type from another site, archived project and browser attempts to inject adapter/table/base URL values.

- [ ] **Step 2: Write failing mutation and response tests**

  Require exact-origin JSON mutations, normalized validation errors, neutral adapter failures and sanitized config/responses. Assert draft success cannot be mistaken for publish success.

- [ ] **Step 3: Run focused tests**

  Run: `node --test tests/blogger-content-api.test.mjs tests/blogger-authorization.test.mjs tests/blogger-mutation-security.test.mjs`

  Expected: FAIL because content routes/context do not exist.

- [ ] **Step 4: Implement context resolution and routes**

  Resolve project, capability, site, profile and adapter entirely server-side. Re-run authorization on every request. Keep existing `/posts` and `/build` routes operational.

- [ ] **Step 5: Verify focused tests**

  Run the Step 3 command.

  Expected: PASS.

- [ ] **Step 6: Commit**

  ```bash
  git add src/lib/blogger/content-context.ts src/app/api/blogger tests/blogger-content-api.test.mjs tests/blogger-authorization.test.mjs tests/blogger-mutation-security.test.mjs
  git commit -m "feat: add profile-driven Blogger content API"
  ```

### Task 4: Blogger 2.0 editor mode

**Repository:** `wf-studio-panel`

**Files:**
- Create: `public/blogger/editor/content-profile.js`
- Create: `public/blogger/editor/structured-fields.js`
- Create: `tests/blogger-editor-profile.test.mjs`
- Modify: `public/blogger/editor/index.html`
- Modify: `public/blogger/editor/app.js`
- Modify: `public/blogger/editor/styles.css`
- Modify: `src/lib/blogger/editor.mjs`
- Modify: `next.config.ts`
- Modify: `tests/blogger-editor-routing.test.mjs`

**Interfaces:**
- Consumes: Task 3 browser config and API.
- Produces: `buildEditorFieldModel(profile, typeKey)` and pure structured collection helpers for sections, FAQs, sources and relations.
- Produces: a portable, versioned ES-module editor asset that accepts a same-origin config/API base from its host page; target websites load it without copying its source.
- Preserves: current editor target `/blogger/editor/index.html?siteKey=<siteKey>` for both modes.

- [ ] **Step 1: Write failing pure editor-model tests**

  Assert simple mode shows `Posts` with no type selector. Assert CMS mode switches exact fields/modules for Guide and News, preserves unsaved values per type, rejects type changes after first save and serializes structured collections without duplicate IDs. Assert a server validation error for malformed URLs or unsafe rich content leaves the complete local draft untouched and focuses the reported field.

- [ ] **Step 2: Add failing editor-source assertions**

  Require accessible content-type navigation, project/type identity, sections, FAQs, sources, relation controls, archive confirmation and draft/publish distinction. Assert WYSIWYG, inline images, Markdown/HTML and preview remain present. Require the public versioned module/CSS path to send public-code-only CORS headers while all content/auth APIs remain same-origin and credentialed.

- [ ] **Step 3: Run focused tests**

  Run: `node --test tests/blogger-editor-profile.test.mjs tests/blogger-editor-routing.test.mjs`

  Expected: FAIL for missing profile modules/UI.

- [ ] **Step 4: Implement profile-driven rendering**

  Extract only pure profile/structured-state logic; retain proven WYSIWYG/image logic. In simple mode continue using the existing API contract. In CMS mode use Task 3 routes and display only fields/modules declared by the profile. Resolve config/API URLs from an explicit same-origin host configuration so target `/admin/blogger` pages can load the versioned editor module from Studio while keeping credentials and content APIs on their own origin.

- [ ] **Step 5: Verify editor and Blogger regression tests**

  Run: `node --test tests/blogger-editor-profile.test.mjs tests/blogger-editor-routing.test.mjs tests/blogger-runtime-contract.test.mjs tests/blogger-publisher.test.mjs`

  Expected: PASS.

- [ ] **Step 6: Commit**

  ```bash
  git add public/blogger/editor src/lib/blogger/editor.mjs next.config.ts tests/blogger-editor-profile.test.mjs tests/blogger-editor-routing.test.mjs
  git commit -m "feat: add Blogger 2.0 editor mode"
  ```

### Task 5: Retired — superseded by the Task 0 Sport Massage release gate

This task is intentionally retained as a traceability marker. All Sport Massage scope, tests, deployment requirements and acceptance checks now live in Task 0 and must not be implemented a second time.

<!--

**Repositories:** `sportmassage` and `wf-studio-panel` in separate worktrees and commits.

**Sport Massage files:**
- Modify: `scripts/generate-site-release.mjs`
- Modify: `deploy/public-manifest.json`
- Modify: `deploy/nginx-blogger.conf.example`
- Modify: `docs/blogger-deployment.md`
- Modify: `tests/review-round-1-build.test.mjs`
- Modify: `tests/final-review-security.test.mjs`
- Modify: `tests/site-integration.test.mjs`
- Reuse unchanged unless a failing test proves otherwise: `admin/blogger/*`, `scripts/blogger-launch-session.mjs`, `scripts/post-manager-server.mjs`, `tests/post-manager-server.test.mjs`

**WF Studio files:**
- Modify: `src/config/sites.json`
- Modify: `.env.example`
- Modify: `tests/site-registry.test.mjs`
- Modify: `tests/blogger-tool-launch.test.mjs`

**Interfaces:**
- Consumes: existing `wf-blogger-handoff/v1`, `POST /api/tool-launch/exchange` and Sport's implemented direct-login/session service.
- Produces: live Sport endpoints `POST /admin/blogger/login`, `POST /admin/blogger/launch`, `GET /api/admin/session`, `POST /api/admin/logout`, `GET /.well-known/wf-blogger.json`, `GET /api/blogger/health`.

- [ ] **Step 1: Create isolated branches from current remote main in both repositories**

  Preserve the existing WF primary checkout and do not use `/Users/sam/Desktop/webs/webs2222/Sportmassage`, which is not the repository root. Use the `samuelhogarola-ship-it/sportmassage` repository.

- [ ] **Step 2: Change Sport tests first**

  Replace the assertion that generated `/admin/blogger/` redirects to Studio with assertions that the immutable release serves the local authenticated editor. Retain tests for separate password scope, Studio ticket exchange, rate limits, secure cookies, health redaction, rollback and no legacy WordPress/ZIP references.

- [ ] **Step 3: Run Sport tests to verify the intended failure**

  Run: `npm test`

  Expected: FAIL only where the current release generator overwrites the local editor with the Studio redirect.

- [ ] **Step 4: Serve the already implemented local editor in generated releases**

  Copy the allowlisted `admin/blogger` assets into the release, keep API paths proxied to `post-manager-server.mjs`, document password-hash rotation through `generate-blogger-password-hash.mjs`, and retain the portal handoff as password-independent recovery access.

- [ ] **Step 5: Add failing WF registry tests**

  Require Sport's exact HTTPS `launchUrl`, `healthUrl`, adapter/capabilities and environment secret name. Assert no secret value enters `sites.json`, `.env.example` or browser serialization.

- [ ] **Step 6: Configure the complete Sport handoff contract in WF Studio**

  Keep the capability inactive until production health succeeds. Do not generate or record production secret values.

- [ ] **Step 7: Verify both repositories**

  Sport: `npm test && npm run check && npm run build:site`.

  WF Studio: `node --test tests/site-registry.test.mjs tests/blogger-tool-launch.test.mjs && npm test`.

  Expected: PASS.

- [ ] **Step 8: Commit separately**

  Sport: `git commit -m "feat: restore dual-access Blogger editor"`.

  WF Studio: `git commit -m "feat: complete Sport Blogger handoff"`.

-->

### Task 6: Vivir en Fuengirola Guide and News adapter

**Repositories:** `vivir-en-fuengirola` and `wf-studio-panel` in separate worktrees and commits.

**Vivir files:**
- Create: `src/lib/wf-content/auth.ts`
- Create: `src/lib/wf-content/direct-session.ts`
- Create: `src/lib/wf-content/mapper.ts`
- Create: `src/app/admin/blogger/page.tsx`
- Create: `src/app/admin/blogger/login/route.ts`
- Create: `src/app/admin/blogger/logout/route.ts`
- Create: `src/app/admin/blogger/launch/route.ts`
- Create: `src/app/api/wf-content/v1/config/route.ts`
- Create: `src/app/api/wf-content/v1/[typeKey]/route.ts`
- Create: `src/app/api/wf-content/v1/[typeKey]/[slug]/route.ts`
- Create: `src/app/api/wf-content/v1/[typeKey]/[slug]/publish/route.ts`
- Create: `src/app/api/wf-content/v1/[typeKey]/[slug]/images/route.ts`
- Create: `src/app/api/wf-content/v1/[typeKey]/[slug]/images/[file]/route.ts`
- Create: `src/app/api/wf-content/v1/[typeKey]/relations/route.ts`
- Create: `unit-tests/wf-content-adapter.test.ts`
- Create: `unit-tests/wf-content-direct-access.test.ts`
- Reuse: `src/lib/guide-actions.ts`, `src/lib/guide-queries.ts`, `src/lib/news-actions.ts`, `src/lib/news-queries.ts`

**WF Studio files:**
- Modify: `src/config/sites.json`
- Modify: `.env.example`
- Create: `tests/blogger-vivir-profile.test.mjs`

**Interfaces:**
- Consumes: Task 2 signed-site adapter and Task 1 normalized contract.
- Consumes: Task 4 versioned editor module and existing `wf-blogger-handoff/v1` exchange.
- Produces: types `guide` and `news` with current Supabase rows remaining canonical.
- Produces: Vivir-only direct credentials plus Studio/client-panel launch into a Vivir-local Blogger session.

- [ ] **Step 1: Synchronize an isolated Vivir worktree from current remote main**

  The primary checkout is stale and contains an untracked `.DS_Store`; do not edit it.

- [ ] **Step 2: Write failing mapping/auth tests**

  Round-trip every existing guide/news field. Test rich body to current paragraph representation, categories, neighborhood/topic, languages, status, images and relations. Reject unsigned, replayed, wrong-site and unknown-type requests without exposing schema details. Test direct password scope, secure cookie rotation, logout, Studio ticket exchange and portal recovery without the direct password.

- [ ] **Step 3: Run the focused Vivir test and confirm failure**

  Run: `npm run test:unit -- unit-tests/wf-content-adapter.test.ts unit-tests/wf-content-direct-access.test.ts`

  Expected: FAIL because the adapter endpoints do not exist.

- [ ] **Step 4: Implement the minimal authenticated adapter and local editor entry**

  Do not create a second content table. Preserve existing slugs/URLs and use the current Supabase data as source of truth. `/admin/blogger` loads Task 4's pinned editor module only after local direct authentication or a valid Studio handoff; it never exposes the service adapter secret.

- [ ] **Step 5: Add and satisfy WF profile tests**

  Declare `/guias` and `/noticias`, their exact enabled fields/modules and controlled choices. Keep Blogger capability unavailable until remote health and round-trip checks pass.

- [ ] **Step 6: Verify and commit separately**

  Vivir: `npm run test:unit -- unit-tests/wf-content-adapter.test.ts unit-tests/wf-content-direct-access.test.ts`, then its required `npm run precommit`, `npm run check` and Playwright workflow from `AGENTS.md`; commit `feat: expose Guides and News to Blogger 2.0`.

  WF Studio: run profile/adapter tests plus `npm test`; commit `feat: register Vivir Blogger 2.0 profile`.

### Task 7: Conoce Fuengirola Guide and News adapter

**Repositories:** `conoce-fuengirola` and `wf-studio-panel` in separate worktrees and commits.

**Conoce files:**
- Create: `lib/wf-content/auth.ts`
- Create: `lib/wf-content/direct-session.ts`
- Create: `lib/wf-content/mapper.mjs`
- Create: `lib/wf-content/mapper-module.d.ts`
- Create: `app/admin/blogger/page.tsx`
- Create: `app/admin/blogger/login/route.ts`
- Create: `app/admin/blogger/logout/route.ts`
- Create: `app/admin/blogger/launch/route.ts`
- Create: `app/api/wf-content/v1/config/route.ts`
- Create: `app/api/wf-content/v1/[typeKey]/route.ts`
- Create: `app/api/wf-content/v1/[typeKey]/[slug]/route.ts`
- Create: `app/api/wf-content/v1/[typeKey]/[slug]/publish/route.ts`
- Create: `app/api/wf-content/v1/[typeKey]/[slug]/images/route.ts`
- Create: `app/api/wf-content/v1/[typeKey]/[slug]/images/[file]/route.ts`
- Create: `app/api/wf-content/v1/[typeKey]/relations/route.ts`
- Create: `tests/wf-content-adapter.test.mjs`
- Create: `tests/wf-content-direct-access.test.mjs`
- Reuse: `lib/guide-actions.ts`, `lib/guide-queries.ts`, `lib/news-actions.ts`, `lib/news-queries.ts`

**WF Studio files:**
- Modify: `src/config/sites.json`
- Modify: `.env.example`
- Create: `tests/blogger-conoce-profile.test.mjs`

**Interfaces:**
- Consumes: Task 2 signed-site adapter and Task 1 normalized contract.
- Consumes: Task 4 versioned editor module and existing `wf-blogger-handoff/v1` exchange.
- Produces: `guide` and `news` mappings for sections, FAQs, sources, premium CTA, related businesses, hero/alt, controlled news category, language and status.
- Produces: a Conoce-only direct Blogger session and password-independent Studio/client-panel launch.

- [ ] **Step 1: Create a clean Conoce worktree from remote main**

  Do not touch the dirty primary checkout containing analytics changes.

- [ ] **Step 2: Write failing lossless round-trip and authorization tests**

  Use fixtures containing every Conoce guide/news field. Assert sections/FAQs/sources retain order and IDs, image upload/alt round-trips, relation choices stay project-scoped, URLs are validated, delete maps to archive by default, and adapter errors reveal no schema/credential details. Test separate direct credentials, secure session/logout, ticket exchange, wrong-audience rejection and portal recovery.

- [ ] **Step 3: Run the focused test and confirm failure**

  Run: `node --test tests/wf-content-adapter.test.mjs tests/wf-content-direct-access.test.mjs`.

  Expected: FAIL because endpoints/mappers do not exist.

- [ ] **Step 4: Implement endpoints and local editor entry by reusing current CRUD/query modules**

  Preserve the current `/admin/contenido` CMS and public routes. Blogger 2.0 is an additional authorized client, not a replacement migration. Its local page loads the pinned Studio editor asset only after a valid Conoce-local session.

- [ ] **Step 5: Register and test the Conoce profile in WF Studio**

  Browser config exposes labels/choices only. Adapter base URL and secret stay server-side.

- [ ] **Step 6: Verify and commit separately**

  Conoce: `node --test tests/wf-content-adapter.test.mjs && npm run check && npm run test:e2e`; commit `feat: expose Conoce content to Blogger 2.0`.

  WF Studio: profile/adapter tests plus `npm test`; commit `feat: register Conoce Blogger 2.0 profile`.

### Task 8: TodoPlástico Articles, Guides and Tips adapter

**Repositories:** `agama-marketplace` and `wf-studio-panel` in separate worktrees and commits.

**TodoPlástico files:**
- Create: `src/lib/wf-content/auth.ts`
- Create: `src/lib/wf-content/direct-session.ts`
- Create: `src/lib/wf-content/article-mapper.mjs`
- Create: `src/lib/wf-content/article-mapper-module.d.ts`
- Create: `src/app/admin/blogger/page.tsx`
- Create: `src/app/admin/blogger/login/route.ts`
- Create: `src/app/admin/blogger/logout/route.ts`
- Create: `src/app/admin/blogger/launch/route.ts`
- Create: `src/app/api/wf-content/v1/config/route.ts`
- Create: `src/app/api/wf-content/v1/[typeKey]/route.ts`
- Create: `src/app/api/wf-content/v1/[typeKey]/[slug]/route.ts`
- Create: `src/app/api/wf-content/v1/[typeKey]/[slug]/publish/route.ts`
- Create: `src/app/api/wf-content/v1/[typeKey]/[slug]/images/route.ts`
- Create: `src/app/api/wf-content/v1/[typeKey]/[slug]/images/[file]/route.ts`
- Create: `src/app/guias/page.tsx`
- Create: `src/app/guias/[slug]/page.tsx`
- Create: `src/app/consejos/page.tsx`
- Create: `src/app/consejos/[slug]/page.tsx`
- Create: `supabase/migrations/0005_article_content_types.sql`
- Create: `tests/unit/wf-content-adapter.test.mjs`
- Create: `tests/unit/wf-content-direct-access.test.mjs`
- Create: `tests/e2e/content-type-routes.spec.ts`
- Modify only when required by failing tests: `src/lib/articles.ts` and current article query/render modules.

**WF Studio files:**
- Modify: `src/config/sites.json`
- Modify: `.env.example`
- Create: `tests/blogger-todoplastico-profile.test.mjs`

**Interfaces:**
- Consumes: Task 2 signed-site adapter and Task 1 normalized contract.
- Consumes: Task 4 versioned editor module and existing `wf-blogger-handoff/v1` exchange.
- Produces: types `article`, `guide`, `tip`, all stored in `mkt_articles`; existing articles stay on `/articulos`, while new guide and tip destinations are `/guias` and `/consejos`.
- Produces: a TodoPlástico-only direct Blogger session and password-independent Studio/client-panel launch.

- [ ] **Step 1: Create a clean TodoPlástico worktree from remote main**

  The primary checkout is on unrelated `feat/require-rfc-to-publish`; do not edit it.

- [ ] **Step 2: Write failing mapping and renderer-parity tests**

  Cover slug/title/excerpt/body/category/tags/cover image/author/status/published date/SEO. Assert existing rows default to `article`, new guides render only under `/guias`, new tips render only under `/consejos`, and legacy `/articulos/:slug` URLs remain unchanged. Test separate direct credentials, secure cookies/logout, Studio ticket exchange and wrong-project rejection.

- [ ] **Step 3: Run focused tests and confirm failure**

  Run: `node --test tests/unit/wf-content-adapter.test.mjs tests/unit/wf-content-direct-access.test.mjs`.

  Expected: FAIL because the adapter does not exist.

- [ ] **Step 4: Implement the authenticated adapter and local editor entry over `mkt_articles`**

  Add a backward-compatible `content_type` column to `mkt_articles` with default/check values `article`, `guide`, `tip`; do not create another article table. Preserve current article URLs and ensure drafts never enter public queries/sitemap/search. Reuse the article renderer for `/guias` and `/consejos` while enforcing the requested type in every query. Serve the common pinned editor module only after direct local login or valid Studio handoff.

- [ ] **Step 5: Register and test the TodoPlástico CMS profile**

  Configure Articles (`/articulos`), Guides (`/guias`) and Tips/Consejos (`/consejos`). Category choices are exactly `Guías de compra`, `Operación industrial`, `Materiales y procesos`, `Maquinaria`, `TodoPlásticos`, `Diseño y producto`, `Marketing B2B` and `Sustentabilidad`. Keep capability unavailable until the renderer and production endpoint pass.

- [ ] **Step 6: Verify and commit separately**

  TodoPlástico: `node --test tests/unit/wf-content-adapter.test.mjs && npm run lint && npm run typecheck && npm run build && npx playwright test --project=chromium`; commit `feat: add TodoPlástico Blogger 2.0 adapter`.

  WF Studio: profile/adapter tests plus `npm test`; commit `feat: register TodoPlástico Blogger 2.0 profile`.

### Task 9: Cross-repository acceptance and controlled activation

**Repositories:** all branches produced by Tasks 1-8.

**Files:**
- Create: `tests/blogger-2-acceptance.test.mjs` in `wf-studio-panel`
- Modify: deployment/runbook documentation in each affected repository only with environment variable names, never values.

**Interfaces:**
- Consumes: every task's committed contract and endpoint.
- Produces: reproducible acceptance evidence and activation checklist; no activation without explicit deployment authority.

- [ ] **Step 1: Write the end-to-end acceptance test before activation**

  Cover administrator Studio launch, client portal launch, direct Sport login, forgotten-direct-password portal recovery, type selection, draft, preview, publish, public URL and cross-site denial. Test ticket replay/expiry/wrong audience.

- [ ] **Step 2: Run every repository's full verification**

  WF Studio: `npm test && npm run lint && npm run typecheck && npm run build`.

  Sport, Vivir, Conoce and TodoPlástico: each repository's full documented test/lint/typecheck/build workflow.

  Expected: all green; record any pre-existing failure by exact command and test name instead of hiding it.

- [ ] **Step 3: Run fresh whole-branch reviews**

  Review security/isolation, data-loss risk, legacy compatibility, profile-to-adapter consistency and deployment rollback in every repository before opening Pull Requests.

- [ ] **Step 4: Open separate Pull Requests**

  Push only the dedicated branches, open PRs against each repository's default branch and attach every PR to the task. Do not merge or deploy merely because CI passes.

- [ ] **Step 5: Deploy in dependency order after authorization**

  Order: WF foundation, Sport reference, Vivir, Conoce, TodoPlástico. Validate health and a disposable draft before activating each project's capability.

- [ ] **Step 6: Record final evidence**

  Record PR/commit/deployment identities, active content types, public paths, health result and required environment variable names. Never record passwords, hashes, service credentials or handoff secrets.
