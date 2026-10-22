# Direct Blogger Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make each website's `/admin/blogger/` entry authenticate with the client's Studio identity and open that exact site's Blogger editor immediately, including Sport Massage, without exposing Samuel's administration panel.

**Architecture:** Add a dedicated Studio route, `/acceso/blogger/[siteKey]`, which explicitly authenticates and authorizes the exact Blogger site, then renders the existing editor in a minimal client-safe shell. Preserve a sanitized destination through password and magic-link authentication. Change Sport Massage's static redirect only after the Studio route is deployed and verified.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Supabase Auth, existing multisite Blogger runtime, Node test runner; Sport Massage static site repository for the public redirect.

**Spec:** `docs/superpowers/specs/2026-10-20-project-workspaces-and-direct-blogger-access-design.md`

## Global Constraints

- Use the same Studio account and project entitlement; do not create, store or expose a separate Blogger password.
- Never give a client access to `/paneladmin`, global project data or another site's Blogger API.
- Accept only sanitized internal return destinations. Reject external, protocol-relative, malformed and unrelated paths.
- Keep the existing project Blogger route working as a secondary path.
- Deploy Studio before changing the public Sport Massage entry, so the external redirect never points to a missing route.
- Changes to `wf-studio-panel` and `sportmassage` require separate branches, commits, Pull Requests and deployment verification in their source-of-truth repositories.

## Review Focus

- Test both password and magic-link return paths.
- Test unauthenticated, authorized client, unauthorized client and administrator entry.
- Confirm the shell has no administrator navigation and all API authorization remains independent of page rendering.
- Confirm Sport Massage WordPress/blog ZIP references do not reappear.

---

## Task 1: Preserve a safe destination through client authentication

**Files:**

- Modify: `src/lib/security/redirects.mjs`
- Modify: `src/app/cliente/page.tsx`
- Modify: `src/components/auth/client-login-form.tsx`
- Modify: `src/lib/actions/auth.ts`
- Modify: `tests/security.test.mjs`
- Create: `tests/client-auth-destination.test.mjs`

Add a narrowly scoped helper:

```ts
sanitizeClientDestination(value: unknown): string;
```

Allowed results are client portal paths and `/acceso/blogger/<validated-segment>`; every invalid input falls back to `/cliente/dashboard`.

- [ ] Write failing redirect tests for valid client paths, valid direct Blogger paths, external URLs, protocol-relative URLs, encoded bypass attempts, invalid site segments and administrator destinations.
- [ ] Write failing auth action tests proving password login redirects to the sanitized destination and magic-link login sends `/auth/callback?next=<encoded destination>`.
- [ ] Write a failing login-page test proving an already-authenticated client honors the same safe destination.
- [ ] Run `node --test tests/security.test.mjs tests/client-auth-destination.test.mjs` and confirm failure.
- [ ] Implement destination sanitization, pass it through a hidden form field, preserve it in both auth methods, and use the existing callback's `next` support.
- [ ] Keep `/cliente/dashboard` as the default when no valid destination exists.
- [ ] Re-run the focused tests and confirm they pass.
- [ ] Commit with `git commit -m "fix: preserve client tool destination through login"`.

## Task 2: Add the dedicated authorized Blogger route

**Files:**

- Create: `src/app/acceso/blogger/[siteKey]/page.tsx`
- Create: `src/components/blogger/direct-blogger-shell.tsx`
- Modify: `src/lib/blogger/authorize.ts`
- Create: `tests/direct-blogger-access.test.mjs`
- Modify: `tests/blogger-authorization.test.mjs`

- [ ] Write failing route tests for: no session redirects to `/cliente?redirectedFrom=/acceso/blogger/<siteKey>`; authorized Sofia resolves Sport Massage; the authorized aGama client resolves only the aGama editor from `/acceso/blogger/agama`; unauthorized client receives the controlled not-found/forbidden result; administrator access succeeds.
- [ ] Add a failing shell test requiring only site identity, `Inicio`, and the existing Blogger editor—never `AdminShell`, global navigation, project configuration or other clients.
- [ ] Run `node --test tests/direct-blogger-access.test.mjs tests/blogger-authorization.test.mjs` and confirm failure.
- [ ] Implement explicit authentication in the route because `/acceso/*` is outside the existing `/cliente/*` middleware matcher. Retain the exact safe destination before redirecting to login.
- [ ] Reuse `authorizeBloggerSite(siteKey)` and `getBloggerEditorTarget`; do not rely on route visibility as the API authorization boundary.
- [ ] Render the existing editor in the minimal direct shell and provide `Inicio` appropriate to the identity role.
- [ ] Run the focused tests and confirm they pass.
- [ ] Commit with `git commit -m "feat: add direct authorized blogger access"`.

## Task 3: Point generated website Blogger entries at the direct route

**Files:**

- Modify the canonical Blogger/static-entry generator file identified by `rg -n "cliente/proyectos/.*/blogger|admin/blogger"` in `wf-studio-panel`.
- Modify: `tests/blogger-tool-launch.test.mjs`
- Modify: `tests/blogger-runtime-contract.test.mjs`

- [ ] Add failing generator/runtime tests requiring a site's public `/admin/blogger/` entry to target `/acceso/blogger/<siteKey>` and rejecting the generic client dashboard/project overview as a launch target.
- [ ] Run `node --test tests/blogger-tool-launch.test.mjs tests/blogger-runtime-contract.test.mjs` and confirm failure.
- [ ] Update the shared entry generation rule so future activated sites receive the direct route automatically.
- [ ] Keep administrator project links on `/paneladmin/blogger/<siteKey>` and client in-panel links working; only the public direct entry changes.
- [ ] Run the focused Blogger tests.
- [ ] Commit with `git commit -m "feat: generate direct blogger entry links"`.

## Task 4: Verify Studio end to end before touching Sport Massage

**Files:** No new product files unless verification finds a defect.

- [ ] Run `npm test`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.
- [ ] Test password login and magic-link login from `/acceso/blogger/sportmassagefuengirola` in a non-production or preview deployment.
- [ ] Confirm Sofia reaches only the Sport Massage editor, can list/create/edit a test draft, and cannot access aGama, Samuel Coach or administrator navigation.
- [ ] Confirm an administrator can open the same direct route and the normal `/paneladmin/blogger/<siteKey>` route.
- [ ] Inspect `git diff --check`, `git status --short`, and the final diff for secrets.
- [ ] Push the Studio branch, open a Pull Request against `main`, attach it to the task, merge/deploy only through the approved repository workflow, and verify the deployed direct route returns the expected login/editor shell.

## Task 5: Update Sport Massage's static `/admin/blogger/` entry

**Repository:** `sportmassage` (separate source of truth).

**Files:** Determine the tracked source for `/admin/blogger/index.html` and its generator/test before editing; do not edit generated deployment output alone.

- [ ] Before editing, inspect branch, worktree and upstream divergence in the Sport Massage repository and preserve all unrelated local changes.
- [ ] Create a dedicated `codex/` branch.
- [ ] Add a failing repository test or source assertion requiring the public entry to redirect to `https://admin.webfuengirola.com/acceso/blogger/sportmassagefuengirola`.
- [ ] Run the focused test and confirm the old `/cliente/proyectos/sportmassagefuengirola/blogger` destination fails it.
- [ ] Change only the canonical static entry/generator and preserve the static HTML blog; do not restore WordPress, ZIP downloads or legacy Blogger references.
- [ ] Run the Sport Massage test/build suite and inspect the generated `/admin/blogger/` output.
- [ ] Commit with `git commit -m "fix: open Sport Massage Blogger directly"`.
- [ ] Push and open a separate Pull Request against that repository's default branch; attach the PR to the task.
- [ ] After explicit deployment authorization, deploy the static site and verify the public URL reaches the already-deployed Studio direct route.

## Task 6: Final production acceptance

**Files:** No source changes unless acceptance reveals a defect.

- [ ] In a private session, open Sport Massage `/admin/blogger/`, sign in as the authorized client, and verify the first post-login page is the Sport Massage editor.
- [ ] Repeat with a magic link and confirm the callback preserves the same destination.
- [ ] Verify the client Home link shows only their portal home, statistics, reports and bonuses allowed by their account.
- [ ] Verify Samuel's admin Inicio and Projects workspace still expose their administrator Blogger links.
- [ ] Verify unauthorized and malformed direct URLs reveal no project data.
- [ ] Record deployed commit/PR identities and any user-owned environment variables still required; never record their values.
