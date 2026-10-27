# Sport Massage Independent Blogger Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve the existing Sport Massage Blogger at `https://sportmassagefuengirola.com/admin/blogger/` with an independent, tool-only credential and session while removing every client Blogger/authentication path from `admin.webfuengirola.com` and leaving portal-to-Blogger SSO disabled.

**Architecture:** The public Sport Massage site remains static. Only `/admin/blogger/`, its same-origin authentication/session endpoints, and the already-existing Blogger content APIs are served by the Sport Massage Blogger sidecar; no article/editor/publishing implementation is replaced. WF-Panel becomes fail-closed by host and role: `admin.webfuengirola.com` accepts only administrator sessions, and Sport Massage is not exposed as a client portal tool until a later, separately approved SSO phase.

**Tech Stack:** Node.js 22, native `node:test`, Next.js 15 middleware/server actions, Supabase Auth/RLS, static HTML/CSS/ES modules, the existing Sport Massage Node Blogger service, Nginx/Coolify deployment.

**Spec:** User-approved scope recorded in **Global Constraints** below. This plan supersedes `docs/superpowers/plans/2026-10-24-sportmassage-central-dual-access.md` and the client-facing parts of `docs/superpowers/plans/2026-10-20-direct-blogger-access.md`.

## Global Constraints

- Do not add a Blogger link or Blogger SSO to the client portal in this phase.
- `admin.webfuengirola.com` is exclusively administrative; a client identity, client token, or tool credential must never establish or use a session there.
- The sole direct client URL is `https://sportmassagefuengirola.com/admin/blogger/`.
- Keep the Sport Massage public website static; proxy only the Blogger/auth/API surface to the existing dynamic Blogger sidecar.
- Preserve the existing editor, translations, SEO, content storage, publishing, images, build hooks, and editor UI except for the minimum login/bridge behavior.
- The direct Blogger username/password is independent from Supabase/WF-Portal. Reusing the already authorized initial email/password values does not couple their identities, hashes, sessions, reset flows, or future changes.
- Direct sessions are site-bound to `sportmassagefuengirola`, tool-bound to `blogger`, same-origin, HttpOnly, Secure, SameSite, and grant no WF-Portal, WF-Admin, other-client, other-project, or other-tool access.
- There is no client self-service password change or recovery for the direct Blogger credential. Only the owner may reset it through a documented secure operator procedure.
- Portal password management remains unchanged and independent.
- No production mutation, external configuration change, credential disclosure, or content publication occurs while implementing and reviewing the code. Production activation is a separately approved phase.
- Preserve unrelated local changes. `/Users/mac/sportmassage` is currently dirty in unrelated website/Capacitor files; implementation must start from a new managed worktree based on refreshed `origin/main`, never from that checkout.
- WF-Panel work belongs in the separate `wf-studio-panel` repository. Sport Massage gateway/service work belongs in the separate `sportmassage` repository. Use one dedicated branch and Pull Request per repository; do not create nested repositories.

## Review Focus

- A valid client Supabase cookie copied or established on the admin origin must be revoked/rejected before any page or API response; Task 2 adds host-role middleware and callback/action tests.
- A stale or forged support-preview cookie must not let a client traverse `/cliente/*` on the admin origin; Task 2 adds this regression.
- The direct Blogger deployment must never regress to a meta refresh, link, iframe, or redirect targeting `admin.webfuengirola.com`; Task 4 checks both source and generated release output.
- A direct Blogger session must remain valid only for the fixed Sport Massage Blogger scope, while wrong site/project/tool routes and dormant SSO launch attempts fail closed; Task 4 pins these cases.
- An owner password reset must not create a browser recovery route and must invalidate existing direct sessions without revealing plaintext or hashes; Task 5 tests the operator-only reset contract.

---

## Repository and File Map

### WF-Panel repository

Root: `/Users/mac/Documents/ChatGPT/wf-studio-panel-continuation-20261027`

- `middleware.ts`: production host routing and the admin-host role boundary.
- `src/lib/supabase/middleware.ts`: refreshes Supabase sessions and enforces the optional authenticated-role requirement supplied by host routing.
- `src/lib/actions/auth.ts`: admin/client password actions; the admin action must reject and sign out non-admin identities.
- `src/app/auth/callback/route.ts`: host-specific callback exchange; admin callbacks must retain only admin sessions.
- `src/lib/security/redirects.mjs`: client destinations; no admin-host Blogger destination remains valid.
- `src/lib/projects/tools.mjs`: client tool presentation; Sport Blogger has no portal link in this phase.
- `src/app/cliente/(protected)/proyectos/[slug]/blogger/page.tsx`: fail closed without an approved external handoff; no embedded central editor for Sport clients.
- `src/app/acceso/blogger/[siteKey]/page.tsx`: remove the obsolete client-facing admin-host entrypoint.
- `src/config/sites.json`: remove the admin-host direct URL and describe the independent Sport URL without enabling a portal handoff.
- `tests/direct-blogger-host-routing.test.mjs`, `tests/client-auth-destination.test.mjs`, `tests/direct-blogger-access.test.mjs`, `tests/sport-blogger-central-access.test.mjs`, `tests/project-tools.test.mjs`, and a new `tests/admin-host-role-boundary.test.mjs`: red-first host, auth, destination, and portal regressions.

### Sport Massage repository

Source of truth: `https://github.com/samuelhogarola-ship-it/sportmassage.git`; execution worktree must be created from current `origin/main`.

- `admin/blogger/index.html`, `styles.css`, `blogger-auth.js`, `blogger-auth-core.js`, `app.js`: existing editor and minimal direct login shell.
- `scripts/post-manager-server.mjs`: existing dynamic Blogger/auth/content service; direct-only deployment gate and fixed session scope.
- `scripts/blogger-launch-session.mjs`: password hashing, signed session store, rate limiting, and audit helpers.
- `scripts/generate-blogger-password-hash.mjs`: secure-stdin operator hash generation; no plaintext command argument.
- `deploy/public-manifest.json`: allowlists the static Blogger assets copied into releases.
- `deploy/nginx-blogger.conf.example`, `deploy/sportmassage-blogger.service.example`: static-site plus narrowly proxied Blogger service topology.
- `docs/blogger-deployment.md`: direct-only activation and owner-reset runbook.
- `tests/blogger-auth.test.mjs`, `tests/blogger-browser-auth.test.mjs`, `tests/post-manager-server.test.mjs`, `tests/static-release.test.mjs`: existing characterization plus the new red-first direct-only handoff gate, session isolation, no-redirect, no-self-service, and release tests.

### Verified Baseline (Do Not Rebuild)

Sport Massage `origin/main` already contains commit `e8151d8` (`Ship independent Sport Massage Blogger editor`). It includes the static login shell, scrypt password hashing, signed HttpOnly session store, rate limiting, fixed Blogger APIs, static release builder, Nginx/service templates, and extensive tests. Those existing green tests are characterization coverage and must remain green; do not make them artificially fail. The actual production URL is stale: it currently serves a meta refresh/link to `admin.webfuengirola.com`. The required red-first gaps are therefore:

1. WF-Panel tests that currently permit client sessions/direct Blogger on the admin origin.
2. Portal tests that currently expose Sport Blogger as an embedded client tool.
3. Sport tests that currently permit the dormant Studio handoff endpoint/fragment when this phase is direct-only.
4. A deployment verifier that currently fails against production because the live Sport URL redirects to WF-Admin.

Existing direct-login, wrong-password, session-cookie, other-site rejection, no-self-service, editor, content, SEO, translations, media, and publishing tests are preservation gates, not new red tests.

## Task 1: Establish Clean Two-Repository Baselines

**Files:**
- Inspect only: WF-Panel and Sport Massage roots listed above
- Do not modify or commit the dirty `/Users/mac/sportmassage` checkout

**Interfaces:**
- Consumes: refreshed `origin/main` in both repositories
- Produces: one clean managed worktree/branch per repository and recorded baseline verification output

- [ ] **Step 1: Inspect branch, working tree, and divergence before creating execution worktrees**

Run in each repository:

```bash
git status --short
git branch --show-current
git rev-list --left-right --count HEAD...@{upstream}
git remote -v
```

Expected: WF-Panel source checkout is understood; `/Users/mac/sportmassage` reports existing unrelated changes and is not used for implementation.

- [ ] **Step 2: Refresh remote refs and create dedicated managed worktrees**

Create branches from the exact refreshed `origin/main` revisions:

```text
codex/sportmassage-independent-blogger-access
codex/admin-client-domain-isolation
```

Expected: both execution worktrees are clean, detached from the user's dirty Sport Massage checkout, and attached to this task before edits.

- [ ] **Step 3: Run baseline verification without secrets**

Sport Massage:

```bash
npm test
npm run check
npm run build:site
```

WF-Panel:

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

Expected: record all existing failures before writing new tests. Do not compensate for missing production secrets or mutate content.

## Task 2: Make the WF Admin Origin Fail Closed to Client Identities

**Files:**
- Create: `tests/admin-host-role-boundary.test.mjs`
- Modify: `middleware.ts`
- Modify: `src/lib/supabase/middleware.ts`
- Modify: `src/lib/actions/auth.ts`
- Modify: `src/app/auth/callback/route.ts`
- Modify: `tests/direct-blogger-host-routing.test.mjs`
- Modify: `tests/client-auth-destination.test.mjs`

**Interfaces:**
- Consumes: Supabase `auth.getUser()`, `profiles.role`, and the existing cookie adapter
- Produces: `updateSession(request, { requiredAuthenticatedRole?: 'admin' }): Promise<NextResponse>`; admin password/callback flows that retain a session only after confirming `profiles.role === 'admin'`

- [ ] **Step 1: Write failing middleware host-boundary tests**

Add cases asserting:

```text
admin host + authenticated client + /paneladmin/*             -> 404 and sign-out cookie
admin host + authenticated client + /api/blogger/*             -> 404 and sign-out cookie
admin host + authenticated client + /api/posts or /api/build   -> 404 and sign-out cookie
admin host + client + forged __Host-wf_support_preview cookie  -> 404 for /cliente/*
admin host + unauthenticated /cliente/*                         -> 404
admin host + unauthenticated /acceso/blogger/*                  -> 404
admin host + unauthenticated /blogger/*                         -> 404
admin host + authenticated admin + /paneladmin/*                -> existing response
portal host + authenticated client + /cliente/dashboard         -> existing response
```

- [ ] **Step 2: Run the new host tests and verify red**

Run:

```bash
node --test tests/admin-host-role-boundary.test.mjs tests/direct-blogger-host-routing.test.mjs
```

Expected: FAIL because current middleware accepts client sessions on shared APIs, admits direct Blogger login/callback exceptions, and trusts cookie presence as a support-routing hint.

- [ ] **Step 3: Extend `updateSession` with the exact role-bound interface**

Implement:

```ts
type SessionUpdateOptions = { requiredAuthenticatedRole?: 'admin' }
export async function updateSession(
  request: NextRequest,
  options?: SessionUpdateOptions,
): Promise<NextResponse>
```

When a user exists and `requiredAuthenticatedRole` is set, query the current profile by `user.id`. A missing profile or mismatched role must call `supabase.auth.signOut()` through the same cookie adapter and return a 404 response carrying the deletion cookies. Unauthenticated users may still reach the administrator login/callback entrypoints; protected-route behavior remains unchanged.

- [ ] **Step 4: Replace path exceptions with a host-first policy in `middleware.ts`**

On the known admin host, return 404 before application routing for `/cliente`, `/acceso/blogger`, and `/blogger` prefixes. For every remaining request call `updateSession(request, { requiredAuthenticatedRole: 'admin' })`. Remove the direct-Blogger client login/callback exception. Preserve the portal `/paneladmin` block and portal root redirect.

- [ ] **Step 5: Write failing admin password/callback role tests**

In `tests/admin-host-role-boundary.test.mjs`, assert that a successful Supabase password exchange or callback for a `client` profile immediately signs out, returns a generic denial, and does not redirect to an authenticated admin page. Assert that an `admin` profile retains the session and existing destination. Never place real credentials in fixtures.

- [ ] **Step 6: Run the auth tests and verify red**

Run:

```bash
node --test tests/admin-host-role-boundary.test.mjs tests/client-auth-destination.test.mjs
```

Expected: FAIL because both current flows retain any valid Supabase identity before page-level authorization.

- [ ] **Step 7: Add post-authentication role verification**

In `adminLoginAction`, load the just-authenticated profile and retain the session only for `role === 'admin'`; otherwise call `signOut()` and return the existing generic login error. In the admin-host callback, perform the same check after `exchangeCodeForSession`; sign out and redirect to `/paneladmin?error=unauthorized` on mismatch. Do not reveal whether an email belongs to a client.

- [ ] **Step 8: Run focused tests until green**

Run:

```bash
node --test tests/admin-host-role-boundary.test.mjs tests/direct-blogger-host-routing.test.mjs tests/client-auth-destination.test.mjs
```

Expected: PASS.

- [ ] **Step 9: Commit the host boundary**

```bash
git add middleware.ts src/lib/supabase/middleware.ts src/lib/actions/auth.ts src/app/auth/callback/route.ts tests/admin-host-role-boundary.test.mjs tests/direct-blogger-host-routing.test.mjs tests/client-auth-destination.test.mjs
git commit -m "fix: isolate admin sessions from client identities"
```

## Task 3: Remove Sport Blogger From Client Portal and Obsolete Admin Direct Routes

**Files:**
- Modify: `src/lib/security/redirects.mjs`
- Modify: `src/lib/projects/tools.mjs`
- Modify: `src/app/cliente/(protected)/proyectos/[slug]/blogger/page.tsx`
- Delete: `src/app/acceso/blogger/[siteKey]/page.tsx`
- Modify: `src/config/sites.json`
- Modify: `tests/security.test.mjs`
- Modify: `tests/direct-blogger-access.test.mjs`
- Modify: `tests/sport-blogger-central-access.test.mjs`
- Modify: `tests/project-tools.test.mjs`
- Modify: `tests/blogger-editor-routing.test.mjs`

**Interfaces:**
- Consumes: existing `viewer: 'admin' | 'client'` project tool construction and site registry validation
- Produces: admin owner route `/paneladmin/blogger/sportmassagefuengirola`; no client Blogger href; independent registry URL `https://sportmassagefuengirola.com/admin/blogger/` without `launchUrl` or handoff metadata

- [ ] **Step 1: Rewrite the obsolete direct/portal tests to the approved behavior**

Assert:

```text
sanitizeClientDestination('/acceso/blogger/...') -> '/cliente/dashboard'
client password and magic-link destinations always use portal.webfuengirola.com
/acceso/blogger/[siteKey] has no application route
Sport client project tools contain no Blogger href or launch form
direct navigation to /cliente/proyectos/sportmassagefuengirola/blogger -> 404
admin project tools still link to /paneladmin/blogger/sportmassagefuengirola
Sport registry blogger.url == https://sportmassagefuengirola.com/admin/blogger/
Sport registry has no launchUrl, healthUrl, adapter, or capabilities in this phase
```

- [ ] **Step 2: Run the focused suite and verify red**

Run:

```bash
node --test tests/security.test.mjs tests/direct-blogger-access.test.mjs tests/sport-blogger-central-access.test.mjs tests/project-tools.test.mjs tests/blogger-editor-routing.test.mjs
```

Expected: FAIL because the current code treats `/acceso/blogger/*` as a client destination, embeds Sport Blogger inside the portal, and registers the admin-host URL.

- [ ] **Step 3: Remove the client direct destination and page**

Delete the `/acceso/blogger/[siteKey]` page. Restrict `sanitizeClientDestination` and all canonical client URL builders to `/cliente` routes on the portal origin; remove `isDirectBloggerDestination` where it no longer has a caller.

- [ ] **Step 4: Hide Sport Blogger from client project tools without changing admin tools**

Remove the `central-legacy` client exception in `buildProjectTools`. In the client Blogger page, require an explicitly approved future external handoff before rendering; absent that contract, call `notFound()`. Do not add a direct external anchor as a substitute—the portal integration is intentionally postponed.

- [ ] **Step 5: Point the registry's descriptive direct URL to Sport Massage**

Set only:

```json
"url": "https://sportmassagefuengirola.com/admin/blogger/"
```

Keep `runtime`, content/API/build metadata needed by the administrator's existing central editor. Do not add handoff fields, portal launch forms, secrets, or credentials.

- [ ] **Step 6: Run focused tests until green**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 7: Commit the client-surface removal**

```bash
git add src/lib/security/redirects.mjs src/lib/projects/tools.mjs 'src/app/cliente/(protected)/proyectos/[slug]/blogger/page.tsx' src/config/sites.json tests
git add -u 'src/app/acceso/blogger/[siteKey]/page.tsx'
git commit -m "fix: remove client Blogger from the admin and portal surfaces"
```

## Task 4: Pin the Static Sport Gateway and Direct-Only Login in Red Tests

**Files:**
- Modify: `tests/blogger-browser-auth.test.mjs`
- Modify: `tests/post-manager-server.test.mjs`
- Modify: `tests/static-release.test.mjs`
- Create: `tests/blogger-deployment-verifier.test.mjs`
- Create: `scripts/verify-blogger-deployment.mjs`
- Modify: `admin/blogger/blogger-auth.js`
- Modify: `scripts/post-manager-server.mjs`
- Modify: `scripts/blogger-launch-session.mjs`
- Modify: `deploy/public-manifest.json` only if a new minimal login asset is required

**Interfaces:**
- Consumes: existing `verifyPassword`, `createSessionStore`, fixed Sport content APIs, and static release builder
- Produces: the existing `loadRuntimeConfig(env)` with direct-only authentication enabled and Studio handoff disabled; sessions shaped as `{ source: 'direct', siteKey: 'sportmassagefuengirola', scope: ['blogger'] }`; `verifyIndependentBlogger(baseUrl: string, fetchImpl = fetch): Promise<{ ok: true }>`

- [ ] **Step 1: Add source and generated-release characterization assertions**

In browser/static release tests assert both `admin/blogger/index.html` and the generated `.blogger-state/public/current/admin/blogger/index.html`:

```text
contain the same-origin POST login form
contain no meta refresh
contain no admin.webfuengirola.com URL
contain no portal.webfuengirola.com URL
contain no iframe
contain no password reset/change/recovery link or form
preserve the existing editor asset references and controls
```

Expected before code changes: these assertions should PASS on `origin/main`. If they fail locally, stop and reconcile the worktree/commit rather than reimplementing the editor.

- [ ] **Step 2: Add failing direct-only server tests**

Assert:

```text
correct independent username/password -> 204/200 plus HttpOnly Secure SameSite=Strict cookie with Path=/ on the Sport-only origin (required by the existing /api/* editor calls)
wrong username/password -> generic 401, no session
session record -> source direct, siteKey sportmassagefuengirola, scope exactly ['blogger']
/admin/blogger/launch while handoff is disabled -> 404
fragment containing wf-blogger-handoff/v1 -> ignored and no request issued
other site/project/tool paths -> 404
unauthenticated /api/posts, /api/build, media and session -> 401
authenticated session cannot reach any non-Blogger application path exposed by the service
```

- [ ] **Step 3: Run tests and verify the direct-only cases are red**

Run:

```bash
node --test tests/blogger-browser-auth.test.mjs tests/post-manager-server.test.mjs tests/static-release.test.mjs
```

Expected: FAIL specifically because the current browser consumes Studio fragments and the server accepts `/admin/blogger/launch`. Existing direct-login and editor preservation assertions remain green.

- [ ] **Step 4: Write the failing deployment-verifier test**

Create a local mock HTTP server fixture. Assert that `verifyIndependentBlogger` rejects a 301/302/HTML meta-refresh/link to `admin.webfuengirola.com` and accepts only a 200 same-origin login shell containing the direct username/password form. The verifier must use `redirect: 'manual'`, print no body/credentials, and perform no login or content mutation.

Run:

```bash
node --test tests/blogger-deployment-verifier.test.mjs
```

Expected: FAIL because `scripts/verify-blogger-deployment.mjs` does not exist.

- [ ] **Step 5: Implement the read-only deployment verifier**

Implement `verifyIndependentBlogger(baseUrl, fetchImpl)` and a CLI accepting only an HTTPS base URL. Exit non-zero on redirect, non-200, missing login form, iframe, or any `admin.webfuengirola.com` reference. Do not accept credentials or submit forms.

- [ ] **Step 6: Add an explicit direct-only runtime contract**

Define in `scripts/post-manager-server.mjs`:

```js
function loadRuntimeConfig(env) => {
  directUsername,
  passwordHash,
  sessionSecret,
  studioHandoffEnabled: false,
  siteKey: 'sportmassagefuengirola',
  scope: ['blogger'],
  ...existing content/build paths
}
```

Do not require `BLOGGER_HANDOFF_SECRET` when handoff is disabled. If a deployment explicitly supplies `BLOGGER_STUDIO_HANDOFF_ENABLED=true`, fail startup in this phase with a configuration error so dormant code cannot be accidentally activated before the later SSO project.

- [ ] **Step 7: Disable browser and server SSO entry without touching the editor**

Stop calling `consumeStudioLaunchFragment` from `requireBloggerAccess` and return 404 for `/admin/blogger/launch`. Leave editor, translation, SEO, post, media, build, and publishing code unchanged.

- [ ] **Step 8: Bind every direct session to the fixed tool/site**

On successful password verification create only:

```js
{ source: 'direct', siteKey: 'sportmassagefuengirola', scope: ['blogger'] }
```

Every protected content/session endpoint must verify those exact claims, not just cookie validity. Reject missing, extra, foreign, or malformed scope/site claims.

- [ ] **Step 9: Run the focused direct-access tests until green**

Run:

```bash
node --test tests/blogger-browser-auth.test.mjs tests/post-manager-server.test.mjs tests/static-release.test.mjs tests/blogger-deployment-verifier.test.mjs
```

Expected: PASS.

- [ ] **Step 10: Confirm the present production mismatch without changing it**

Run only after local tests pass:

```bash
node scripts/verify-blogger-deployment.mjs https://sportmassagefuengirola.com/admin/blogger/
```

Expected before deployment: FAIL because production still redirects to `admin.webfuengirola.com`. Record the failure as the deployment red gate; do not alter production.

- [ ] **Step 11: Commit the direct-only gateway contract**

```bash
git add admin/blogger/blogger-auth.js scripts/post-manager-server.mjs scripts/blogger-launch-session.mjs scripts/verify-blogger-deployment.mjs tests/blogger-browser-auth.test.mjs tests/post-manager-server.test.mjs tests/static-release.test.mjs tests/blogger-deployment-verifier.test.mjs deploy/public-manifest.json
git commit -m "fix: bind Sport Blogger to independent direct access"
```

## Task 5: Prove and Document Owner-Only Credential Reset

**Files:**
- Modify: `scripts/generate-blogger-password-hash.mjs`
- Modify: `tests/blogger-auth.test.mjs`
- Modify: `tests/post-manager-server.test.mjs`
- Modify: `tests/blogger-browser-auth.test.mjs`
- Modify: `docs/blogger-deployment.md`
- Modify: `deploy/sportmassage-blogger.service.example`

**Interfaces:**
- Consumes: password via standard input only; protected deployment environment managed by the owner
- Produces: a scrypt hash suitable for `BLOGGER_DIRECT_PASSWORD_HASH`; documented reset operation that rotates `BLOGGER_SESSION_SECRET` and invalidates every existing direct session

- [ ] **Step 1: Add no-self-service and reset-revocation characterization tests**

Assert that the browser contains no recovery/change UI and that all likely same-origin routes such as `/admin/blogger/recover`, `/admin/blogger/reset`, `/admin/blogger/password`, and matching `/api` forms return 404. Add a session test proving that rebuilding the session store with a rotated `BLOGGER_SESSION_SECRET` makes an earlier cookie invalid.

- [ ] **Step 2: Run the focused auth tests**

Run:

```bash
node --test tests/blogger-auth.test.mjs tests/blogger-browser-auth.test.mjs tests/post-manager-server.test.mjs
```

Expected: the no-self-service cases should already pass. The rotated-secret revocation case must pass against the existing HMAC session design; if it fails, stop and add the smallest session-store correction before documentation.

- [ ] **Step 3: Keep hash generation stdin-only and output-safe**

`scripts/generate-blogger-password-hash.mjs` must read the new password from standard input, output only the encoded scrypt hash, reject weak input, and never echo plaintext. Do not add an HTTP or browser reset endpoint.

- [ ] **Step 4: Document the owner-only reset procedure**

In `docs/blogger-deployment.md`, specify:

```text
1. Read the authorized new value from the password manager into stdin.
2. Generate a new scrypt hash locally; never place plaintext in shell history.
3. Update BLOGGER_DIRECT_PASSWORD_HASH and rotate BLOGGER_SESSION_SECRET in protected Coolify variables.
4. Restart only the Blogger sidecar and confirm old cookies fail and new direct login succeeds.
```

Explicitly state that Sofía cannot perform this operation and that portal password/reset flows are unrelated.

- [ ] **Step 5: Run focused tests until green**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 6: Commit the reset boundary**

```bash
git add scripts/generate-blogger-password-hash.mjs tests/blogger-auth.test.mjs tests/blogger-browser-auth.test.mjs tests/post-manager-server.test.mjs docs/blogger-deployment.md deploy/sportmassage-blogger.service.example
git commit -m "docs: define owner-only Blogger credential reset"
```

## Task 6: Complete Local and Cross-Repository Verification

**Files:**
- Verify only: both worktrees and their diffs
- Update tests only when a failure proves an approved requirement is uncovered; do not expand product scope

**Interfaces:**
- Consumes: Tasks 2–5
- Produces: reviewable green branches with no secrets, content mutations, generated junk, or unrelated changes

- [ ] **Step 1: Run the complete Sport Massage verification**

```bash
npm test
npm run check
npm run build:site
git status --short
git diff --check origin/main...HEAD
```

Expected: all commands pass; generated release contains the independent login/editor and no redirect to WF-Admin. Remove only disposable test output, never source content.

- [ ] **Step 2: Run the complete WF-Panel verification**

```bash
npm test
npm run lint
npm run typecheck
npm run build
git status --short
git diff --check origin/main...HEAD
```

Expected: all commands pass; client portal login/dashboard/password recovery remain green, admin owner routes remain green, and no client Blogger surface exists.

- [ ] **Step 3: Run explicit cross-boundary checks locally**

Use synthetic fixtures only; never real credentials:

```text
client Supabase role + admin host -> signed out/404
admin Supabase role + admin host -> panel and owner Blogger available
client portal + Sport project -> no Blogger link/form/iframe
direct Sport credential + Sport origin -> Blogger session only
direct Sport cookie presented to portal/admin -> ignored or rejected
portal/admin cookie presented to Sport origin -> ignored or rejected
wrong siteKey/project/tool -> 404
direct login page -> no recovery/reset controls
```

- [ ] **Step 4: Inspect secret and scope hygiene**

Run repository searches for the authorized email/password values only through a safe secret-scanning mechanism that does not print matches. Confirm no plaintext password, password hash, session secret, handoff secret, or production cookie appears in Git diff, logs, fixtures, docs, generated files, or shell commands.

- [ ] **Step 5: Review both branch diffs**

Confirm the Sport diff touches only authentication/gateway/deployment tests/docs, not editor/content/SEO/translation/publishing behavior. Confirm the WF-Panel diff removes client access while preserving owner administration and ordinary portal features.

- [ ] **Step 6: Push and open two Pull Requests without merging**

Push the Sport branch to `sportmassage` and the admin-isolation branch to `wf-studio-panel`. Open one PR per repository against `main`, attach both PRs to the task, and wait for CI/review. Do not deploy production.

## Task 7: Stage and Deploy in Fail-Safe Phases (Only After Separate Approval)

**Files/Systems:**
- Sport Massage Coolify service and protected variables
- Sport Massage Nginx/Coolify routing for `/admin/blogger/` and existing Blogger APIs
- WF-Panel Coolify deployment
- No DNS change is required for `sportmassagefuengirola.com/admin/blogger/`

**Interfaces:**
- Consumes: merged, CI-green commits from both repositories
- Produces: independent direct Blogger in production and owner-only WF-Admin

- [ ] **Step 1: Prepare staging variables without exposing values**

Configure `BLOGGER_DIRECT_USERNAME`, `BLOGGER_DIRECT_PASSWORD_HASH`, `BLOGGER_SESSION_SECRET`, content/state paths, and existing build settings through protected variables. Initialize the hash from the already authorized password via secure stdin. Do not configure or enable a Studio handoff/SSO secret in this phase.

- [ ] **Step 2: Deploy the Sport Blogger sidecar to staging**

Build the static release and route only `/admin/blogger/`, its login/session/logout endpoints, and existing Blogger APIs to the sidecar as specified by `deploy/nginx-blogger.conf.example`. The rest of the site remains the static release.

- [ ] **Step 3: Run non-content staging smoke tests**

Verify HTTPS, security headers, 200 login shell, no WF-Admin redirect, wrong-login rejection, correct-login session, exact tool/site scope, logout, old-cookie rejection after session-secret rotation, 404 self-service routes, and unchanged public pages. Do not create, edit, publish, or delete an article.

- [ ] **Step 4: Deploy the Sport direct gateway to production first**

Activate `https://sportmassagefuengirola.com/admin/blogger/` and repeat the non-content smoke tests. If the sidecar is unavailable, return a maintenance/503 response; never restore the redirect to `admin.webfuengirola.com`.

- [ ] **Step 5: Deploy WF-Panel admin isolation second**

Deploy the WF-Panel commit only after the independent Sport login is healthy. Verify admin owner login and `/paneladmin/blogger/sportmassagefuengirola`; verify an instrumented synthetic client cannot establish or retain a session on the admin host; verify the normal portal login/dashboard and password recovery still work and no Sport Blogger link appears.

- [ ] **Step 6: Observe and close**

Check redacted health/audit events for login success/failure, session source `direct`, fixed site/tool claims, rate limiting, and absence of client traffic on WF-Admin. Record commit/deployment identifiers and rollback points. Rollback must preserve domain isolation: roll back to maintenance/503, never to the old admin redirect.

## Final Acceptance Checklist

- [ ] `https://sportmassagefuengirola.com/admin/blogger/` serves the independent login/editor and never redirects to WF-Admin.
- [ ] The direct credential is stored only as a Sport-side scrypt hash and is independent of Supabase portal credentials.
- [ ] Direct sessions contain only Sport Massage Blogger scope and cannot cross origins, clients, projects, or tools.
- [ ] No client password, magic link, callback, support cookie, portal token, or direct-tool cookie establishes a client session on `admin.webfuengirola.com`.
- [ ] The client portal keeps its existing account/password/magic-link/recovery functionality but exposes no Blogger link or SSO in this phase.
- [ ] Sofía has no direct Blogger password recovery/change endpoint; only the documented owner operation can reset it and revoke sessions.
- [ ] Owner admin Blogger access, existing editor behavior, translations, SEO, media, publishing, content, and public static pages remain unchanged.
- [ ] Both complete suites, lint/typecheck/build checks, CI runs, and non-content staging smoke tests are green before production activation.
