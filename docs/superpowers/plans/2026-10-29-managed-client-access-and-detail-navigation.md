# Managed Client Access and Detail Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make client access fully administrator-managed, expose one-time generated passwords and in-panel password-change notices, enable safe support preview, and replace the flat client record with focused contextual navigation.

**Architecture:** Authentication credentials stay exclusively in Supabase Auth. A focused managed-access helper coordinates account creation/reset while returning the generated password only in the immediate Server Action state; a small append-only access-event table records password changes without credential material. The client record uses a validated `view` query parameter and a contextual navigator so one section is visually primary at a time.

**Tech Stack:** Next.js 15 Server Actions and Server Components, React 19 `useActionState`, Supabase Auth/Postgres/RLS, TypeScript, Node test runner, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-10-29-managed-client-access-and-detail-navigation-design.md`

## Global Constraints

- No public visitor can create an Auth user or `clients` row.
- Never persist, log, email, place in a URL, or re-render after reload any generated password.
- Password creation and replacement require `requireAdmin()` and a fresh server-side client lookup in project `wf-studio`.
- Client password changes create an in-panel event without password material and do not email the administrator.
- Support preview remains a separate 30-minute, audited, read-only token flow.
- Existing client, invoice, expense, domain, service, message, and support data must remain intact.
- Every production behavior change follows red-green-refactor and the full suite is reported without omissions.

## Review Focus

- An email belonging to an administrator or malformed profile must never be reset through a client record; Task 2 tests this rejection.
- A duplicate Auth account with no usable client profile must fail safely without creating a second identity; Task 2 tests the duplicate path.
- A direct POST to the retired registration action must not create Auth or client data; Task 3 tests the server boundary.
- A failed password update must not create a “changed” notification; Task 4 tests ordering and failure behavior.
- An unknown or repeated `view` query must fall back to the summary without hiding the record; Task 5 tests normalization and active-section toggling.

---

### Task 1: Password-change event contract

**Files:**
- Create: `supabase/migrations/202610290001_client_access_events.sql`
- Modify: `src/lib/database.types.ts`
- Create: `tests/client-access-events-migration.test.mjs`

**Interfaces:**
- Produces: table `public.client_access_events(id, client_id, auth_user_id, event_type, created_at)` where `event_type` is `password_changed_by_client`.
- Produces: authenticated-client insert policy constrained to the current Auth user and its active `wf-studio` client; administrator select policy; no update/delete policy.

- [ ] **Step 1: Write the failing migration contract test**

Add `client-access-events-migration.test.mjs` assertions for the exact columns, single allowed event type, foreign keys, append-only grants, admin select policy, client-own insert policy, and absence of password/secret/token columns.

- [ ] **Step 2: Run the migration test and verify RED**

Run: `node --test tests/client-access-events-migration.test.mjs`
Expected: FAIL because the migration does not exist.

- [ ] **Step 3: Add the additive migration and generated database type**

Create the table, indexes and RLS policies. Grant only `select, insert` to authenticated users as constrained by policies; explicitly revoke update/delete from authenticated, anon and public. Add the corresponding `Row`, `Insert`, `Update` and relationship types.

- [ ] **Step 4: Run the migration test and verify GREEN**

Run: `node --test tests/client-access-events-migration.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/202610290001_client_access_events.sql src/lib/database.types.ts tests/client-access-events-migration.test.mjs
git commit -m "feat: add client access security events"
```

### Task 2: Administrator-managed credentials

**Files:**
- Create: `src/lib/clients/managed-access.mjs`
- Create: `src/lib/clients/managed-access-module.d.ts`
- Modify: `src/lib/actions/admin.ts`
- Modify: `src/lib/actions/admin/clients.ts`
- Create: `tests/client-managed-access.test.mjs`

**Interfaces:**
- Produces: `generateTemporaryPassword(randomBytes?: (size: number) => Buffer): string` with at least 96 bits of entropy and human-copyable output.
- Produces: `resolveManagedAccess({ client, profile }): { status: 'missing' | 'ready' | 'blocked'; authUserId?: string; reason?: string }`.
- Produces: `provisionOrResetClientAccessAction(previous: ManagedAccessState, formData: FormData): Promise<ManagedAccessState>` where success contains `generatedPassword` only in the immediate result.

- [ ] **Step 1: Write failing helper and action tests**

Cover literal outcomes for: password format/entropy source, missing profile creates a confirmed client Auth account, existing client profile updates that exact user, admin-role profile is blocked, inactive/wrong-project/changed-email client is blocked, duplicate Auth failure is safe, and successful operation returns the password without passing it to logs or database writes.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/client-managed-access.test.mjs`
Expected: FAIL because the managed-access helper/action is missing.

- [ ] **Step 3: Implement the pure managed-access helper**

Use `node:crypto.randomBytes` and an unambiguous alphabet. Keep account-state decisions pure so tests exercise real branching without mocking Supabase internals.

- [ ] **Step 4: Run helper tests and verify GREEN for the pure contract**

Run: `node --test tests/client-managed-access.test.mjs --test-name-pattern="password|resolve"`
Expected: PASS.

- [ ] **Step 5: Implement `provisionOrResetClientAccessAction`**

Require admin, validate UUID, reload `clients(id,email,status,project)`, resolve `profiles(id,email,role)` by normalized email, then create or update through `getSupabaseAdminClient().auth.admin`. Revalidate only the client detail after success.

- [ ] **Step 6: Run the complete focused test and verify GREEN**

Run: `node --test tests/client-managed-access.test.mjs`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/clients/managed-access.mjs src/lib/clients/managed-access-module.d.ts src/lib/actions/admin.ts src/lib/actions/admin/clients.ts tests/client-managed-access.test.mjs
git commit -m "feat: manage client passwords from admin"
```

### Task 3: Mandatory admin-created access and closed public registration

**Files:**
- Modify: `src/components/admin/client-form.tsx`
- Modify: `src/lib/actions/admin.ts`
- Modify: `src/lib/clients/direct-create.mjs`
- Modify: `src/lib/clients/direct-create-module.d.ts`
- Modify: `src/app/cliente/registro/page.tsx`
- Modify: `src/app/cliente/page.tsx`
- Modify: `src/lib/actions/auth.ts`
- Modify: `tests/client-direct-create.test.mjs`
- Create: `tests/client-registration-closed.test.mjs`

**Interfaces:**
- Produces: the new-client action generates the initial password in server code and returns it once alongside a successful creation result; the browser never generates or submits credential material for a new account.
- Produces: `clientRegisterAction` always returns the closed-registration message without calling Auth or the database.
- Consumes: Task 2 `generateTemporaryPassword()` and the same one-time result presentation used by the access manager.

- [ ] **Step 1: Extend direct-create tests and add closed-registration tests**

Assert that the admin create flow generates its password through the injected entropy source, preserves company/phone/status while creating Auth and client atomically, returns that generated password once, and still cleans Auth up on client insert failure. Assert `/cliente/registro` redirects to `/cliente` with `error=invite_required`, the login has no registration link, and direct `clientRegisterAction` performs zero dependency calls.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `node --test tests/client-direct-create.test.mjs tests/client-registration-closed.test.mjs`
Expected: FAIL on the missing fields and still-open registration.

- [ ] **Step 3: Make the admin new-client form a single mandatory-access flow**

For `editingClient === null`, submit name/company/email/phone/status/project through `createClientDirectAction`, generate the password inside the server action, and show the successful action state with a one-time read-only value, `Copiar` control and reload warning. Remove the second expandable “Acceso directo” form. Editing keeps `upsertClientAction` and does not expose a password field.

- [ ] **Step 4: Close both public registration boundaries**

Redirect the page, remove the login link, and make `clientRegisterAction` return `El acceso se crea desde WF Studio. Contacta con el equipo.` before constructing Supabase clients.

- [ ] **Step 5: Run the focused tests and verify GREEN**

Run: `node --test tests/client-direct-create.test.mjs tests/client-registration-closed.test.mjs`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/client-form.tsx src/lib/actions/admin.ts src/lib/clients/direct-create.mjs src/lib/clients/direct-create-module.d.ts src/app/cliente/registro/page.tsx src/app/cliente/page.tsx src/lib/actions/auth.ts tests/client-direct-create.test.mjs tests/client-registration-closed.test.mjs
git commit -m "feat: require admin-managed client access"
```

### Task 4: Client password-change notification

**Files:**
- Modify: `src/lib/actions/auth.ts`
- Modify: `src/lib/data/admin.ts`
- Modify: `src/app/paneladmin/(protected)/inicio/page.tsx`
- Create: `src/components/admin/client-access-notifications.tsx`
- Create: `tests/client-password-change-notification.test.mjs`

**Interfaces:**
- Produces: `getRecentClientAccessEvents(limit?: number)` returning client name, client ID, event type and timestamp, never credential material.
- Produces: an in-panel security notice list on `/paneladmin/inicio` linking each client change to `/paneladmin/clientes/:id?view=access`.
- Consumes: Task 1 `client_access_events`.

- [ ] **Step 1: Write failing password-change and notification rendering tests**

Assert `updatePasswordAction` inserts `password_changed_by_client` only after `auth.updateUser` succeeds and resolves the active `wf-studio` client by authenticated email. Assert failure writes no event. Render the admin start page and assert a Spanish “Contraseña cambiada por el cliente” notice, client link and date, with no password-like field.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/client-password-change-notification.test.mjs`
Expected: FAIL because no event or panel notice exists.

- [ ] **Step 3: Record successful self-service password changes**

After `updateUser({ password })` succeeds, resolve the authenticated client and insert the event through the authenticated Supabase client. If event insertion fails, log only user/client IDs and return a success message that notes the password changed even though the panel notice could not be recorded.

- [ ] **Step 4: Add the recent security notices to the admin start page**

Load a bounded list (default 10) and render only client, event label and date. Do not add email delivery or unread-state complexity.

- [ ] **Step 5: Run the focused test and verify GREEN**

Run: `node --test tests/client-password-change-notification.test.mjs`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/actions/auth.ts src/lib/data/admin.ts src/app/paneladmin/\(protected\)/inicio/page.tsx src/components/admin/client-access-notifications.tsx tests/client-password-change-notification.test.mjs
git commit -m "feat: show client password change notices"
```

### Task 5: Focused client record and one-time access UI

**Files:**
- Create: `src/components/admin/client-detail-navigation.tsx`
- Create: `src/components/admin/client-access-manager.tsx`
- Modify: `src/app/paneladmin/(protected)/clientes/[id]/page.tsx`
- Modify: `src/lib/data/admin.ts`
- Modify: `tests/client-crm-navigation.test.mjs`
- Create: `tests/client-access-manager-ui.test.mjs`

**Interfaces:**
- Produces: `normalizeClientDetailView(value?: string): ClientDetailView` with allowed values `summary`, `profile`, `access`, `hours`, `domains`, `hosting`, `services`, `invoices`, `expenses`, `messages`, `history`.
- Produces: `ClientDetailNavigation({ clientId, activeView, counts })`; the active desktop link points back to `view=summary`, other links select their view, and mobile uses the same allowlisted destinations plus a visible `Volver al resumen` control for the active section.
- Produces: `ClientAccessManager({ clientId, clientName, accessStatus })` with create/reset confirmation, immediate one-time password, copy control and reload warning.
- Consumes: Task 2 `provisionOrResetClientAccessAction` and Task 4 access-event status.

- [ ] **Step 1: Extend CRM navigation tests and add access UI tests**

Assert unknown `view` normalizes to summary; each valid view renders only its primary section; the contextual navigation includes all labels/counts; active selection points to summary; profile and service summaries are not duplicated; access status chooses create versus reset copy; and a successful action state renders the generated password exactly once with a copy button and warning.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `node --test tests/client-crm-navigation.test.mjs tests/client-access-manager-ui.test.mjs`
Expected: FAIL because the contextual navigator and access manager do not exist.

- [ ] **Step 3: Add access status to the detail loader**

Look up the normalized client email in `profiles` and return only `{ status, authUserId? }`; never expose Auth metadata or password hashes.

- [ ] **Step 4: Implement contextual navigation and one-time access manager**

Use links/query state for server-rendered sections and a compact mobile selector with the same allowlisted destinations. The access manager uses `useActionState`; clear its local copy state when a new action begins and never put the password in cookies, local/session storage or URL state.

- [ ] **Step 5: Refactor the client detail page into focused sections**

Keep the header/breadcrumb and quick actions. Render summary cards only for `summary`; render exactly one operational section for every other view. Remove the current duplicate “Menú de servicios del cliente” and two-column all-at-once layout.

- [ ] **Step 6: Run the focused tests and verify GREEN**

Run: `node --test tests/client-crm-navigation.test.mjs tests/client-access-manager-ui.test.mjs`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/admin/client-detail-navigation.tsx src/components/admin/client-access-manager.tsx src/app/paneladmin/\(protected\)/clientes/\[id\]/page.tsx src/lib/data/admin.ts tests/client-crm-navigation.test.mjs tests/client-access-manager-ui.test.mjs
git commit -m "feat: focus the client record navigation"
```

### Task 6: Support activation and complete verification

**Files:**
- Modify: `.env.example`
- Modify: `docs/releases/2026-10-wf-studio-consolidation.md`
- Verify: `tests/support-preview-ui.test.mjs`
- Verify: `tests/support-portal-viewer.test.mjs`

**Interfaces:**
- Consumes: existing `WF_SUPPORT_PREVIEW_ENABLED=true`, support-session migration, cookie and read-only viewer contracts.
- Produces: a documented production activation checklist that proves schema, start, navigation, mutation blocking, expiry and exit before changing the hosted environment variable.

- [ ] **Step 1: Verify the existing activation contract before changing hosted configuration**

Inspect the existing UI/viewer assertions: an active client detail with the flag enabled renders an enabled `Ver como` control, inactive clients remain disabled, the action emits the secure 30-minute cookie, and no password credential is read or modified.

- [ ] **Step 2: Run support tests and record the pre-activation baseline**

Run: `node --test tests/support-preview-ui.test.mjs tests/support-portal-viewer.test.mjs`
Expected: PASS before any hosted flag is changed.

- [ ] **Step 3: Update environment and release documentation**

Keep `.env.example` explicit. Document applying `202610230001_admin_support_sessions.sql`, running the support tests, enabling the hosted `WF_SUPPORT_PREVIEW_ENABLED=true`, deploying, and performing start/exit smoke checks. Do not silently default production to enabled in application code.

- [ ] **Step 4: Run all focused authentication, CRM and support tests**

Run: `node --test tests/client-managed-access.test.mjs tests/client-direct-create.test.mjs tests/client-registration-closed.test.mjs tests/client-password-change-notification.test.mjs tests/client-crm-navigation.test.mjs tests/client-access-manager-ui.test.mjs tests/support-preview-ui.test.mjs tests/support-portal-viewer.test.mjs`
Expected: PASS.

- [ ] **Step 5: Run repository verification**

Run: `npm test`
Expected: all tests pass; report any named skip or pre-existing failure.

Run: `npm run lint`
Expected: exit 0.

Run: `npm run typecheck`
Expected: exit 0.

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 6: Apply and smoke-test production support configuration**

Verify the production support migration exists, set the hosted flag, deploy the verified revision, start support preview for an active client, confirm the read-only banner and mutation blocking, then exit back to the exact client record. If any check fails, keep the flag false and report the failing boundary.

- [ ] **Step 7: Commit the configuration documentation**

```bash
git add .env.example docs/releases/2026-10-wf-studio-consolidation.md
git commit -m "docs: prepare support preview activation"
```
