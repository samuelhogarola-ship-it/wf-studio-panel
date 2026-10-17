# Samuel Coach Blog SEO Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore valuable historical Samuel Coach articles and exact URL continuity so search engines can crawl the best available content again.

**Architecture:** Build an evidence-backed legacy URL inventory, generate exact one-hop redirects, restore canonical sources in reviewed cohorts, and enforce repository-wide metadata/sitemap/internal-link contracts. Work against an isolated branch and rehearse the persistent production volume before traffic changes.

**Tech Stack:** Static HTML/Markdown generator, Node.js scripts/tests, Apache redirects, Playwright, sitemap/XML validation, Coolify persistent volume.

**Spec:** `docs/superpowers/specs/2026-10-17-client-portal-platform-design.md` (Section 10)

## Global Constraints

- Preserve or explicitly map every evidenced historical URL; do not redirect unrelated articles to the blog hub.
- Preserve original publication dates and content provenance; do not invent missing history.
- Historical aliases never enter the sitemap and resolve in at most one permanent redirect to a `200` canonical.
- Production persistent content is backed up and rehearsed before deployment.
- The work restores technical continuity but does not promise ranking or timing.

## Review Focus

- Percent-encoded accented URLs match before decoding differences cause 404s; Task 2 tests all known variants.
- Ten generator-deleted alias directories remain working redirects; Tasks 1-2 test this.
- Runtime volume reconciliation cannot overwrite newer editorial content; Task 6 tests this.
- Restored pages have distinct publication/modification dates and valid structured data; Tasks 3 and 5 test this.
- Every restored canonical is internally discoverable rather than sitemap-only; Task 5 tests this.

---

### Task 1: Evidence-backed historical inventory

**Files (Samuel Coach isolated worktree):**
- Create: `docs/recovery/blog-legacy-url-inventory.csv`
- Create: `scripts/blog-migration-inventory.mjs`
- Create: `tests/unit/blog-migration-inventory.test.mjs`

**Interfaces:**
- Produces: validated rows with `source_url_encoded,source_path_decoded,target_path,decision,evidence,content_source,original_date,status,notes`; decisions `restore|redirect|gone|research`.

- [ ] Write failing tests for required columns, duplicate sources/canonicals, invalid decisions, loops, missing evidence and malformed dates.
- [ ] Run `node --test tests/unit/blog-migration-inventory.test.mjs`; expect FAIL.
- [ ] Implement the parser and seed the inventory from deleted commit `c86b582d`, historical `f/**/index.html`, old sitemap/feed exports and available search/analytics evidence.
- [ ] Export and record the live persistent `/app/f` and `/app/blog-posts` trees before deciding final rows.
- [ ] Re-run the focused test; expect PASS.
- [ ] Commit as `docs: inventory historical blog URLs`.

### Task 2: Exact legacy redirect continuity

**Files:**
- Create: `scripts/sync-blog-legacy-redirects.mjs`
- Modify: `.htaccess`
- Modify: `tests/security/post-manager-server.test.mjs`
- Modify: `tests/playwright/seo-blog-consolidation.spec.js`

**Interfaces:**
- Consumes: validated inventory.
- Produces: deterministic marked redirect block placed before the generic `/blog/f/*` fallback.

- [ ] Add failing tests for all 15 known encoded-accent URLs, decoded/trailing-slash variants, `/blog/f/` variants, query preservation and exactly one `301` hop.
- [ ] Run security/Playwright focused tests; expect the historical URLs to fail.
- [ ] Implement redirect generation and ensure the server matcher handles exact encoded and decoded paths consistently.
- [ ] Re-run focused tests; expect every final destination to return `200` with the expected self-canonical.
- [ ] Commit as `fix: restore historical blog redirects`.

### Task 3: Preserve publication provenance in the generator

**Files:**
- Modify: `generate-blog.js`
- Modify: `tests/unit/blog-generator.test.mjs`
- Modify: `blog/Style/post-checklist.md`

**Interfaces:**
- Produces: independent `date_published` and `date_modified`, canonical slug validation, explicit status and rich HTML retention.

- [ ] Write failing tests for independent dates, historical date preservation, invalid slugs, draft exclusion and unchanged rich HTML.
- [ ] Run generator tests; expect FAIL.
- [ ] Extend the source contract minimally and document it.
- [ ] Re-run generator and generated-content checks; expect PASS and no unrelated HTML drift.
- [ ] Commit as `feat: preserve historical blog publication dates`.

### Task 4: Restore articles in reviewed cohorts

**Files:**
- Create/Modify: `blog-posts/<canonical-slug>.md`
- Generate: `f/<canonical-slug>/index.html`
- Add: required images under the existing approved image path.
- Modify: `tests/unit/blog-migration-inventory.test.mjs`

**Interfaces:**
- Consumes: inventory rows marked `restore` and Task 3 source contract.
- Produces: canonical public articles with traceable source evidence.

- [ ] Start with the highest-evidence/highest-demand cohort and write failing assertions for heading, substantial body, image existence, original date and canonical target.
- [ ] Restore only reviewed source content; do not automatically rewrite or fabricate missing passages.
- [ ] Generate pages and verify the cohort tests, links and media.
- [ ] Repeat as separate commits per reviewable cohort.

### Task 5: Repository-wide SEO and discovery contract

**Files:**
- Create: `scripts/audit-blog-seo-continuity.mjs`
- Create: `tests/unit/blog-seo-contract.test.mjs`
- Modify: `f/index.html` and relevant related-post links
- Modify: the six current posts missing `BlogPosting` JSON-LD
- Modify: `sitemap.xml` through existing generators

**Interfaces:**
- Produces: one title, description, H1, self-canonical, OG URL/image, valid `BlogPosting` dates and exactly one sitemap entry per indexable canonical.

- [ ] Write failing repository-wide tests for metadata, sitemap uniqueness, absent aliases and at least one internal discovery path per restored canonical.
- [ ] Run SEO/sitemap tests; expect failures for six missing JSON-LD posts and restored orphan candidates.
- [ ] Fix structured data, sitemap generation, blog hub cards and contextual related links.
- [ ] Run `npm run build`, `npm run check:generated`, `npm run check:links`, unit tests and focused Playwright; expect PASS.
- [ ] Commit as `fix: enforce blog SEO continuity`.

### Task 6: Persistent-volume rehearsal and staged deployment

**Files:**
- Create: `docs/recovery/2026-10-17-historical-blog-restoration.md`
- Modify: deployment/recovery documentation only if rehearsal reveals a required operational step.

- [ ] Build twice and verify the second pass produces no diff.
- [ ] Rehearse `prepareSiteContent` against copies of the live volume and previous baseline; assert restored pages appear without overwriting newer editorial changes.
- [ ] Deploy to a non-traffic container with a production-data copy and verify redirects with `curl --path-as-is`, final `200`, canonical, content hash, sitemap, images and restart persistence.
- [ ] Record every inventory decision, verification result, backup and rollback command.
- [ ] Switch traffic only after the staged checks pass, then submit the updated sitemap through the established search workflow.
- [ ] Run the full repository release gate and commit as `docs: record historical blog restoration`.
