# Online Blogger Integrations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give authorized Studio users secure one-click access to a separate online Blogger for each enabled website, beginning with Samuel Coach, Agama and Web Fuengirola.

**Architecture:** Studio issues 60-second, single-use opaque launch codes and target sites exchange them server-to-server before creating local secure sessions. Existing editors and direct login remain available; the unauthenticated local Blog Creator is reused only as adapter logic and is never exposed online unchanged.

**Tech Stack:** Next.js/Supabase in Studio, Node.js static-site editors, WordPress REST adapter where applicable, HttpOnly cookies, Playwright, Node test runner.

**Spec:** `docs/superpowers/specs/2026-10-17-client-portal-platform-design.md`

## Global Constraints

- Never put Supabase access tokens, credentials or reusable secrets in URLs, registry JSON, logs or client bundles.
- Blogger remains inactive until its online destination and health contract validate.
- Direct site login continues to work during and after rollout.
- Samuel Coach, Agama and Web Fuengirola are the first active targets; Viking and Sportmassage remain non-active until their backends are verified.
- Per-site work occurs in dedicated branches/worktrees and preserves existing local changes.

## Review Focus

- Expired, replayed, wrong-audience and disabled-site launch codes fail closed; Tasks 1-2 test this.
- Cross-site GET requests cannot establish an editor session; Task 2 tests this.
- A compromised target credential cannot exchange codes for another site; Task 1 tests audience binding.
- Health endpoints expose capabilities but no credentials or filesystem paths; Tasks 2-4 test this.
- A failed editor or publish operation leaves public content and Studio usable; Tasks 3-5 test rollback/error behavior.

---

### Task 1: Studio one-time launch protocol

**Files (WF Studio):**
- Create: `supabase/migrations/202610170004_tool_launch_tickets.sql`
- Create: `src/lib/tools/launch-tickets.mjs`
- Create: `src/lib/tools/launch-tickets-module.d.ts`
- Create: `src/app/api/tools/blogger/[siteKey]/launch/route.ts`
- Create: `src/app/api/tool-launch/exchange/route.ts`
- Create: `tests/blogger-tool-launch.test.mjs`
- Modify: `src/config/sites.json`
- Modify: `src/lib/sites/registry.mjs`
- Modify: `src/lib/sites/registry-module.d.ts`

**Interfaces:**
- Produces: `wf-blogger-handoff/v1`, atomic `createLaunchTicket`/`consumeLaunchTicket`, and registry fields `launchUrl`, `healthUrl`, `adapter`, `capabilities`.

- [ ] Write failing tests for admin/client authorization, 60-second expiry, hashed storage, atomic replay rejection, audience binding, disabled tools, HTTPS registry validation and secret-free form output.
- [ ] Run `node --test tests/blogger-tool-launch.test.mjs tests/site-registry.test.mjs`; expect FAIL.
- [ ] Implement migration, ticket module, launch POST and backchannel exchange POST with `no-store`, no-referrer and restrictive CSP headers.
- [ ] Re-run the focused tests; expect PASS.
- [ ] Commit as `feat: add secure Blogger launch handoff`.

### Task 2: Shared target-site session contract and Samuel pilot

**Files (Samuel Coach dedicated worktree):**
- Create: `scripts/blogger-launch-session.mjs`
- Create: `tests/security/blogger-launch-session.test.mjs`
- Create: `admin/herramientas/index.html`
- Modify: `scripts/post-manager-server.mjs`
- Modify: `admin/index.html`
- Modify: `admin/blogger/index.html`
- Modify: `assets/js/admin-gate.js`
- Modify: `tests/security/post-manager-server.test.mjs`

**Interfaces:**
- Consumes: Studio `POST /api/tool-launch/exchange`.
- Produces: `POST /admin/blogger/launch`, `GET /api/admin/session`, `POST /api/admin/logout`, `GET /.well-known/wf-blogger.json`, `GET /api/blogger/health`, and a protected `/admin/herramientas/` hub for Blogger and student report/evaluation tools.

- [ ] Write failing tests for POST-only launch, valid exchange, HttpOnly/Secure/SameSite=Lax cookie, logout, direct-login fallback, replay/expiry/audience failure and anonymous mutation rejection.
- [ ] Run the two focused security tests; expect FAIL.
- [ ] Implement the reusable session module and wire Samuel without removing its current Supabase login; update `/admin/` and `/admin/herramientas/` so every existing Samuel tool is reachable from the protected hub.
- [ ] Run Samuel's auth/editor/security suite and Studio's launch tests; expect PASS.
- [ ] Add the Samuel production registry destination only after staging health succeeds.
- [ ] Commit in both repositories with scoped conventional commits.

### Task 3: Put Web Fuengirola posts into an editor-safe source

**Files (Web Fuengirola dedicated worktree):**
- Create: `content/blog/*.json` or `content/blog/*.md` (one canonical source per current post)
- Create: `scripts/blog-content-store.mjs`
- Create: `tests/blog-content-store.test.mjs`
- Modify: `scripts/build-blog-campaign.mjs`
- Modify: `scripts/build-blog-i18n.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: list/read/create/update/publish operations over path-confined, atomically written post sources; existing generators consume this source.

- [ ] Write failing parity tests proving every existing post, locale, canonical, date, tag/category and metadata value round-trips from structured sources without generated HTML drift.
- [ ] Run focused unit tests; expect FAIL for missing store/source.
- [ ] Extract current hardcoded/JSON content into canonical per-post files and adapt generators without changing public URLs.
- [ ] Run two builds and assert no second-pass diff, then run `npm run test:unit`, `npm run lint` and `npm run check`.
- [ ] Commit as `refactor: make blog content editor-ready`.

### Task 4: Deploy the Web Fuengirola online Blogger adapter

**Files (Web Fuengirola):**
- Create: `tools/post-manager/` using the approved basic editor UI
- Create: `scripts/post-manager-server.mjs`
- Create: `scripts/blogger-launch-session.mjs`
- Create: `tests/post-manager-server.test.mjs`
- Modify: deployment configuration and `.env.example`

**Interfaces:**
- Consumes: Task 3 content store and Task 1 handoff.
- Produces: protected CRUD/media/build API, launch/session/health endpoints, and `/admin/blogger/`.

- [ ] Write failing API/auth/path-confinement/media/build tests and the shared target contract tests.
- [ ] Implement the minimal server-side adapter and basic editor; do not expose local filesystem or deployment controls.
- [ ] Verify public URL parity, authenticated CRUD, image limits, build rollback and restart persistence.
- [ ] Enable Web Fuengirola Blogger in Studio only after production health passes.
- [ ] Commit as `feat: add protected Web Fuengirola Blogger`.

### Task 5: Connect Agama without losing current changes

**Files (AGAMA isolated worktree after synchronization):**
- Modify/Create only after selecting the canonical backend: `scripts/publish-blog.mjs`, `scripts/generate-static-blog.mjs`, server adapter/session files and focused tests.
- Modify (Studio): `src/config/sites.json` and project seed/configuration.

**Interfaces:**
- Produces: the same target-site contract as Tasks 2 and 4 with adapter `snapshot-build` unless the existing WordPress migration is explicitly completed first.

- [ ] Preserve and synchronize the dirty AGAMA checkout into an isolated branch before editing.
- [ ] Write failing parity, auth, CRUD/media, publish rollback and health tests around the selected existing publishing source.
- [ ] Implement the adapter without changing current public `/blog/` URLs.
- [ ] Verify a production-data copy and enable Agama only after health/auth tests pass.
- [ ] Commit and open a separate AGAMA PR.

### Task 6: Prepare Sportmassage and Viking without premature activation

**Files:**
- Modify: Blog Creator `config/sites.json` and WordPress adapter tests only after endpoint provisioning.
- Modify: Studio registry/project capability records after validation.
- Create: a Viking adapter plan once its repository/CMS is located.

**Interfaces:**
- Consumes: shared target contract.
- Produces: validated readiness evidence; no active client capability until complete.

- [ ] Confirm Sportmassage DNS, WordPress REST, dedicated Application Password, allowed origin and health endpoint with credentials kept server-side.
- [ ] Run existing WordPress fixture tests plus per-site isolation, timeout, upload and credential-redaction tests.
- [ ] Locate Viking source, CMS, article storage, deployment owner and image model; record the selected adapter.
- [ ] Leave both capabilities `available` rather than `active` if any prerequisite is missing.
- [ ] Commit only validated configuration/documentation.

### Task 7: Cross-origin acceptance and rollout

**Files:**
- Create: Studio Playwright cross-origin Blogger flow.
- Modify: operational deployment documentation in each affected repository.

- [ ] Add an end-to-end test that logs into Studio, launches a Blogger, arrives authenticated, rejects code reuse, logs out and preserves direct-login fallback.
- [ ] Run each repository's unit/security suite, lint, typecheck/build and the cross-origin Playwright suite.
- [ ] Pilot Samuel Coach, then Web Fuengirola, then Agama; validate rollback before enabling the next site.
- [ ] Record health URLs, deployment revisions and recovery steps without secrets.
- [ ] Commit as `test: verify cross-domain Blogger access`.
