# Fichero Fuengirola Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan.

**Goal:** Convertir WF Panel en la fuente maestra de un único catálogo Fuengirola, con aprobación humana y publicación inmediata, segura e idempotente en Vivir en Fuengirola y Conoce Fuengirola.

**Architecture:** WF Panel conserva la ficha canónica, su revisión y el historial de publicaciones. Cada web mantiene su propia tabla de lectura y su presentación; dos adaptadores server-side transforman una versión canónica y hacen `upsert` en cada canal. La solicitud pública entra por la API endurecida de `platform_requests`; aprobar crea o enlaza una ficha en borrador, mientras que “Aprobar y publicar” valida, versiona e intenta publicar de forma síncrona en ambos canales, persistiendo los resultados para reintentos idempotentes.

**Tech Stack:** Next.js App Router, TypeScript, Supabase/PostgreSQL, Server Actions, Node test runner, `tsx --test`, Playwright, ESLint.

**Spec:** `docs/superpowers/specs/2026-10-30-fichero-fuengirola-design.md`

**Global Constraints:**

- Trabajar en tres repositorios: `WF-Panel`, `vivir-en-fuengirola` y `conoce-fuengirola`. Los nombres de archivo de este plan son relativos al repositorio indicado en cada tarea.
- Mantener aprobación humana obligatoria. No instalar ni ejecutar IA en esta fase.
- `requireAdmin()` es la única frontera de administración. Ninguna operación de lectura de solicitudes, edición, aprobación o publicación puede depender de `requirePortalAccess`.
- No exponer claves de servicio al navegador. Los adaptadores y las escrituras entre proyectos solo se ejecutan en servidor.
- Conservar slugs públicos cuando ya exista una ficha; cuando un slug cambie, crear una redirección permanente antes de publicar el nuevo slug.
- Los planes canónicos son exactamente `gratis | pro | premium`; no introducir `normal` ni alias persistidos.
- La aprobación de una solicitud y el resultado de publicación son estados distintos. Una publicación parcialmente fallida no revierte la aprobación.
- Cada publicación usa `(profile_id, channel_id, source_version)` como clave idempotente. Reintentar una versión nunca debe crear duplicados ni incrementar la versión.
- No desplegar el formulario público hasta que la migración maestra, los dos esquemas de proyección y las credenciales server-side estén activos.
- En Vivir en Fuengirola cumplir `AGENTS.md`: review → `npm run precommit` → `npm run check` → PR/CI/Playwright/CodeRabbit → merge.
- Actualizar `AUDIT.md`, `NEXT.md` y `README.md` cuando cambie el estado real de Vivir en Fuengirola.

**Review Focus:** autorización admin, aislamiento de PII, RLS, validación de límites, idempotencia, fallos parciales entre canales, compatibilidad de slugs, igualdad de inventario y derechos de plan.

---

## Repository map and delivery order

| Repository | Responsibility | Deploy order |
|---|---|---:|
| `WF-Panel` | Fuente canónica, revisión humana, UI Fichero, auditoría y orquestación | 1 |
| `vivir-en-fuengirola` | Proyección Vivir, alta pública, directorio, métricas y portal del propietario | 2 |
| `conoce-fuengirola` | Proyección Conoce, directorio, miniweb Premium y alta pública | 3 |

El primer despliegue de WF Panel debe mantener desactivada la publicación con `FICHERO_PUBLISHING_ENABLED=false`. Se activa solo después de aplicar las migraciones de ambos canales y configurar las credenciales.

---

### Task 0: Prepare isolated branches and record the baseline

**Files:**

- Read: `WF-Panel/package.json`
- Read: `vivir-en-fuengirola/AGENTS.md`
- Read: `vivir-en-fuengirola/package.json`
- Read: `conoce-fuengirola/package.json`
- Create: none

**Step 1: Create or reuse one isolated branch/worktree per repository**

Use branch names:

```text
codex/fichero-fuengirola-panel
codex/fichero-fuengirola-vivir
codex/fichero-fuengirola-conoce
```

Keep PR 69 as the source branch only for the Vivir work; do not merge it first.

**Step 2: Capture a clean baseline**

Run in each repository:

```bash
git status --short
git rev-parse --abbrev-ref HEAD
git log -1 --oneline
```

Expected: no unexplained local changes. Preserve unrelated user changes and stop if they overlap files in this plan.

**Step 3: Run baseline checks**

WF Panel:

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

Vivir:

```bash
npm run test:unit
npm run lint
npm run typecheck
npm run build
```

Conoce:

```bash
npm run typecheck
npm run build
npm run test:e2e -- --list
```

Expected: record every pre-existing failure separately. In Vivir, reproduce the current `next/font` build failure before changing dependencies; do not call later work complete until it passes.

**Step 4: Commit**

No commit in this task.

---

### Task 1: Add the canonical Fichero schema to WF Panel

**Repository:** `WF-Panel`

**Files:**

- Create: `supabase/migrations/202610300001_fichero_catalog.sql`
- Modify: `src/lib/supabase/types.ts`
- Create: `tests/fichero-migration.test.mjs`

**Step 1: Write the failing migration contract test**

The test must read the migration as text and assert the presence of:

- `directory_catalogs`, `directory_channels`, `directory_profiles`, `directory_profile_channels`, `directory_profile_reviews`, `directory_publication_events`, `directory_slug_redirects`.
- Checks for `gratis`, `pro`, `premium` and for review/publication states.
- Unique keys on `(catalog_id, canonical_slug)`, `(profile_id, channel_id)` and `(profile_id, channel_id, source_version)`.
- RLS enabled on all seven tables.
- Policies/RPCs restricted by `public.is_admin()` or equivalent existing admin predicate.
- No public `SELECT` on request PII or canonical profiles.

Run:

```bash
node --test tests/fichero-migration.test.mjs
```

Expected: FAIL because the migration does not exist.

**Step 2: Implement the migration**

Use these minimum columns and relationships:

```text
directory_catalogs: id, key, name, status, created_at, updated_at
directory_channels: id, catalog_id, key, name, status, created_at, updated_at
directory_profiles: id, catalog_id, source_request_id, owner_user_id, canonical_slug,
  legal_name, display_name, cif, contact_email, phone, whatsapp, website, address,
  latitude, longitude, category_key, category_label, neighborhood_keys,
  short_description, long_description, seo_title, seo_description, services,
  schedule, photos, plan, review_status, content_version, approved_at,
  approved_by, published_at, created_at, updated_at
directory_profile_channels: profile_id, channel_id, enabled, public_slug,
  editorial_placement, last_published_version, last_publication_status,
  last_publication_error, last_published_at, updated_at
directory_profile_reviews: id, profile_id, reviewer_id, decision, notes,
  snapshot, created_at
directory_publication_events: id, profile_id, channel_id, source_version,
  idempotency_key, status, attempt_count, payload_hash, remote_record_id,
  error_code, error_message, started_at, completed_at, created_at, updated_at
directory_slug_redirects: id, profile_id, channel_id, old_slug, new_slug,
  http_status, created_at
```

Seed catalog `fuengirola` and channels `vivir-fuengirola` and `conoce-fuengirola`. Add `updated_at` triggers and indexes for review queue, catalog/plan/status, normalized CIF, contact email and publication retries.

Use `citext` or a deterministic normalization function for CIF/email comparisons; retain the original display value separately.

**Step 3: Extend generated/hand-maintained TypeScript database types**

Add rows, inserts, updates and relationships for the seven tables. Add reusable unions:

```ts
export type DirectoryPlan = 'gratis' | 'pro' | 'premium'
export type DirectoryReviewStatus = 'draft' | 'pending_review' | 'approved' | 'rejected' | 'archived'
export type DirectoryPublicationStatus = 'pending' | 'publishing' | 'published' | 'failed'
```

**Step 4: Run focused and database tests**

```bash
node --test tests/fichero-migration.test.mjs
npm run test:db
npm run typecheck
```

Expected: PASS. If local PostgreSQL is unavailable, keep the parser test green and record `test:db` as an environment blocker; do not silently skip it before deployment.

**Step 5: Commit**

```bash
git add supabase/migrations/202610300001_fichero_catalog.sql src/lib/supabase/types.ts tests/fichero-migration.test.mjs
git commit -m "feat(fichero): add canonical directory schema"
```

---

### Task 2: Define the canonical domain, validation and plan entitlements

**Repository:** `WF-Panel`

**Files:**

- Create: `src/lib/fichero/types.ts`
- Create: `src/lib/fichero/entitlements.mjs`
- Create: `src/types/fichero-entitlements.d.ts`
- Create: `src/lib/fichero/validation.mjs`
- Create: `src/types/fichero-validation.d.ts`
- Create: `tests/fichero-domain.test.mjs`

**Step 1: Write failing domain tests**

Cover:

- `gratis`: directory/search only; no featured placement, miniweb or stats dashboard.
- `pro`: directory/search, recommended placement, public contact actions and basic stats.
- `premium`: all Pro rights plus miniweb, SEO fields, advanced stats and editorial placement.
- Reject unknown plans, empty name/category, malformed email/URL, excessive arrays, text above limits and `__otro__` without a custom label.
- Normalize phone, email, CIF, slug and arrays without destroying accents in display text.
- Produce a stable payload hash independent of object key order.

Run:

```bash
node --test tests/fichero-domain.test.mjs
```

Expected: FAIL because the modules do not exist.

**Step 2: Implement one entitlement matrix**

Expose pure functions:

```ts
getPlanEntitlements(plan)
canRenderMiniweb(plan)
canShowContactActions(plan)
canShowRecommendedPlacement(plan)
canShowEditorialPlacement(plan)
```

Do not scatter string comparisons throughout UI components.

**Step 3: Implement canonical validation**

Expose:

```ts
parseDirectoryProfileInput(input)
normalizeDirectoryIdentity(input)
stablePayloadHash(input)
```

Return field-level errors suitable for the admin form. Set explicit limits for every free-text and array field and strip unknown properties.

**Step 4: Run tests**

```bash
node --test tests/fichero-domain.test.mjs
npm run typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/fichero src/types/fichero-*.d.ts tests/fichero-domain.test.mjs
git commit -m "feat(fichero): define profile validation and plan rights"
```

---

### Task 3: Convert business requests into reviewed canonical drafts

**Repository:** `WF-Panel`

**Files:**

- Create: `supabase/migrations/202610300002_fichero_request_approval.sql`
- Modify: `src/lib/platform-requests/public-api.mjs`
- Modify: `src/types/platform-requests-public-api.d.ts`
- Modify: `src/lib/platform-requests/admin.ts`
- Modify: `src/lib/actions/platform-requests.ts`
- Modify: `src/components/admin/platform-request-inbox.tsx`
- Modify: `tests/platform-requests-api.test.mjs`
- Modify: `tests/platform-requests-admin.test.mjs`
- Modify: `tests/platform-request-inbox-ui.test.mjs`
- Create: `tests/fichero-request-approval.test.mjs`

**Step 1: Write failing intake tests**

Add fixtures for both sources:

```json
{
  "platform": "vivir-fuengirola-negocios",
  "request_type": "business",
  "payload": { "schema_version": "fichero.v1", "catalog": "fuengirola" }
}
```

and:

```json
{
  "platform": "conoce-fuengirola",
  "request_type": "business",
  "payload": { "schema_version": "fichero.v1", "catalog": "fuengirola" }
}
```

Assert:

- CORS allows only configured origins.
- Turnstile/honeypot/rate/size checks remain active.
- Unknown payload fields and invalid plan values are rejected.
- Pending duplicates are detected across both source platforms by catalog plus normalized CIF, or by normalized email/domain and name when CIF is absent.
- A normal non-business platform request retains its existing CRM conversion behavior.
- Business approval creates one canonical draft and links `source_request_id`; reapproval returns the same profile.
- Rejection records reviewer, timestamp and note without creating a profile.

Run:

```bash
node --test tests/platform-requests-api.test.mjs tests/platform-requests-admin.test.mjs tests/platform-request-inbox-ui.test.mjs tests/fichero-request-approval.test.mjs
```

Expected: FAIL on the new Fichero behavior.

**Step 2: Add a transactional approval RPC**

Create an admin-only RPC such as:

```text
approve_directory_request(request_id, reviewer_id, profile_patch)
```

It must lock the request row, verify `pending`, find/create exactly one profile, write a review snapshot, update the request to `approved` and return the profile ID. It must never publish.

**Step 3: Update the public parser and duplicate fingerprint**

Validate `fichero.v1` before insert. Do not store secrets or browser-supplied owner IDs. Preserve source platform only as provenance, not as catalog identity.

**Step 4: Split admin actions by request type**

- Business request: approve/reject into Fichero.
- Existing contact/client request: preserve current CRM behavior.
- Every exported action begins with `await requireAdmin()`.

Update the inbox to label the result clearly as “Ficha creada para revisión”; do not imply it is public.

**Step 5: Run focused tests**

```bash
node --test tests/platform-requests-api.test.mjs tests/platform-requests-admin.test.mjs tests/platform-request-inbox-ui.test.mjs tests/fichero-request-approval.test.mjs
npm run typecheck
```

Expected: PASS.

**Step 6: Commit**

```bash
git add supabase/migrations/202610300002_fichero_request_approval.sql src/lib/platform-requests src/types/platform-requests-public-api.d.ts src/lib/actions/platform-requests.ts src/components/admin/platform-request-inbox.tsx tests
git commit -m "feat(fichero): turn approved requests into reviewed drafts"
```

---

### Task 4: Build the idempotent publication orchestrator and channel adapters

**Repository:** `WF-Panel`

**Files:**

- Modify: `src/lib/env.ts`
- Modify: `src/lib/supabase/server.ts`
- Create: `src/lib/fichero/publication/types.ts`
- Create: `src/lib/fichero/publication/adapter.ts`
- Create: `src/lib/fichero/publication/map-vivir.ts`
- Create: `src/lib/fichero/publication/map-conoce.ts`
- Create: `src/lib/fichero/publication/publish.ts`
- Create: `src/lib/fichero/repository.ts`
- Create: `src/lib/actions/fichero.ts`
- Create: `tests/fichero-publication.test.mjs`
- Create: `tests/fichero-adapters.test.mjs`

**Step 1: Write failing orchestration tests with fake adapters**

Assert:

- Draft or rejected profiles cannot publish.
- Validation completes before `content_version` increments.
- One publish action increments the version once and attempts each enabled channel once.
- Success in Vivir plus failure in Conoce persists two independent event results and leaves the profile approved.
- Retrying Conoce uses the same version/idempotency key and does not call Vivir again.
- A duplicate request for an already published version is a no-op.
- Error messages persisted to the UI are bounded and do not include credentials or raw response bodies.

Run:

```bash
node --test tests/fichero-publication.test.mjs tests/fichero-adapters.test.mjs
```

Expected: FAIL because the orchestrator does not exist.

**Step 2: Add required environment accessors and admin clients**

Server-only variables:

```text
FICHERO_PUBLISHING_ENABLED
VIVIR_FUENGIROLA_SUPABASE_URL
VIVIR_FUENGIROLA_SUPABASE_SERVICE_ROLE_KEY
CONOCE_FUENGIROLA_SUPABASE_URL
CONOCE_FUENGIROLA_SUPABASE_SERVICE_ROLE_KEY
```

Follow the existing `createTodoPlasticoAdminClient()` pattern, but expose two named clients. Throw a clear configuration error only when publishing is invoked, not during unrelated panel rendering.

**Step 3: Implement pure projection mappers**

Both mappers receive the same immutable `CanonicalPublicationSnapshot`. They return only columns owned by their target schema. Include `canonical_profile_id`, `source_version`, plan, public slug, channel entitlement flags and payload hash.

The Conoce client must address its existing `conoce` Postgres schema explicitly; an upsert against the default `public` schema is a test failure.

**Step 4: Implement publication flow**

The action must:

1. `requireAdmin()`.
2. Load and validate the current profile.
3. Atomically mark it approved, increment `content_version` and create pending events for enabled channels.
4. Attempt each target `upsert` synchronously.
5. Persist success/failure per event and per profile-channel.
6. Return a structured per-channel result for the UI.

Do not keep a database transaction open during network calls. Do not roll back a successful channel because another failed.

**Step 5: Add retry actions**

Expose:

```ts
publishApprovedProfile(profileId)
retryProfileChannel(profileId, channelKey, sourceVersion)
```

Both must be idempotent and admin-only.

**Step 6: Run tests and typecheck**

```bash
node --test tests/fichero-publication.test.mjs tests/fichero-adapters.test.mjs
npm run typecheck
```

Expected: PASS.

**Step 7: Commit**

```bash
git add src/lib/env.ts src/lib/supabase/server.ts src/lib/fichero src/lib/actions/fichero.ts tests/fichero-*.test.mjs
git commit -m "feat(fichero): publish versioned profiles to both channels"
```

---

### Task 5: Add the Fichero application to WF Panel

**Repository:** `WF-Panel`

**Files:**

- Modify: `src/components/layout/app-shell.tsx`
- Create: `src/components/fichero/fichero-nav.tsx`
- Create: `src/components/fichero/profile-list.tsx`
- Create: `src/components/fichero/profile-editor.tsx`
- Create: `src/components/fichero/review-panel.tsx`
- Create: `src/components/fichero/publication-status.tsx`
- Create: `src/app/paneladmin/(protected)/fichero/page.tsx`
- Create: `src/app/paneladmin/(protected)/fichero/[catalogKey]/page.tsx`
- Create: `src/app/paneladmin/(protected)/fichero/[catalogKey]/solicitudes/page.tsx`
- Create: `src/app/paneladmin/(protected)/fichero/[catalogKey]/fichas/page.tsx`
- Create: `src/app/paneladmin/(protected)/fichero/[catalogKey]/fichas/nueva/page.tsx`
- Create: `src/app/paneladmin/(protected)/fichero/[catalogKey]/fichas/[profileId]/page.tsx`
- Create: `src/app/paneladmin/(protected)/fichero/[catalogKey]/publicaciones/page.tsx`
- Create: `tests/fichero-admin-ui.test.mjs`
- Create: `tests/fichero-admin-actions.test.mjs`

**Step 1: Write failing UI/security tests**

Assert:

- “Fichero” is a first-level left-navigation item.
- Catalog `fuengirola` exposes Solicitudes, Fichas and Publicaciones.
- Every page is under the protected layout and every mutation calls `requireAdmin()`.
- The editor shows plan, both channel toggles, public slugs, ownership link, SEO fields and the rights preview.
- “Guardar borrador”, “Aprobar” and “Aprobar y publicar” are separate actions.
- Publication result shows success/failure per channel and a scoped retry button.
- Rejection requires a note; publish requires confirmation and displays the target channels.

Run:

```bash
node --test tests/fichero-admin-ui.test.mjs tests/fichero-admin-actions.test.mjs
```

Expected: FAIL.

**Step 2: Implement navigation and catalog selector**

Do not nest Fichero below Vivir or Conoce. The catalog selector starts with Fuengirola but reads from `directory_catalogs` so future directories do not require shell changes.

**Step 3: Implement list and editor**

Support search by display/legal name, CIF, email and slug; filters by plan, review state and per-channel publication state. Use server-side pagination.

The editor must use `parseDirectoryProfileInput` on the server even if client validation passes. Ambiguous duplicate matches are shown to the human; never auto-merge them.

**Step 4: Implement review and publication feedback**

After “Aprobar y publicar”, stay on the profile and show the persisted event IDs/status. A retry targets only failed channels and the same source version.

**Step 5: Run focused and full WF Panel checks**

```bash
node --test tests/fichero-admin-ui.test.mjs tests/fichero-admin-actions.test.mjs
npm test
npm run lint
npm run typecheck
npm run build
```

Expected: PASS.

**Step 6: Commit**

```bash
git add src/components/layout/app-shell.tsx src/components/fichero 'src/app/paneladmin/(protected)/fichero' tests/fichero-admin-*.test.mjs
git commit -m "feat(fichero): add human review and publishing workspace"
```

---

### Task 6: Make Vivir a safe Fichero projection

**Repository:** `vivir-en-fuengirola`

**Files:**

- Create: `supabase/migrations/202610300001_fichero_projection.sql`
- Modify: `src/lib/types.ts`
- Modify: `src/lib/business-queries.ts`
- Modify: `src/lib/business-actions.ts`
- Modify: `src/lib/business-utils.ts`
- Modify: `src/app/negocios/[slug]/page.tsx`
- Modify: `src/app/sitemap.ts`
- Create: `src/app/negocios/[slug]/redirect/route.ts` only if middleware cannot issue the permanent redirect cleanly
- Create: `unit-tests/business-entitlements.test.ts`
- Create: `unit-tests/business-projection.test.ts`

**Step 1: Write failing plan/projection tests**

Assert:

- Only `gratis | pro | premium` parse.
- All published plans appear in listings/search.
- Only Pro/Premium receive recommended ranking.
- Contact actions render for Pro/Premium.
- Only Premium resolves a full SEO miniweb/detail page.
- Unpublished, stale-disabled or failed projection rows never appear.
- A known old slug resolves to a 308 redirect; unknown slugs remain 404.
- Sitemap contains only indexable Premium detail pages plus directory routes.

Run:

```bash
npm run test:unit
```

Expected: FAIL on Pro rights, projection metadata and redirects.

**Step 2: Add projection columns and constraints**

Add to `businesses`:

```text
canonical_profile_id uuid unique
source_version bigint not null default 0
payload_hash text
channel_enabled boolean not null default true
published_at timestamptz
```

Replace any old plan check with exactly `gratis`, `pro`, `premium`. Add `business_slug_redirects(old_slug unique, new_slug, canonical_profile_id, created_at)`. Preserve current public rows during migration; do not assign invented canonical IDs.

Service-role writes are allowed; public clients remain read-only through existing published-row policies.

**Step 3: Centralize plan behavior**

Replace `hasPremiumBusinessProfile` with explicit helpers that match the canonical matrix. Ensure queries use status, channel flag and plan ordering deterministically (`premium`, `pro`, `gratis`, then name).

**Step 4: Make owner edits drafts, not live canonical overrides**

The existing `/mi-cuenta/negocio` action may submit a change request or save an owner draft, but it must not overwrite a newer `source_version` from WF Panel. Add an optimistic source-version check and route final approval back through Fichero.

**Step 5: Add permanent slug lookup**

Resolve the current slug first, then redirect table. Never chain redirects; publication must update old mappings to the final slug.

**Step 6: Run focused checks**

```bash
npm run test:unit
npm run typecheck
```

Expected: PASS.

**Step 7: Commit**

```bash
git add supabase/migrations/202610300001_fichero_projection.sql src/lib src/app/negocios src/app/sitemap.ts unit-tests/business-*.test.ts
git commit -m "feat(directory): align Vivir with canonical Fichero profiles"
```

---

### Task 7: Replace PR 69’s local lead store with the canonical public intake

**Repository:** `vivir-en-fuengirola`

**Files:**

- Modify: `src/components/register/register-form.tsx`
- Modify: `src/components/register/register-banner.tsx`
- Modify: `src/app/registrar/page.tsx`
- Create: `src/lib/platform-request-client.ts`
- Delete: `src/app/api/register/route.ts`
- Delete: `src/app/api/leads/route.ts`
- Delete: `src/lib/leads-store.ts`
- Delete: `src/components/portal/leads-manager.tsx`
- Delete: `src/app/mi-cuenta/(portal)/solicitudes/page.tsx`
- Modify: `src/app/mi-cuenta/(portal)/layout.tsx`
- Create: `unit-tests/platform-request-client.test.ts`
- Modify: `tests/smoke.spec.ts`

**Step 1: Write failing client and browser tests**

Assert:

- Form sends `schema_version: fichero.v1`, catalog `fuengirola` and source `vivir-fuengirola-negocios`.
- Plan values are canonical.
- Custom category/neighborhood become normal validated fields; no FK sentinel values are inserted locally.
- Network and validation errors keep user data and do not claim success.
- Success explains that the request awaits human review.
- No portal user can enumerate or mutate other people’s requests.
- Repository contains no JSON fallback or public `/api/leads` route.

Run:

```bash
npm run test:unit
npm run test:e2e -- tests/smoke.spec.ts
```

Expected: FAIL while the PR 69 local lead path remains.

**Step 2: Implement the browser client**

Fetch the WF Panel public config endpoint for Turnstile/site configuration, then POST to its `platform-requests` endpoint. Keep only public endpoint/origin values in `NEXT_PUBLIC_*`; no service key.

**Step 3: Remove the unsafe duplicate lead backend**

Delete the five local API/store/admin artifacts listed above and remove navigation links. Approval now happens only in WF Panel Fichero.

**Step 4: Run focused tests**

```bash
npm run test:unit
npm run typecheck
npm run test:e2e -- tests/smoke.spec.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add -A src unit-tests tests/smoke.spec.ts
git commit -m "fix(registration): send business requests to protected Fichero intake"
```

---

### Task 8: Simplify Vivir’s public directory and make every tier real

**Repository:** `vivir-en-fuengirola`

**Files:**

- Modify: `src/app/negocios/page.tsx`
- Modify: `src/components/business/business-explorer.tsx`
- Modify: `src/app/negocios-recomendados-fuengirola/page.tsx`
- Modify: `src/app/planes/page.tsx`
- Modify: `src/app/guias/page.tsx`
- Modify: `src/components/metrics/business-metrics.tsx`
- Modify: `src/app/api/metrics/route.ts`
- Modify: `src/lib/metrics-store.ts`
- Modify: `src/app/mi-cuenta/(portal)/negocio/page.tsx`
- Create: `unit-tests/business-directory.test.ts`
- Create: `unit-tests/business-metrics-access.test.ts`
- Modify: `tests/smoke.spec.ts`
- Modify: `tests/seo.spec.ts`

**Step 1: Write failing directory tests**

Cover:

- Search first, then recommended Pro/Premium, then complete directory.
- Categories/neighborhoods only appear when they contain at least one published business.
- Remove fixed editorial slugs and empty/noisy category lists.
- Free card contains basic identity and directory link only.
- Pro card exposes allowed contact actions and “Recomendado”.
- Premium exposes miniweb/SEO and editorial placement.
- The Vivir guide landing contains only Premium businesses whose channel configuration has `editorial_placement=true`; no hard-coded business slugs.
- Prices display €5 Pro and €19 Premium with the billing period explicitly stated.

**Step 2: Write failing metrics authorization tests**

Public tracking accepts only known event names, validates slug, rate-limits abuse and never accepts a browser-supplied fallback counter. Owner/admin reads require authorization and verify ownership.

Basic stats for Pro: views and total contact actions. Advanced Premium stats: channel-specific views and separate web/phone/WhatsApp actions. Gratis receives no dashboard.

**Step 3: Implement the simplified directory**

Drive all sections from `getAllBusinesses()` and entitlement helpers. Keep one source of sorting truth. Add empty-state copy and a visible “Publica tu negocio” link to `/registrar`.

Populate the commercial block on `/guias` from the same projection query, label it as promoted/recommended content and exclude Pro/Gratis even if they are featured in the directory.

**Step 4: Harden metrics**

Move increments to an atomic Supabase RPC or equivalent database update. Never trust client counters. Link owner access through the canonical `owner_user_id`; unlinked profiles show a safe “solicitar vinculación” state, not another user’s metrics.

**Step 5: Run tests**

```bash
npm run test:unit
npm run typecheck
npm run test:e2e -- tests/smoke.spec.ts tests/seo.spec.ts
```

Expected: PASS.

**Step 6: Commit**

```bash
git add src/app/negocios src/app/negocios-recomendados-fuengirola src/app/planes src/app/guias src/app/api/metrics src/app/mi-cuenta src/components/business src/components/metrics src/lib/metrics-store.ts unit-tests tests
git commit -m "feat(directory): simplify Vivir listings and enforce plan rights"
```

---

### Task 9: Add the Conoce projection, rights and canonical registration

**Repository:** `conoce-fuengirola`

**Files:**

- Create: `supabase/migrations/202610300001_fichero_projection.sql`
- Modify: `lib/content/types.ts`
- Modify: `lib/business-repository.ts`
- Modify: `lib/business-paths.ts`
- Create: `lib/business-entitlements.mjs`
- Create: `lib/business-entitlements.d.ts`
- Create: `lib/platform-request-client.ts`
- Modify: `components/pages/businesses-page-content.tsx`
- Modify: `components/business-card.tsx`
- Modify: `components/pages/business-detail-page-content.tsx`
- Modify: `components/business-detail/business-sidebar.tsx`
- Modify: `app/negocios/page.tsx`
- Modify: `app/[locale]/negocios/page.tsx`
- Modify: `app/negocios/[categorySlug]/[businessSlug]/page.tsx`
- Modify: `app/[locale]/negocios/[categorySlug]/[businessSlug]/page.tsx`
- Modify: `app/sitemap.ts`
- Modify: `app/guias/page.tsx`
- Modify: `app/[locale]/guias/page.tsx`
- Create: `app/publica-tu-negocio/page.tsx`
- Create: `components/business-registration-form.tsx`
- Modify: `package.json`
- Create: `tests/unit/business-entitlements.test.mjs`
- Create: `tests/unit/business-repository-contract.test.mjs`
- Modify: `tests/home.spec.ts`

**Step 1: Add a Node unit-test script and failing tests**

Add:

```json
"test:unit": "node --test tests/unit/*.test.mjs"
```

Assert the same entitlement matrix, visibility filters, deterministic ordering and 308 slug behavior as Vivir. Assert the registration payload uses catalog `fuengirola`, source `conoce-fuengirola` and `fichero.v1`.

Run:

```bash
npm run test:unit
```

Expected: FAIL.

**Step 2: Add projection metadata without replacing Conoce’s content model**

Add `canonical_profile_id`, `source_version`, `payload_hash`, `plan`, `publication_status`, `channel_enabled` and `published_at` to `conoce.businesses`, plus a schema-local slug redirect table. Preserve localized/category fields and existing rows.

**Step 3: Apply the canonical rights to Conoce UI**

- Gratis and Pro remain listing/search entries.
- Pro is recommended and exposes contact actions.
- Premium gets the indexable detail/miniweb and editorial guide placement.
- The guide landing in every locale renders only Premium rows explicitly enabled for editorial placement and labels the commercial relationship.
- Non-Premium detail URLs return 404 or redirect to the directory card anchor; choose one behavior and lock it in tests. Recommended choice: 404 for never-indexed URLs, 308 to a Premium page only when a former Premium slug has an explicit redirect.

Localized routes must behave identically to Spanish routes.

The guide placement must come from `business-repository.ts`, not from a duplicated static list in page content.

**Step 4: Add public registration**

The form posts to the same WF Panel intake. Cross-channel duplicate detection happens server-side; do not implement a second approval store.

**Step 5: Run checks**

```bash
npm run test:unit
npm run typecheck
npm run build
npm run test:e2e -- tests/home.spec.ts
```

Expected: PASS.

**Step 6: Commit**

```bash
git add supabase lib components app package.json tests
git commit -m "feat(directory): connect Conoce to the Fuengirola Fichero"
```

---

### Task 10: Reconcile existing businesses without losing URLs

**Repository:** `WF-Panel`

**Files:**

- Create: `scripts/reconcile-fuengirola-directory.mjs`
- Create: `src/lib/fichero/reconciliation.mjs`
- Create: `src/types/fichero-reconciliation.d.ts`
- Create: `tests/fixtures/fichero-reconciliation.json`
- Create: `tests/fichero-reconciliation.test.mjs`
- Create: `docs/fichero-fuengirola-reconciliation.md`

**Step 1: Write failing deterministic matching tests**

Match in this order only:

1. Existing `canonical_profile_id`.
2. Normalized CIF.
3. Exact normalized domain/contact plus compatible normalized name.
4. Existing public slug within the same channel.
5. Manual review.

Assert that conflicting strong identifiers and one-to-many matches are always `ambiguous`; never select the first row.

Run:

```bash
node --test tests/fichero-reconciliation.test.mjs
```

Expected: FAIL.

**Step 2: Implement dry-run first**

Command contract:

```bash
node scripts/reconcile-fuengirola-directory.mjs --dry-run --output /tmp/fichero-fuengirola-report.json
```

Report counts and row IDs for `matched`, `vivir_only`, `conoce_only`, `ambiguous`, `conflict`, `invalid`. Redact contact values in logs.

**Step 3: Implement explicit apply mode**

Require both `--apply` and an input decisions file for ambiguous rows. Upsert canonical records, preserve each channel’s current slug and create profile-channel links. Do not publish or delete unmatched target rows automatically.

**Step 4: Test with fixtures, then run production dry-run**

```bash
node --test tests/fichero-reconciliation.test.mjs
node scripts/reconcile-fuengirola-directory.mjs --dry-run --output /tmp/fichero-fuengirola-report.json
```

Expected: unit PASS; dry-run exits 0 and changes zero rows. Human reviews the report before any `--apply` execution.

**Step 5: Commit**

```bash
git add scripts/reconcile-fuengirola-directory.mjs src/lib/fichero/reconciliation.mjs src/types/fichero-reconciliation.d.ts tests docs/fichero-fuengirola-reconciliation.md
git commit -m "feat(fichero): add safe Fuengirola catalog reconciliation"
```

---

### Task 11: Resolve vulnerabilities and the Vivir build failure with evidence

**Repository:** `vivir-en-fuengirola`

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/app/modelos/landing-entrenadora-personal/page.tsx` only if the reproduced font failure is caused by runtime font fetching
- Modify: `src/app/layout.tsx` only if moving to a locally bundled/system font is the smallest verified fix
- Modify: `AUDIT.md`
- Modify: `NEXT.md`
- Modify: `README.md`

**Step 1: Capture vulnerability evidence**

Run and save the summaries in `AUDIT.md`:

```bash
npm audit --omit=dev
npm audit
npm outdated
```

Expected baseline: current audit includes the critical Next.js issue already observed. Do not run blind `npm audit fix` or accept a major downgrade.

**Step 2: Add or identify a regression test for the font/build failure**

Run:

```bash
npm run build
```

Expected before fix: reproduce the `next/font` Google loader failure in `src/app/modelos/landing-entrenadora-personal/page.tsx`. Determine whether it is an unavailable network fetch, unsupported configuration or framework defect. Record the root cause before editing.

**Step 3: Apply minimal dependency upgrades**

Upgrade Next.js and `eslint-config-next` to the patched compatible release verified at implementation time (the audit found `16.4.3` available on 2026-10-30). Upgrade direct vulnerable packages only as needed; keep Capacitor major upgrades separate unless required for a production vulnerability.

If build reliability depends on a remote font fetch, use an existing local font asset or a system font stack instead of adding an unverified download step.

**Step 4: Verify audits and all required repo checks**

```bash
npm audit --omit=dev
npm run test:unit
npm run precommit
npm run check
npm run test:e2e
```

Expected: zero critical/high production vulnerabilities unless a documented upstream exception has an owner and mitigation; all commands PASS.

**Step 5: Update project truth**

`AUDIT.md` records before/after counts and remaining exceptions. `NEXT.md` moves completed PR 69/Fichero work out of pending and lists Superentrenador next, TodoPlástico audit after it. `README.md` describes the canonical intake and human approval path.

**Step 6: Commit**

```bash
git add package.json package-lock.json src/app AUDIT.md NEXT.md README.md
git commit -m "chore(security): patch production dependencies and restore builds"
```

---

### Task 12: Verify the complete story and stage deployment safely

**Repositories:** all three

**Files:**

- Create: `WF-Panel/docs/fichero-fuengirola-runbook.md`
- Modify: deployment environment documentation in each repository if present
- Modify: CI workflows only if current jobs do not execute the required checks

**Step 1: Add an end-to-end acceptance scenario**

Automate or document a seeded test covering:

1. Submit one business request from Vivir.
2. Confirm it appears only to an admin in Fichero.
3. Edit, approve and publish as Gratis; confirm both channel listings contain it and no miniweb is indexable.
4. Upgrade to Pro and publish; confirm recommended placement, contact actions and basic stats.
5. Upgrade to Premium and publish; confirm miniweb, SEO metadata, advanced stats and editorial placement in both channels.
6. Force Conoce adapter failure, publish a new version, confirm Vivir succeeds and Conoce shows failed.
7. Retry only Conoce and confirm same version, one target row and both channels green.
8. Change a slug and confirm the old URL returns 308 to the final URL.

**Step 2: Run final verification per repository**

WF Panel:

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

Vivir:

```bash
npm run precommit
npm run check
npm run test:e2e
```

Conoce:

```bash
npm run test:unit
npm run typecheck
npm run build
npm run test:e2e
```

Expected: every command PASS on final diffs.

**Step 3: Review each diff and security boundary**

Run in each repository:

```bash
git status --short
git diff --check
git diff --stat
git diff --cached
```

Explicitly inspect that service keys, raw PII fixtures, generated reconciliation reports and `.env` files are not committed.

**Step 4: Deploy in controlled order**

1. Back up all three Supabase projects.
2. Apply WF Panel migrations with publishing disabled.
3. Deploy WF Panel and verify admin-only Fichero access.
4. Apply Vivir and Conoce projection migrations.
5. Run reconciliation dry-run, review, then apply approved decisions.
6. Deploy Vivir and Conoce.
7. Configure target service credentials in WF Panel.
8. Enable `FICHERO_PUBLISHING_ENABLED=true`.
9. Publish one internal canary profile and verify both channels.
10. Enable the public registration links.

Rollback is feature-flag first: disable publishing and registration intake without deleting canonical or projection rows. Database migrations remain additive during this phase.

**Step 5: Open/update PRs and wait for gates**

- Vivir: update PR 69 with the reworked commits; require local check, CI, full Playwright and resolved CodeRabbit feedback.
- WF Panel and Conoce: open separate PRs and require their repository checks.
- Do not merge any consumer PR before its schema migration and WF Panel compatibility are reviewed.

**Step 6: Commit runbook changes**

In WF Panel:

```bash
git add docs/fichero-fuengirola-runbook.md
git commit -m "docs(fichero): add deployment and rollback runbook"
```

---

## Post-phase sequence (not part of this implementation)

1. Integrate Superentrenador into Fichero using a new catalog adapter after the Fuengirola canary is stable.
2. Audit TodoPlástico’s real repository, schema, moderation and AI-review capabilities before planning changes; do not replace its mature model from assumptions based on the current WF Panel screen.
3. Add new vertical directories only after extracting repeated adapter/editor patterns demonstrated by at least those two integrations.

---

## Plan self-review checklist

- [x] Every product requirement in the approved spec maps to a task.
- [x] Human approval is mandatory; AI is absent from implementation.
- [x] Canonical profile, request review and per-channel publication states are separate.
- [x] Both Fuengirola channels are required and independently retryable.
- [x] Free, Pro and Premium rights are explicit and tested on both sites.
- [x] Existing URLs are preserved through channel-specific slugs and 308 redirects.
- [x] PR 69’s unsafe local leads API/store is removed instead of patched into a second source of truth.
- [x] PII/admin authorization and service-key boundaries have dedicated tests.
- [x] Reconciliation is dry-run-first and ambiguity requires a human decision.
- [x] Dependency vulnerabilities and the existing build failure have an evidence-first task.
- [x] Deployment order, canary, feature flag and rollback are specified.
