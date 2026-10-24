# WF Studio Consolidation and Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task by task. Use superpowers:test-driven-development for every behavior change and superpowers:verification-before-completion before claiming completion.

**Goal:** Ship the consolidated WF Studio client/admin panel as a secure, accessible and maintainable foundation, including audited client support preview, project analytics, configurable Blogger access, payments and reusable invoicing.

**Architecture:** Keep one Next.js application and one Supabase data plane, with explicit admin/client boundaries, capability-driven project navigation and site-specific tools launched through short-lived tickets. Put integrity-critical operations in PostgreSQL transactions/RPCs, keep client support sessions read-only and audited, and derive project/site behavior from one typed registry.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Supabase/PostgreSQL/RLS, Umami, Resend, Node test runner, ESLint.

**Spec:** `docs/superpowers/specs/2026-10-24-wf-studio-consolidation-hardening-design.md`, `docs/superpowers/specs/2026-10-24-client-payments-and-invoicing-design.md`, and `docs/superpowers/specs/2026-10-23-client-support-preview-design.md`.

## Global Constraints

- Start from `origin/codex/wf-studio-consolidation`; it already contains the Blogger 2.0 work, the audited support-preview implementation, the Agama naming fix, and the approved design documents.
- Merge PR #21 before merging the consolidation branch into `main`; close PRs #7 and #10 as superseded after confirming no unique required behavior remains.
- Never commit `.env*`, service-role keys, Umami credentials, Stripe secrets, client passwords, generated uploads or `node_modules`.
- Preserve all existing client routes and data. Add capabilities without replacing the current panel or silently activating Blogger for a site.
- Every server mutation must authorize from server-owned identity and project membership. Support preview must remain read-only even when a new action is added later.
- Use database migrations for schema/RLS changes, with rollback notes and concurrency tests for integrity-sensitive operations.
- Run the focused failing test first, then the full verification gate before each mergeable phase.

## Review Focus

1. Malicious Blogger HTML remains inert in storage, preview and published output.
2. A missing or invalid cron secret denies the request before database reads or email delivery.
3. Concurrent invoice/payment issuance produces one immutable invoice number and one valid payment association.
4. Support mode can inspect the client experience but cannot execute any mutation or access another client's resources.
5. The admin and client shells work at 320 px and by keyboard, with visible focus, correct tab semantics and useful loading/error states.

---

### Task 1: Establish the portable baseline and integration order

**Files:**
- Verify: `package.json`
- Verify: `package-lock.json`
- Verify: `.github/workflows/ci.yml`
- Verify: `docs/superpowers/specs/2026-10-24-wf-studio-consolidation-hardening-design.md`
- Verify: `docs/superpowers/specs/2026-10-24-client-payments-and-invoicing-design.md`

**Step 1: Recreate the checkout on the execution machine**

Run:

```bash
git fetch origin
git switch --track origin/codex/wf-studio-consolidation
npm ci
```

Expected: clean checkout and deterministic dependency installation without local files from the source machine.

**Step 2: Record the baseline**

Run:

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm audit --omit=dev
```

Expected: tests, lint, typecheck and build pass. Save the audit output in the PR description; the known production dependency findings are addressed in Task 2.

**Step 3: Confirm branch ancestry and open PR state**

Run:

```bash
git log --oneline --decorate --graph -20
gh pr view 21 --json state,mergeable,statusCheckRollup
gh pr view 7 --json state,files
gh pr view 10 --json state,files
```

Expected: this branch contains `origin/codex/blogger-2-cms`; PR #21 is the prerequisite; PRs #7 and #10 are not merged accidentally.

**Step 4: Commit only if baseline documentation changes were required**

```bash
git add docs package.json package-lock.json .github/workflows/ci.yml
git commit -m "docs: record WF Studio consolidation baseline"
```

### Task 2: Remove production dependency vulnerabilities

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Add: `tests/dependency-security.test.mjs`

**Step 1: Write a failing dependency floor test**

Add assertions that production resolution uses Next.js `>=15.5.28`, Sharp `>=0.35.5`, a patched `source-map-js`, and patched Zod. The test must inspect the lockfile, not only manifest ranges.

Run: `node --test tests/dependency-security.test.mjs`

Expected: FAIL against the current vulnerable lockfile.

**Step 2: Upgrade narrowly**

Update Next.js and its matching ESLint config, remove the vulnerable Sharp override or raise it to the patched release, update transitive source-map dependencies, and migrate Zod only as far as required by the advisory. Do not bundle unrelated package upgrades.

Run:

```bash
npm install
npm audit --omit=dev
node --test tests/dependency-security.test.mjs
```

Expected: no critical/high production advisory and the floor test passes.

**Step 3: Verify framework compatibility**

Run: `npm test && npm run lint && npm run typecheck && npm run build`

Expected: PASS.

**Step 4: Commit**

```bash
git add package.json package-lock.json tests/dependency-security.test.mjs
git commit -m "fix: patch production dependency vulnerabilities"
```

### Task 3: Make Blogger content safe from storage to publication

**Files:**
- Add: `src/lib/blogger/sanitize.ts`
- Modify: `src/lib/blogger/content-store.mjs`
- Modify: `src/lib/blogger/publisher.mjs`
- Modify: `src/components/admin/blogger-editor.tsx`
- Modify: `public/blogger/editor/app.js`
- Modify: `public/blogger/app.js`
- Modify: `next.config.ts`
- Add: `tests/blogger-sanitization.test.mjs`
- Add: `tests/blogger-preview-security.test.mjs`

**Step 1: Write malicious-payload tests**

Cover script tags, event handlers, `javascript:` URLs, hostile SVG, iframe injection and malformed nested HTML. Assert the payload is inert both after persistence and in the generated page.

Run: `node --test tests/blogger-sanitization.test.mjs tests/blogger-preview-security.test.mjs`

Expected: FAIL because raw HTML currently reaches storage/publication and preview sinks.

**Step 2: Implement one server-side allowlist sanitizer**

Sanitize before storage and sanitize again at publication as defense in depth. Allow only the formatting required by Blogger 2.0 (headings, paragraphs, safe links, lists, emphasis, images with approved URL schemes). Preserve readable text when removing unsafe markup.

**Step 3: Isolate previews and remove unsafe DOM insertion**

Render previews in a sandboxed document/iframe with the minimum permissions. Replace direct `innerHTML` assignments that consume untrusted content, or ensure they receive only the sanitizer's branded safe output.

**Step 4: Add response security headers**

Configure a restrictive CSP and complementary headers. Account explicitly for Supabase, Umami and image origins actually used by the panel; do not use a broad wildcard to make tests pass.

Run: `node --test tests/blogger-sanitization.test.mjs tests/blogger-preview-security.test.mjs && npm run typecheck && npm run build`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/blogger src/components/admin/blogger-editor.tsx public/blogger next.config.ts tests
git commit -m "fix: sanitize and isolate Blogger content"
```

### Task 4: Harden cron and authentication boundaries

**Files:**
- Modify: `src/app/api/pending-reminders/route.ts`
- Modify: `src/lib/cron/pending-reminders.mjs`
- Modify: `src/lib/actions/auth.ts`
- Modify: `src/components/auth/reset-password-form.tsx`
- Modify: `src/lib/security/redirects.mjs`
- Modify: `src/app/auth/callback/route.ts`
- Modify: `src/app/auth/callback/reset/route.ts`
- Modify: `src/app/auth/sign-out/route.ts`
- Modify: `src/app/api/auth-diagnostics/route.ts`
- Add: `tests/cron-authorization.test.mjs`
- Add: `tests/auth-boundaries.test.mjs`

**Step 1: Write fail-closed tests**

Assert that an unset cron secret denies access, query-string credentials are rejected, GET cannot mutate, comparison is timing-safe, forwarded hosts are allowlisted, reset redirects use a canonical server-owned origin, sign-out is same-origin, and diagnostics are unavailable outside authorized admin diagnostics mode.

Run: `node --test tests/cron-authorization.test.mjs tests/auth-boundaries.test.mjs`

Expected: FAIL.

**Step 2: Implement cron authorization before side effects**

Accept only POST with `Authorization: Bearer ...`. Validate configuration at startup/request entry, compare without data-dependent timing, and return before creating a service-role client when authorization fails.

**Step 3: Canonicalize authentication origins and responses**

Derive recovery/callback URLs from trusted configuration, not hidden form fields or arbitrary forwarded hosts. Return uniform user-facing responses for login, magic-link and recovery requests to reduce account enumeration.

**Step 4: Protect diagnostics and logout**

Require admin authorization plus an explicit diagnostics flag. Reject cross-origin logout requests and keep redirects on an allowlist.

Run: `node --test tests/cron-authorization.test.mjs tests/auth-boundaries.test.mjs && npm test && npm run typecheck`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/app/api/pending-reminders src/lib/cron src/lib/actions/auth.ts src/components/auth/reset-password-form.tsx src/lib/security src/app/auth src/app/api/auth-diagnostics tests
git commit -m "fix: harden cron and authentication boundaries"
```

### Task 5: Restrict messaging and client resources with RLS

**Files:**
- Add: `supabase/migrations/202610240001_message_and_resource_rls.sql`
- Modify: `src/lib/actions/messages.ts`
- Modify: `src/lib/actions/client-resources.ts`
- Modify: `src/lib/actions/resources.ts`
- Modify: `src/lib/supabase/types.ts`
- Add: `tests/messaging-rls.test.mjs`
- Extend: `tests/client-resources.test.mjs`

**Step 1: Add failing cross-client tests**

Cover message insert/update, resource metadata reads and storage downloads. A client must not alter admin-authored records, spoof sender/project ownership or read another client's object even with a guessed ID/path.

Run: `node --test tests/messaging-rls.test.mjs tests/client-resources.test.mjs`

Expected: FAIL for the currently broad policies.

**Step 2: Create restrictive policies and narrow RPCs**

Replace broad table policies with project-membership checks and immutable ownership columns. Expose only the read/update operations needed by the UI. Keep admin operations explicit rather than relying on client-supplied role flags.

**Step 3: Update actions and generated types**

Make each action use the narrow operation and return a generic authorization failure. Ensure resource downloads revalidate both database ownership and storage path ownership.

Run: `npm run test:db && node --test tests/messaging-rls.test.mjs tests/client-resources.test.mjs tests/support-readonly-actions.test.mjs`

Expected: PASS and support preview remains unable to mutate.

**Step 4: Commit**

```bash
git add supabase/migrations src/lib/actions src/lib/supabase/types.ts tests
git commit -m "fix: constrain client messaging and resource access"
```

### Task 6: Add atomic payments and reusable invoices

**Files:**
- Add: `supabase/migrations/202610240002_payments_and_invoices.sql`
- Modify: `src/lib/supabase/types.ts`
- Add: `src/lib/payments/schema.ts`
- Add: `src/lib/data/payments.ts`
- Modify: `src/lib/data/invoices.ts`
- Add: `src/lib/actions/payments.ts`
- Modify: `src/lib/actions/invoices.ts`
- Add: `tests/payments-and-invoices.test.mjs`
- Add: `tests/payments-and-invoices-postgres.test.mjs`

**Step 1: Write domain and concurrency tests**

Test registered and external recipients, immutable recipient snapshots, HTTPS Stripe payment-link validation, draft/issued/paid/void transitions, append-only audit entries, forbidden physical deletion, and concurrent invoice issue/link requests.

Run: `node --test tests/payments-and-invoices.test.mjs tests/payments-and-invoices-postgres.test.mjs`

Expected: FAIL because the model/RPCs do not exist.

**Step 2: Add the schema and integrity constraints**

Create payment requests, payment links and invoice audit records. Add unique constraints and an atomic invoice-number sequence. Use a transaction/RPC to issue an invoice and associate a payment link so partial state cannot escape.

**Step 3: Implement server-only actions**

Admin may create invoices for panel clients or external recipients and manually attach Stripe links. Clients may only read their own issued documents and payment requests. Never accept a final amount, recipient identity or project membership solely from the browser.

**Step 4: Verify database behavior**

Run: `npm run test:db && node --test tests/payments-and-invoices.test.mjs tests/payments-and-invoices-postgres.test.mjs`

Expected: PASS, including concurrent issuance.

**Step 5: Commit**

```bash
git add supabase/migrations src/lib/payments src/lib/data src/lib/actions src/lib/supabase/types.ts tests
git commit -m "feat: add atomic payments and reusable invoices"
```

### Task 7: Deliver admin and client payment interfaces

**Files:**
- Add: `src/app/paneladmin/(protected)/pagos/page.tsx`
- Modify: `src/app/paneladmin/(protected)/facturas/page.tsx`
- Modify: `src/app/paneladmin/(protected)/facturas/[id]/print/page.tsx`
- Add: `src/components/admin/payment-form.tsx`
- Modify: `src/components/admin/invoice-form.tsx`
- Add: `src/app/cliente/(protected)/pagos/page.tsx`
- Modify: `src/app/cliente/(protected)/facturas/page.tsx`
- Modify: `src/components/layout/app-shell.tsx`
- Modify: `src/components/layout/client-shell.tsx`
- Modify: `src/lib/i18n.ts`
- Add: `tests/payment-ui.test.mjs`

**Step 1: Write failing route and authorization tests**

Test admin creation for registered/external recipients, client visibility restricted to their own project, pending/paid/void states, protected invoice print output, and navigation in both locales.

Run: `node --test tests/payment-ui.test.mjs`

Expected: FAIL.

**Step 2: Build the admin workflow**

Add payment management and integrate invoice generation without requiring a registered client. Validate Stripe links server-side and present clear state transitions instead of destructive delete controls.

**Step 3: Build the client workflow**

Show pending payments with a direct external payment button and issued invoices as protected printable documents. Keep all payment status labels explicit and translated.

**Step 4: Verify**

Run: `node --test tests/payment-ui.test.mjs && npm run lint && npm run typecheck && npm run build`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/app/paneladmin src/app/cliente src/components src/lib/i18n.ts tests/payment-ui.test.mjs
git commit -m "feat: add payment and invoice experiences"
```

### Task 8: Complete the panel UX and accessibility foundation

**Files:**
- Modify: `src/app/paneladmin/(protected)/samuel-coach/premium/page.tsx`
- Modify: `src/components/layout/app-shell.tsx`
- Modify: `src/components/layout/client-shell.tsx`
- Modify: `src/components/ui/form-message.tsx`
- Modify: `src/components/client/request-form.tsx`
- Modify: `src/components/client/message-composer.tsx`
- Modify: `src/components/admin/*-form.tsx`
- Add: `src/app/paneladmin/(protected)/loading.tsx`
- Add: `src/app/paneladmin/(protected)/error.tsx`
- Add: `src/app/cliente/(protected)/loading.tsx`
- Add: `src/app/cliente/(protected)/error.tsx`
- Add: `src/app/not-found.tsx`
- Modify: `src/lib/i18n.ts`
- Add: `tests/accessibility-shell.test.mjs`
- Add: `tests/responsive-navigation.test.mjs`

**Step 1: Write semantic and responsive tests**

Assert associated labels, `aria-live` feedback, skip links, `aria-current`, keyboard tab behavior, accessible confirmation dialogs, compact mobile navigation at 320 px, and translated client strings.

Run: `node --test tests/accessibility-shell.test.mjs tests/responsive-navigation.test.mjs`

Expected: FAIL.

**Step 2: Unify shells and navigation**

Make the Samuel Coach premium route use the standard admin shell. Add a keyboard-safe compact navigation pattern without hiding routes. Preserve favorites on Inicio and project-specific capabilities.

**Step 3: Fix forms, tabs and destructive actions**

Connect every visible label to its control, announce success/error messages, implement arrow-key tab navigation with tabpanels, and use an accessible confirmation flow before destructive operations.

**Step 4: Add route boundaries and complete i18n**

Provide useful loading, error and not-found states. Remove mixed-language client UI. Keep TodoPlastico to one page-level H1.

Run: `node --test tests/accessibility-shell.test.mjs tests/responsive-navigation.test.mjs && npm test && npm run lint && npm run typecheck && npm run build`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/app src/components src/lib/i18n.ts tests
git commit -m "feat: complete accessible responsive panel shell"
```

### Task 9: Consolidate site identity and analytics configuration

**Files:**
- Add: `src/lib/sites/manifest.ts`
- Modify: `src/lib/sites/registry.mjs`
- Modify: `src/lib/blogger/sites.mjs`
- Modify: `src/lib/projects/model.mjs`
- Modify: `src/lib/projects/provisioning.mjs`
- Modify: `src/lib/data/projects.ts`
- Modify: `src/lib/data/umami.ts`
- Modify: `src/lib/data/umami-core.mjs`
- Modify: `src/lib/analytics/umami-core.mjs`
- Add: `tests/site-manifest.test.mjs`
- Extend: `tests/project-analytics-resolution.test.mjs`

**Step 1: Write drift tests**

Assert one canonical key/domain/name mapping for Agama, TodoPlastico, Sport Massage and all registered sites. Assert analytics and Blogger capability resolution derive from that source and cannot silently disagree.

Run: `node --test tests/site-manifest.test.mjs tests/project-analytics-resolution.test.mjs`

Expected: FAIL because several registries and Umami cores compete.

**Step 2: Introduce a typed manifest**

Create the canonical typed source and compatibility adapters for legacy callers. Do not perform a flag-day rewrite. Ensure Blogger remains opt-in and analytics capability is explicit per project.

**Step 3: Unify Umami resolution**

Keep one implementation for site/website ID lookup, range validation and normalized analytics output. Preserve Agama's own VPS/account configuration and per-client access rules.

Run: `node --test tests/site-manifest.test.mjs tests/project-analytics-resolution.test.mjs tests/client-analytics-access.test.mjs && npm run typecheck`

Expected: PASS.

**Step 4: Commit**

```bash
git add src/lib/sites src/lib/blogger/sites.mjs src/lib/projects src/lib/data src/lib/analytics tests
git commit -m "refactor: unify site and analytics configuration"
```

### Task 10: Split oversized server modules without changing behavior

**Files:**
- Modify: `src/lib/actions/admin.ts`
- Add: `src/lib/actions/admin/clients.ts`
- Add: `src/lib/actions/admin/projects.ts`
- Add: `src/lib/actions/admin/services.ts`
- Add: `src/lib/actions/admin/packs.ts`
- Add: `src/lib/actions/admin/pending.ts`
- Modify: `src/lib/blogger/content-store.mjs`
- Add: `src/lib/blogger/content/repository.ts`
- Add: `src/lib/blogger/content/validation.ts`
- Add: `src/lib/blogger/content/images.ts`
- Add: `tests/admin-actions-contract.test.mjs`
- Add: `tests/blogger-content-contract.test.mjs`

**Step 1: Freeze behavior with contract tests**

Capture action exports, authorization checks, revalidation targets and Blogger content outcomes before moving code.

Run: `node --test tests/admin-actions-contract.test.mjs tests/blogger-content-contract.test.mjs`

Expected: PASS against current behavior.

**Step 2: Extract by domain in small commits**

Keep `admin.ts` as a temporary compatibility barrel while callers migrate. Separate Blogger repository, validation and image concerns. Do not mix schema changes into this refactor.

**Step 3: Replace active `.mjs` plus declaration pairs gradually**

Migrate only touched modules to TypeScript, delete their matching handwritten declarations, and use generated Supabase types. Leave untouched pairs for a later bounded PR rather than creating a risky mass conversion.

Run: `npm test && npm run lint && npm run typecheck && npm run build`

Expected: PASS with unchanged public behavior.

**Step 4: Commit**

```bash
git add src/lib/actions src/lib/blogger tests
git commit -m "refactor: split panel server domains"
```

### Task 11: Remove duplication and bound data reads

**Files:**
- Add: `src/components/projects/project-detail.tsx`
- Modify: `src/app/paneladmin/(protected)/proyectos/[id]/page.tsx`
- Modify: `src/app/cliente/(protected)/proyectos/[slug]/page.tsx`
- Modify: `src/app/paneladmin/(protected)/conoce-fuengirola/suscripciones/page.tsx`
- Modify: `src/app/paneladmin/(protected)/vivir-en-fuengirola/suscripciones/page.tsx`
- Modify: `src/lib/data/admin.ts`
- Modify: `src/lib/data/client.ts`
- Modify: `src/lib/data/projects.ts`
- Add: `tests/pagination.test.mjs`
- Add: `tests/project-detail-contract.test.mjs`

**Step 1: Add contract and pagination tests**

Assert equivalent project capabilities in admin/client presentations while preserving their authorization differences. Assert list queries use explicit limits/cursors and stable ordering instead of loading whole tables for in-memory filtering.

Run: `node --test tests/pagination.test.mjs tests/project-detail-contract.test.mjs`

Expected: FAIL for unbounded reads and duplicated divergent rendering.

**Step 2: Extract shared presentation and bounded repositories**

Share display components and view models, never server authorization shortcuts. Add database-side filters and cursor/offset pagination with predictable empty states.

**Step 3: Remove obsolete flags and dead paths**

After proving all callers use capability resolution, remove redundant `portal_mode` branches and orphaned components. Keep a migration/default for existing rows until production data is reconciled.

Run: `node --test tests/pagination.test.mjs tests/project-detail-contract.test.mjs && npm test && npm run typecheck`

Expected: PASS.

**Step 4: Commit**

```bash
git add src/components/projects src/app/paneladmin src/app/cliente src/lib/data tests
git commit -m "refactor: deduplicate projects and bound panel queries"
```

### Task 12: Run release verification and integrate safely

**Files:**
- Modify if needed: `.github/workflows/ci.yml`
- Add: `docs/releases/2026-10-wf-studio-consolidation.md`

**Step 1: Run the complete local gate**

```bash
npm ci
npm test
npm run test:db
npm run lint
npm run typecheck
npm run build
npm audit --omit=dev
```

Expected: all checks pass and no critical/high production vulnerabilities remain. If local PostgreSQL is unavailable, CI must run `test:db` before merge and the limitation must be stated explicitly.

**Step 2: Perform manual end-to-end checks**

Test these roles and devices:

- Admin: projects, Agama naming, TodoPlastico, statistics ranges, Blogger launch, payment creation, external invoice, support preview and audit exit.
- Angel Palma client: Webs selector, Agama and TodoPlastico statistics/Blogger, reports, bonuses, invoices and payments.
- Sport Massage client: direct Blogger credential flow, remembered session, mobile post creation/edit and client-panel analytics.
- Support preview: navigate all client read pages and prove every mutation is blocked.
- Mobile/keyboard: 320 px shell, focus order, menus, tabs, forms, loading/error/not-found.

**Step 3: Review security headers and database policies in the deployed preview**

Confirm CSP violations are understood, no secrets appear in browser bundles/logs, RLS denies cross-client reads/writes, cron rejects unauthorized calls, and invoice/payment audit entries are append-only.

**Step 4: Document deployment and rollback**

Record migration order, required environment variable names (never values), deployment order, smoke-test URLs and rollback procedures in `docs/releases/2026-10-wf-studio-consolidation.md`.

**Step 5: Request independent review**

Use `superpowers:requesting-code-review`. Require explicit review of the five items in **Review Focus** and resolve every P0/P1 before merge.

**Step 6: Merge in order**

1. Merge PR #21 into `main` after CI is green.
2. Rebase/merge `main` into `codex/wf-studio-consolidation` and rerun the full gate.
3. Close PRs #7 and #10 as superseded, linking the replacement commits.
4. Merge the consolidation PR only after database migrations and preview checks pass.

**Step 7: Commit release evidence**

```bash
git add .github/workflows/ci.yml docs/releases/2026-10-wf-studio-consolidation.md
git commit -m "docs: record WF Studio release verification"
```

## Completion Criteria

- `main` contains Blogger 2.0, audited read-only support preview, Agama/TodoPlastico/Sport Massage project capabilities, complete analytics access, payments and flexible invoices.
- All production dependencies are free of known critical/high advisories at merge time.
- Security, RLS, concurrency, UI, accessibility and responsive regression tests pass in CI.
- No environment values, passwords, generated uploads or machine-specific paths are committed.
- Deployment/rollback documentation lets a second machine or engineer reproduce the release from Git alone.
