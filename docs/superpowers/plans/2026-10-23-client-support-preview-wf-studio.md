# Client Support Preview — WF Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an administrator inspect the real portal of any active client in a temporary, audited and server-enforced read-only support session.

**Architecture:** Keep the authenticated Supabase administrator unchanged and resolve a separate opaque support session into a typed `PortalViewer`. All portal reads use the selected client from that server context; every mutation uses a centralized guard that rejects support mode. External Blogger launch uses a new v2 read-only ticket only when the destination advertises support.

**Tech Stack:** Next.js App Router, TypeScript, React Server Components/actions, Supabase Postgres/RLS, Node test runner, Zod.

**Spec:** `docs/superpowers/specs/2026-10-23-client-support-preview-design.md`

**Companion:** Sport Massage branch `codex/sport-support-readonly-plan`, plan `docs/superpowers/plans/2026-10-23-sportmassage-support-readonly.md`; both sides freeze the same v2 keys before implementation.

## Global Constraints

- Support preview lasts at most 30 minutes and uses `__Host-wf_support_preview` with `Secure`, `HttpOnly`, `SameSite=Lax`, and `Path=/`.
- The real Supabase identity and `profiles.role` never change; no client password or client login session is created.
- The browser never supplies the authoritative client ID, project ID, role, scope, return path, or expiry.
- Support mode permits reads and local UI exploration but rejects every database mutation and external side effect server-side.
- Existing `wf-blogger-handoff/v1` exact-key editing behavior remains unchanged.
- Support launch uses exact-key `wf-blogger-handoff/v2` with scope `support_readonly` and fails closed when the destination does not advertise it.
- Do not use the Supabase service role for portal data reads; use it only for the existing one-time launch-ticket boundary.
- The feature remains disabled in production until the Sport Massage v2 acceptance flow passes.

## Review Focus

- Every current protected client route, including legacy account pages, must resolve the same selected `PortalViewer`; no direct client-only guard may redirect a valid support administrator (Task 2 tests).
- Direct replay of any central or legacy Blogger mutation route during support must return 403 before parsing or side effects, while an administrator outside support retains normal authority (Task 6 tests).
- A stale cookie for a deleted, inactive or differently assigned client must persist the end reason, clear safely and return to an approved admin path without exposing old data (Task 2 tests).
- Two simultaneous preview starts for one admin must leave exactly one active session and mark the other `replaced` (Task 1 tests).
- A v1-only or stale/mismatched Sport release must never receive a support ticket or editable session even when the registry claims Blogger is active (Task 6 tests).

---

### Task 1: Persistent support-session boundary

**Files:**
- Create: `supabase/migrations/202610230001_admin_support_sessions.sql`
- Create: `src/lib/support/support-session.ts`
- Modify: `src/lib/supabase/types.ts`
- Create: `tests/support-session-migration.test.mjs`
- Create: `tests/support-session-postgres.test.mjs`
- Create: `scripts/test-support-postgres.mjs`
- Create: `supabase/config.toml`
- Create: `tests/support-session-core.test.mjs`
- Modify: `tests/migrations.test.mjs`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: `SupportSessionContext`, `createSupportSession(db, input, options)`, `resolveSupportSession(db, input, options)`, `endSupportSession(db, input, reason)`, `supportCookie(token, maxAgeSeconds)`, and `clearSupportCookie()`.
- Consumes: an authenticated administrator Supabase connection from `requireAdmin`; a server-validated active client lookup key; approved `/paneladmin/*` return paths only. Database RPCs derive the administrator from `auth.uid()`.
- `npm run test:db` invokes `scripts/test-support-postgres.mjs` with pinned `supabase@2.105.0` and `pg@8.16.3`. The script runs the local CLI binary with telemetry disabled, starts the stack, applies every migration through `supabase db reset --local --no-seed`, parses `supabase status --output json` in memory for the database URL without printing it, and always runs `supabase stop --no-backup` in `finally`. The Node test uses two independent `pg` connections; each transaction sets role `authenticated` and `request.jwt.claim.sub`/`request.jwt.claim.role`, seeds unique profile/client fixtures, and cleans them before teardown. CI runs the same Docker-backed command.

- [ ] **Step 1: Write failing migration and PostgreSQL integration tests** asserting the `admin_support_sessions` columns/checks, owner-scoped admin RLS, no client grants, token-hash uniqueness, `ended_at` active-session uniqueness, 30-minute maximum and atomic replacement; also assert an append-only owner-scoped `admin_support_events` table tied to session, client, project, capability and fixed `support_readonly` scope. Exercise admin A, admin B and client JWT claims against a local Supabase/Postgres service rather than relying only on source regexes.

- [ ] **Step 2: Run `node --test tests/support-session-migration.test.mjs tests/migrations.test.mjs`** and confirm failure because the migration is absent.

- [ ] **Step 3: Add migration `202610230001_admin_support_sessions.sql`** with `security definer set search_path = pg_catalog, public` start/end RPCs. Revoke default execution, grant only `authenticated`, derive the administrator from `auth.uid()` plus `profiles.role='admin'`, never accept an administrator ID parameter, and serialize starts with `pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0))` before replacing the prior session. Create `admin_support_events` as append-only with no direct insert/update/delete grant; Task 6's atomic service-role RPC is its only writer.

- [ ] **Step 4: Update `src/lib/supabase/types.ts`** for `admin_support_sessions`, `admin_support_events`, and the start/end RPC signatures.

- [ ] **Step 5: Write failing core tests** for 32-byte random opaque tokens, SHA-256 persistence input, exact cookie flags, approved return paths, expiry, wrong-admin rejection, and concurrent replacement.

- [ ] **Step 6: Implement `src/lib/support/support-session.ts`** with the interfaces above; `now` and `randomBytes` are injectable only through test options.

- [ ] **Step 7: Add the pinned dependencies, `supabase/config.toml` with project ID `wf-studio-support-test`, the exact orchestration/claim setup above, `npm run test:db`, and its CI step; then run the source/core tests plus `npm run test:db`** and confirm concurrent starts deterministically leave one active row, one `replaced` row, cross-admin/client access fails, and direct event writes are denied.

- [ ] **Step 8: Commit** with `git commit -m "feat: add audited support sessions"`.

### Task 2: Unified portal viewer and fail-closed project resolution

**Files:**
- Create: `src/lib/support/portal-viewer.ts`
- Create: `src/app/api/support-preview/clear/route.ts`
- Modify: `src/lib/auth.ts`
- Modify: `src/lib/data/projects.ts`
- Modify: `src/lib/projects/client-access.ts`
- Modify: `src/app/cliente/(protected)/actualizaciones/page.tsx`
- Modify: `src/app/cliente/(protected)/bonos/page.tsx`
- Modify: `src/app/cliente/(protected)/facturas/page.tsx`
- Modify: `src/app/cliente/(protected)/fotografias/page.tsx`
- Modify: `src/app/cliente/(protected)/historial/page.tsx`
- Modify: `src/app/cliente/(protected)/informes/page.tsx`
- Modify: `src/app/cliente/(protected)/mensajeria/page.tsx`
- Modify: `src/app/cliente/(protected)/packs/page.tsx`
- Modify: `src/app/cliente/(protected)/pendientes/page.tsx`
- Modify: `src/app/cliente/(protected)/servicios/page.tsx`
- Modify: `tests/helpers/project-harness.mjs`
- Create: `tests/support-portal-viewer.test.mjs`
- Modify: `tests/client-project-routes.test.mjs`
- Modify: `tests/client-analytics-access.test.mjs`

**Interfaces:**
- Consumes: Task 1 `resolveSupportSession` and cookie name.
- Produces: `PortalViewer`, `requirePortalViewer(): Promise<PortalViewer>`, `requireClientMutationAccess(): Promise<ClientViewer>`, `getOptionalSupportViewer(): Promise<SupportViewer | null>`, and a server-only clear/redirect route for invalid support cookies.
- `PortalViewer` is discriminated by `mode: 'client' | 'support'`; support includes `supportSessionId`, `expiresAt`, and sanitized `returnPath`.

- [ ] **Step 1: Write failing viewer tests** for real client, admin with valid support session, admin without session, wrong-admin cookie, inactive client, expired session, feature flag disabled, and a client carrying an ignored support cookie; prove invalid support state redirects through the clear route and never loops.

- [ ] **Step 2: Run `node --test tests/support-portal-viewer.test.mjs tests/client-project-routes.test.mjs`** and confirm failures at the missing viewer API.

- [ ] **Step 3: Implement `portal-viewer.ts`, the cookie-clearing route, and minimal auth exports** without changing `requireAdmin()` or ordinary `requireClientAccess()` behavior. Resolution checks `WF_SUPPORT_PREVIEW_ENABLED` on every request. Because arbitrary Server Components cannot mutate cookies, invalid/expired/inactive/revoked support state redirects through the route, which persists the exact end reason, clears the cookie, and redirects only through a normalization helper that rejects protocol-relative paths, encoded separators, backslashes, fragments and unapproved query keys; otherwise use `/paneladmin/inicio`.

- [ ] **Step 4: Change `getClientPortalContext()` and `requireClientCapability()`** to accept the unified viewer, load projects through the selected server-side client ID and return `viewerMode`, `supportSessionId`, `supportExpiresAt`, and `returnPath` without exposing the cookie token.

- [ ] **Step 5: Write the failing route-matrix and revocation tests** proving every current protected client page works for a real client and valid support administrator, an administrator without support is rejected, and reassigned/inactive/archived/`client_access_enabled=false` projects disappear on the next request.

- [ ] **Step 6: Convert every listed account page from direct `requireClientAccess()`/legacy capability access to `PortalViewer`** while leaving pages already using `getClientPortalContext()` on that shared path.

- [ ] **Step 7: Run the task tests** and confirm pass, including existing client route and analytics authorization tests.

- [ ] **Step 8: Commit** with `git commit -m "feat: resolve client portal support viewers"`.

### Task 3: Admin entry, persistent banner, and safe exit

**Files:**
- Create: `src/lib/actions/support-preview.ts`
- Create: `src/components/admin/support-preview-form.tsx`
- Create: `src/components/client/support-preview-banner.tsx`
- Modify: `src/app/paneladmin/(protected)/clientes/[id]/page.tsx`
- Modify: `src/app/paneladmin/(protected)/proyectos/[id]/page.tsx`
- Modify: `src/app/cliente/(protected)/layout.tsx`
- Modify: `src/components/layout/client-shell.tsx`
- Modify: `src/app/auth/sign-out/route.ts`
- Modify: `src/lib/i18n.ts`
- Create: `tests/support-preview-ui.test.mjs`
- Modify: `tests/project-admin-ui.test.mjs`

**Interfaces:**
- Consumes: Task 1 session create/end helpers and Task 2 `PortalViewer` fields.
- Produces: `startSupportPreviewAction(formData)`, `endSupportPreviewAction()`, `SupportPreviewForm`, and `SupportPreviewBanner`.

- [ ] **Step 1: Write failing action tests** proving only admins can start, the target client is loaded server-side and active, return paths are allowlisted, disabled feature flag rejects start, and exit ends the exact owner session then clears the cookie; prove the client sign-out endpoint cannot sign out the real administrator while support mode is active.

- [ ] **Step 2: Write failing UI tests** for `Ver como {client}`, disabled explanations for unassigned/inactive/inaccessible projects, mobile/desktop banner content, countdown metadata, return action, and replacement of both desktop/mobile client sign-out controls with the support exit action.

- [ ] **Step 3: Run `node --test tests/support-preview-ui.test.mjs tests/project-admin-ui.test.mjs`** and confirm the new controls are absent.

- [ ] **Step 4: Implement server actions and entry controls** using `WF_SUPPORT_PREVIEW_ENABLED`; treat submitted client IDs only as lookup keys that must resolve to an active client, and accept return paths only after the server allowlist validates them.

- [ ] **Step 5: Add the banner to `ClientShell`** through layout-provided support props and replace client sign-out with support exit in both responsive layouts; ordinary client rendering and real-client sign-out must remain unchanged in the existing snapshot assertions.

- [ ] **Step 6: Run task tests and `npm run typecheck`**; confirm pass.

- [ ] **Step 7: Commit** with `git commit -m "feat: add client support preview controls"`.

### Task 4: Server-enforced read-only client actions

**Files:**
- Modify: `src/lib/actions/messages.ts`
- Modify: `src/lib/actions/resources.ts`
- Modify: `src/lib/data/client.ts`
- Modify: `src/app/cliente/(protected)/mensajeria/page.tsx`
- Modify: `src/app/cliente/(protected)/servicios/page.tsx`
- Modify: `src/app/cliente/(protected)/pendientes/page.tsx`
- Modify: `src/components/client/message-composer.tsx`
- Modify: `src/components/client/request-form.tsx`
- Modify: `src/components/client/resource-form.tsx`
- Create: `tests/support-readonly-actions.test.mjs`
- Modify: `tests/client-dashboard-summary.test.mjs`

**Interfaces:**
- Consumes: Task 2 `requireClientMutationAccess()` and `PortalViewer.mode`.
- Produces: `SupportReadOnlyError` with code `support_readonly`, HTTP status 403 for route handlers, server-action result `{ ok: false; error: 'support_readonly'; message: 'No disponible en modo soporte.' }`, and presentation prop `readOnly: boolean`.

- [ ] **Step 1: Write failing mutation tests** invoking every client-facing server action and mutation route under support mode and asserting zero insert/update/delete calls, zero email calls, zero uploads/builds, and the typed read-only error; maintain a route/action matrix so a newly exposed portal mutation cannot be omitted silently.

- [ ] **Step 2: Add the hidden-side-effect regression test** proving rendering received messages in support mode leaves all `read_at` values unchanged while a real client still marks them read.

- [ ] **Step 3: Run `node --test tests/support-readonly-actions.test.mjs tests/client-dashboard-summary.test.mjs`** and confirm current writes occur or guards are missing.

- [ ] **Step 4: Replace client mutation authentication with `requireClientMutationAccess()`** before body/form parsing, revalidation, writes, uploads or external email; add the missing guard to `markMessageReadAction`.

- [ ] **Step 5: Pass `readOnly` into forms and composers** so dialogs remain inspectable but submit/upload/reply controls are disabled with the exact explanation.

- [ ] **Step 6: Skip render-time message read updates for support viewers** and preserve existing real-client behavior.

- [ ] **Step 7: Run task tests plus `tests/portal-navigation.test.mjs`** and confirm every current `/cliente/*` route either has no mutation surface or is covered by the shared guard matrix.

- [ ] **Step 8: Commit** with `git commit -m "feat: enforce read-only support mode"`.

### Task 5: Constrain every support read to the selected client

**Files:**
- Modify: `src/app/api/client-resources/[id]/route.ts`
- Modify: `src/lib/data/client.ts`
- Modify: `src/lib/analytics/project-access.ts`
- Modify: `src/app/api/analytics/[project]/route.ts`
- Modify: `src/app/cliente/(protected)/proyectos/[slug]/estadisticas/page.tsx`
- Create: `tests/support-resource-access.test.mjs`
- Create: `tests/support-client-data-access.test.mjs`
- Modify: `tests/client-analytics-access.test.mjs`
- Modify: `tests/client-resources.test.mjs`

**Interfaces:**
- Consumes: Task 2 `getOptionalSupportViewer()` and authorized project list.
- Produces: `resolvePortalAnalyticsTarget(projectSlug, viewer)`, support-aware resource ownership filtering, and pack-summary reads limited to pack IDs already authorized for the selected client.

- [ ] **Step 1: Write failing tests** for selected-client resources, cross-client denial, support analytics for an assigned project, reassignment denial, unchanged admin access outside support, `pack_summary` queries restricted to the selected client's loaded pack IDs, and a portal-route matrix proving every current read resolves through the selected-client context.

- [ ] **Step 2: Run the four target test files** and confirm the admin support request is currently over-broad or redirected.

- [ ] **Step 3: Implement support-aware ownership filters** before document response or Umami resolution; make summary queries follow the authorized pack query instead of reading the whole view, and preserve server-only diagnostics and credentials.

- [ ] **Step 4: Run target tests and `tests/project-analytics-resolution.test.mjs`** and confirm pass.

- [ ] **Step 5: Commit** with `git commit -m "feat: scope support reads to client projects"`.

### Task 6: Versioned read-only Blogger handoff

**Files:**
- Create: `supabase/migrations/202610230002_tool_launch_ticket_scopes.sql`
- Modify: `src/lib/supabase/types.ts`
- Modify: `src/lib/tools/launch-tickets.mjs`
- Create: `src/lib/tools/blogger-discovery.ts`
- Modify: `src/app/api/tools/blogger/[siteKey]/launch/route.ts`
- Modify: `src/app/api/tool-launch/exchange/route.ts`
- Modify: `src/lib/sites/registry.mjs`
- Modify: `src/config/sites.json`
- Modify: `src/lib/sites/registry-module.d.ts`
- Modify: `src/app/cliente/(protected)/proyectos/[slug]/blogger/page.tsx`
- Modify: `src/lib/blogger/authorize.ts`
- Modify: `src/lib/blogger/legacy-authorize.ts`
- Modify: `src/app/api/blogger/[siteKey]/posts/route.ts`
- Modify: `src/app/api/blogger/[siteKey]/posts/[slug]/route.ts`
- Modify: `src/app/api/blogger/[siteKey]/posts/[slug]/images/route.ts`
- Modify: `src/app/api/blogger/[siteKey]/posts/[slug]/images/[file]/route.ts`
- Modify: `src/app/api/blogger/[siteKey]/build/route.ts`
- Modify: `src/app/api/posts/route.ts`
- Modify: `src/app/api/posts/[slug]/route.ts`
- Modify: `src/app/api/posts/[slug]/images/route.ts`
- Modify: `src/app/api/posts/[slug]/images/[file]/route.ts`
- Modify: `src/app/api/build/route.ts`
- Create: `tests/support-blogger-handoff.test.mjs`
- Modify: `tests/support-session-postgres.test.mjs`
- Modify: `tests/blogger-tool-launch.test.mjs`
- Modify: `tests/site-registry.test.mjs`

**Interfaces:**
- Consumes: Task 2 valid support viewer and exact authorized project; Sport discovery protocol/scopes from the companion plan.
- Produces: `HANDOFF_PROTOCOL_V2`, `LaunchScope = 'blogger' | 'support_readonly'`, v2 ticket rows with `scope`, `support_session_id` and `session_expires_at`, atomic service-role RPC `create_support_tool_launch_ticket`, exact v2 serializers/validators, `fetchVerifiedBloggerDiscovery()`, and read/write Blogger authorization guards.
- Exact v2 launch fragment and Sport launch body: `{ protocol, code, siteKey }`; exact Sport-to-WF exchange request: `{ protocol, code, siteKey }`; exact WF response: `{ protocol, siteKey, audience, scope, sessionExpiresAt, subject }`, where `scope` is one `LaunchScope` string and `sessionExpiresAt` is ISO-8601; exact subject: `{ role, userId, clientId, projectId }`. Browser-supplied scope, subject, expiry or any extra key is rejected; Sport stores the validated scalar as a one-element local scope array.
- Exact support-ready discovery extends the legacy shape to `{ protocol, protocols, siteKey, audience, capabilities, scopes, releaseId }`, with stable array ordering. WF fetches the configured same-origin `discoveryUrl` with redirect disabled, a 2.5-second timeout, `cache: 'no-store'`, JSON content type and an 8 KiB limit; malformed, stale or failed discovery disables support launch.

- [ ] **Step 1: Write failing migration/contract and real PostgreSQL tests** proving v1 rows/functions remain valid, v2 requires an allowed scope and exact wire keys, support tickets require `support_session_id` plus `session_expires_at <=` the support-session expiry, and consumed tickets return the same immutable scope/session expiry. The support-specific RPC derives administrator/client/expiry from the active session, validates project and active Blogger capability, inserts ticket plus `external_tool_launch` event in one transaction, and is executable only by `service_role`. Cover success, expired/ended session and wrong-project denial; in the isolated test database install a temporary event-insert trigger that raises, call the RPC, remove the trigger in `finally`, and prove neither ticket nor event committed.

- [ ] **Step 2: Write failing launch/discovery tests** proving support mode selects v2/read-only, binds the exact support session/client/project, refuses destinations advertising only v1 or a stale/invalid release, rejects redirects/oversize/slow/wrong-origin discovery, and fails when the feature flag is disabled even for an already-created support session. Inject RPC/audit validation failure and prove there is no redirect, no returned code and no consumable ticket. Assert no token, hash, code, administrator/client ID, upstream diagnostic or secret enters URLs, logs or error bodies.

- [ ] **Step 3: Run `node --test tests/support-blogger-handoff.test.mjs tests/blogger-tool-launch.test.mjs tests/site-registry.test.mjs`** and confirm failures.

- [ ] **Step 4: Add the additive migration and dual-protocol ticket helpers** without loosening v1 exact-key validation.

- [ ] **Step 5: Implement support launch routing and exchange**; normal admin/client launches keep existing v1 behavior. One `create_support_tool_launch_ticket` call inserts the v2 ticket and audit event atomically, deriving session/client ownership and recording exact project, Blogger capability and fixed `support_readonly` scope without storing the plaintext code or destination secret; any RPC failure returns a safe WF Studio error before constructing a redirect.

- [ ] **Step 6: Split local Blogger authorization into read and write guards** and apply the write guard to every listed central and legacy POST/PUT/DELETE/upload/build route before body parsing, storage, filesystem or build hooks. In support mode local list/config/preview reads may remain inspectable, but all mutations return the same typed 403 with zero side effects; an admin request without support mode retains its existing write authorization.

- [ ] **Step 7: Render Blogger as inspectable but unavailable** when fresh verified discovery lacks v2/read-only, with no fallback to an editable launch.

- [ ] **Step 8: Run task tests, the complete local/legacy Blogger route matrix, `npm run test:db`, `npm run typecheck`, and `npm run build`** and confirm pass, including transactional rollback of ticket plus audit event.

- [ ] **Step 9: Commit** with `git commit -m "feat: issue read-only Blogger support tickets"`.

### Task 7: Sport Massage readiness, audit UI, and gated rollout

**Files:**
- Modify: `.env.example`
- Modify: `src/app/paneladmin/(protected)/clientes/[id]/page.tsx`
- Modify: `src/app/paneladmin/(protected)/proyectos/[id]/page.tsx`
- Modify: `src/lib/data/admin.ts`
- Modify: `src/lib/data/projects.ts`
- Create: `tests/support-preview-audit.test.mjs`
- Create: `tests/sportmassage-support-readiness.test.mjs`
- Modify: `README.md`

**Interfaces:**
- Consumes: Tasks 1–6 and Sport discovery `{ protocols, scopes }` from the companion plan.
- Produces: readiness result `{ ready: boolean; issues: string[] }` and current-admin support-session history on client detail.

- [ ] **Step 1: Write failing readiness tests** for missing Sofia/client assignment, inactive client, disabled access, missing analytics, missing Blogger v2 scope, and the fully ready Sport project.

- [ ] **Step 2: Write audit UI tests** for current-admin sessions and append-only external-tool events only, start/end timestamps, end reasons, project/capability labels, fixed read-only scope, cross-admin/cross-client/cross-project forgery rejection, and no token/hash rendering.

- [ ] **Step 3: Implement readiness and audit presentation** without inventing client credentials or silently provisioning production data.

- [ ] **Step 4: Add `WF_SUPPORT_PREVIEW_ENABLED=false` to `.env.example`** and document enabling only after the production acceptance checklist passes.

- [ ] **Step 5: Run the new tests plus `tests/project-reconciliation.test.mjs`** and confirm pass.

- [ ] **Step 6: Run full verification:** `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, and `git diff --check`.

- [ ] **Step 7: Commit** with `git commit -m "feat: gate support preview rollout"`.

### Task 8: Cross-repository acceptance and pull request

**Files:**
- Create: `docs/releases/2026-10-23-client-support-preview-acceptance.md`

**Interfaces:**
- Consumes: deployed WF Studio branch and deployed Sport Massage companion branch with the same v2 contract.
- Produces: the non-secret release evidence document with both repository commit IDs, Sport release ID, timestamps and acceptance results for enabling `WF_SUPPORT_PREVIEW_ENABLED`.

- [ ] **Step 1: Verify production prerequisites read-only**: active Sofia client record, Sport assignment, client access, analytics capability, Blogger capability, and Sport v2 discovery.

- [ ] **Step 2: Deploy an isolated preview/staging revision with `WF_SUPPORT_PREVIEW_ENABLED=true`** and the production-equivalent schema/configuration; do not enable the production flag yet.

- [ ] **Step 3: Run the eight-step end-to-end acceptance from the spec against that gated revision** without using Sofia's password and record only non-secret results.

- [ ] **Step 4: Confirm database invariants**: no message read-state changes, no content mutations, one ended support session, and one scoped external-launch audit event.

- [ ] **Step 5: Request whole-branch review, resolve findings, rerun full verification, push the branch, and open a PR against the Blogger 2.0 dependency branch or `main` after that dependency merges.**

- [ ] **Step 6: After both PRs and migrations are deployed, enable the production feature flag**, repeat start/navigation/Blogger/exit once through the production UI, and immediately disable the flag if any mutation or isolation invariant fails.
