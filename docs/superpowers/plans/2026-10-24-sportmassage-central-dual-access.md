# Sport Massage Central Dual Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide one central Sport Massage Blogger editor with one-time Área Cliente entry and direct Supabase password entry.

**Architecture:** Reuse the existing 60-second hashed launch ticket, but deliver it internally by POST to the Studio admin host. The consume route atomically consumes and revalidates the ticket, creates the same user's Supabase session server-side, and redirects to the existing direct central editor route.

**Tech Stack:** Next.js App Router, TypeScript, Supabase Auth/Postgres, Node test runner.

**Spec:** `docs/superpowers/specs/2026-10-24-sportmassage-central-dual-access-design.md`

## Global Constraints

- Change only `wf-studio-panel`; do not modify Sport Massage public files or repository.
- Sport Massage only; no access widening to another client or site.
- No credentials, passwords, tickets, service keys or verification tokens in URLs, browser-visible configuration, logs or Git.
- Preserve Umami and all existing portal behavior.
- Use RED→GREEN for every behavior and do not implement the GitHub-to-Hostinger bridge.

## Review Focus

- Ticket replay or concurrent consume must never create a second session.
- A ticket bound to another site, project, client or user must fail without leaking which check failed.
- Failure after atomic consumption must not expose the ticket or generated Supabase token.
- Direct login must preserve only the canonical Sport Massage destination and deny unassigned users.
- Registry cleanup must not change Blogger or analytics behavior for any other site.

---

### Task 1: Central-only Sport Massage registry and authorization

**Files:**
- Modify: `src/config/sites.json`
- Modify: `src/lib/projects/blogger-validation.ts`
- Modify: `tests/site-registry.test.mjs`
- Modify: `tests/blogger-authorization.test.mjs`
- Modify: `tests/blogger-editor-routing.test.mjs`

**Interfaces:**
- Produces: Sport Massage resolves only to `{ kind: 'iframe', href: '/blogger/index.html' }`; central runtimes authorize from active assignment/capability without external handoff metadata.

- [ ] Write registry/editor/authorization tests that reject external handoff fields and accept the active central capability.
- [ ] Run the focused tests and verify they fail for the current external handoff contract.
- [ ] Remove Sport Massage external handoff fields and make capability validation runtime-aware without weakening external runtimes.
- [ ] Run the focused tests and the full suite.
- [ ] Commit the task.

### Task 2: Internal one-time launch and Supabase session convergence

**Files:**
- Modify: `src/app/api/tools/blogger/[siteKey]/launch/route.ts`
- Create: `src/app/api/tools/blogger/[siteKey]/consume/route.ts`
- Create: `src/lib/blogger/internal-access.ts`
- Create: `src/lib/blogger/internal-access-module.d.ts`
- Modify: `src/app/cliente/(protected)/proyectos/[slug]/blogger/page.tsx`
- Modify: `src/app/paneladmin/(protected)/blogger/[siteKey]/page.tsx`
- Modify: `tests/blogger-tool-launch.test.mjs`
- Modify: `tests/client-project-routes.test.mjs`

**Interfaces:**
- Consumes: `createLaunchTicket`, `consumeLaunchTicket`, `authorizeBloggerSite` project contract and the central Sport editor target from Task 1.
- Produces: internal launch HTML that POSTs to the admin host; `establishBloggerSupabaseSession(...)` that validates the consumed binding and establishes the same user's Supabase session.

- [ ] Write failing tests for internal POST delivery, no token in URL/logs, valid session creation, replay, expiry, wrong site/user/client/project and unassigned client denial.
- [ ] Run the focused tests and verify each new behavior fails for the expected missing implementation.
- [ ] Implement the minimal internal launch, consume route and server-only Supabase session exchange.
- [ ] Run the focused tests and full suite.
- [ ] Commit the task.

### Task 3: Direct access regression and secure provisioning guidance

**Files:**
- Modify: `tests/direct-blogger-access.test.mjs`
- Modify: `tests/client-auth-destination.test.mjs`
- Modify: `README.md`
- Modify: `.env.example`

**Interfaces:**
- Consumes: the central direct route and authorization contract from Tasks 1–2.
- Produces: documented password provisioning/reset procedure without credential values and regression coverage for canonical return-to-editor behavior.

- [ ] Write failing regressions proving both entry paths target the same editor and unassigned direct users are denied; add a credential-safety assertion for the environment contract.
- [ ] Run the focused tests and confirm the expected failures.
- [ ] Remove obsolete Sport handoff-secret documentation and document secure Supabase Auth provisioning/reset.
- [ ] Run focused tests, full suite, lint, typecheck and build.
- [ ] Commit the task.

### Task 4: Independent review and release preparation

**Files:**
- Review: all changes since `origin/main`

**Interfaces:**
- Consumes: Tasks 1–3 complete and verified.
- Produces: reviewer findings resolved for Critical/Important severity and a PR-ready branch.

- [ ] Request an independent read-only review against this plan.
- [ ] Re-grade findings; fix Critical/Important issues with RED→GREEN tests and rerun the full verification suite.
- [ ] Verify no `sportmassage` repository file changed and inspect the final diff for secrets.
- [ ] Push the `codex/` branch and open a PR against `main` if the branch remains clean and verified; do not merge.
