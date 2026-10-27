# Sport Massage Branded Blogger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve the central Sport Massage Blogger safely at its branded custom-domain root with both direct credentials and one-click panel handoff.

**Architecture:** Add a validated custom Blogger origin to the site registry, route that host to one tenant only, and exchange the portal's existing single-use launch ticket for a host-only Blogger session. Keep the current portal route as a compatibility path and update the static Sport Massage gateway separately.

**Tech Stack:** Next.js middleware and route handlers, TypeScript/ES modules, Supabase RPC launch tickets, Node test runner.

**Spec:** `docs/superpowers/specs/2026-10-27-sportmassage-branded-blogger-design.md`

## Global Constraints

- No new application, container, database, editor, or article publication.
- `https://blogger.sportmassagefuengirola.com/` exposes only the Sport Massage Blogger surface.
- Sessions remain `Secure`, `HttpOnly`, `SameSite=Strict`, host-only cookies.
- Portal and administrator behavior must remain unchanged.
- Every product-code change follows red-green-refactor.

## Review Focus

- Conflicting or comma-separated proxy hosts must fail closed before cookies are read.
- A custom host must never select a site key from a user-controlled path or query.
- Expired, replayed, wrong-audience, or wrong-site tickets must create no session.
- Custom-host requests to client, admin, auth, analytics, or another tenant must return 404.
- A failed exchange must not leak the code in the final URL, body, logs, or referrer.

---

### Task 1: Validated custom-host registry

**Files:**
- Modify: `src/config/sites.json`
- Modify: `src/lib/sites/manifest.ts`
- Modify: `src/lib/sites/registry.mjs`
- Create: `src/lib/blogger/custom-hosts.mjs`
- Create: `src/lib/blogger/custom-hosts-module.d.ts`
- Test: `tests/site-registry.test.mjs`

**Interfaces:**
- Produces: `getCustomBloggerSiteByHost(hostname)` and `getCustomBloggerOrigin(site)`.

- [ ] Write tests proving the exact Sport Massage host maps to its site and malformed, unrelated, duplicate, or non-HTTPS custom origins are rejected.
- [ ] Run the focused registry tests and verify they fail because custom origins are unsupported.
- [ ] Add the manifest field, validation, and host lookup with exact normalized matching.
- [ ] Run the focused tests and verify they pass.

### Task 2: Dedicated custom-host routing and direct access

**Files:**
- Modify: `middleware.ts`
- Modify: `src/lib/security/redirects.mjs`
- Modify: `src/lib/security/mutations.mjs`
- Modify: `src/lib/blogger/direct-access-server.ts`
- Modify: `src/app/api/blogger/direct-session/route.ts`
- Modify: `src/app/acceso/blogger/[siteKey]/page.tsx`
- Test: `tests/direct-blogger-host-routing.test.mjs`
- Test: `tests/blogger-direct-session-route.test.mjs`

**Interfaces:**
- Consumes: exact host-to-site mapping from Task 1.
- Produces: a root rewrite, strict custom-host allowlist, and host-aware direct login/logout redirects.

- [ ] Write tests for root rewrite, required Blogger assets/APIs, denied general routes, ambiguous proxy headers, direct login, invalid credentials, and logout at the branded origin.
- [ ] Run the focused tests and verify the missing custom-host behavior fails.
- [ ] Implement the strict middleware surface and pass allowed hosts through origin/mutation resolution.
- [ ] Make direct session lookup and login/logout accept only the mapped custom host and redirect to its clean root.
- [ ] Run the focused tests and verify they pass without changing portal/admin expectations.

### Task 3: Cross-domain one-click ticket exchange

**Files:**
- Create: `src/app/api/blogger/handoff/route.ts`
- Modify: `src/app/api/tools/blogger/[siteKey]/launch/route.ts`
- Modify: `src/app/acceso/blogger/[siteKey]/page.tsx`
- Modify: `src/components/blogger/direct-blogger-shell.tsx`
- Test: `tests/sport-blogger-central-access.test.mjs`
- Create: `tests/blogger-custom-handoff-route.test.mjs`

**Interfaces:**
- Consumes: custom origin mapping and existing `createLaunchTicket`/`consumeLaunchTicket` RPC helpers.
- Produces: `GET /api/blogger/handoff?code=<single-use-code>` on the mapped host, then a clean-root session.

- [ ] Write tests proving panel launch binds the ticket to the custom origin and does not set a portal Blogger cookie.
- [ ] Write route tests for successful exchange, clean redirect, secure cookie, replay/expiry/mismatch failure, and wrong-host rejection.
- [ ] Run the focused tests and verify they fail for the absent exchange.
- [ ] Redirect configured central tenants to their custom exchange endpoint and consume the code on that host.
- [ ] Ensure panel-created sessions show logout and use the public site as Home on the branded shell.
- [ ] Run all Blogger routing, authorization, and launch tests and verify they pass.

### Task 4: Regression, deployment, and static gateway

**Files:**
- Modify in `sport-massage-fuengirola`: `admin/blogger/index.html`
- Modify in `sport-massage-fuengirola`: `scripts/verify-blogger-deployment.mjs`
- Modify in `sport-massage-fuengirola`: gateway tests and deployment documentation

**Interfaces:**
- Consumes: deployed branded root from Tasks 1-3.
- Produces: the old static shortcut redirecting to the new branded root.

- [ ] Run the complete WF-Studio Panel test suite, type check, and production build.
- [ ] Commit, push, review, and merge the panel branch through a pull request.
- [ ] Verify Coolify deployment, TLS, branded direct login/logout, panel ticket launch, and denied routes without publishing content.
- [ ] In the Sport Massage repository, write failing gateway tests for the branded destination, update the redirect/verifier/docs, and run its complete suite.
- [ ] Commit, push, review, and merge the Sport Massage gateway pull request.
- [ ] Repeat the two public entry-flow checks after the gateway deploy.
