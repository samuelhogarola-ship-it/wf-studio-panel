# Reviewed Blogger translations implementation plan

> **For agentic workers:** Use superpowers:executing-plans for native implementation, then the required independent final code review.

**Goal:** Optional translation generation from Finnish with saved editable drafts, explicit approval and publication that respects edits.

**Architecture:** Pure translation draft/hash validation in `src/lib/blogger/translations.mjs`; GitHub persistence/generation/approval in `publisher.mjs`; protected POST translation route; existing editor extended with language tabs and generate/approve controls.

**Tech Stack:** Existing Node/Next.js, Web Crypto/Node crypto, HTML/JavaScript editor, DeepL HTTP API and GitHub REST API.

**Spec:** `docs/superpowers/specs/2026-10-26-reviewed-blogger-translations.md`

## Global constraints

- Interface in English; original defaults to Finnish.
- Generation optional; no provider calls when saving or publishing.
- Preserve edits until explicit regeneration; approvals bind saved source and translated content.
- No paid subscription, no Proton Pass, no production test articles or exposed secrets.
- Separate wf-studio-panel repository, dedicated branch and reviewed PR to main.

## Review focus

- Original edits must not silently erase translations or retain stale approval.
- Editing one language must preserve unsaved edits in the others during tab switches.
- Provider/quota errors must preserve all existing localized text.
- Publication must reject missing/unapproved selected variants before changing the public branch.
- Shared image preview URLs must never leak into persisted translated body HTML.

## Tasks

Execution record: native implementation. Backend, API and editor tasks are implemented. Observed failing tests before implementation and review fixes; all 93 Blogger tests now pass. Full suite after review fixes: 553 passed, 2 database tests skipped (one additional free-endpoint test subsequently passed in the targeted suite). Lint, typecheck, production build and production dependency audit pass. Real-browser verification is unavailable because the CUA Node runtime cannot start; actual HTML/JavaScript is verified through JSDOM instead. Real DeepL key activation remains pending user sign-in with info@webfuengirola.com; 53 local environment files and the server had no configured key. No public test content was created.

Final review: independent review identified generation overwriting a translation saved concurrently and recommended locking navigation during asynchronous actions. Both were reproduced RED and fixed GREEN. Generation now rejects changed selected drafts and preserves unrelated language changes; navigation is locked until the operation completes. Broader collaborative editing remains outside this feature.

### 1. Persist reviewed translation drafts

- [ ] Write failing tests in `tests/blogger-translations.test.mjs`: content hashes, manual edits, original edits, approval matching exact content, unapproved rejection.
- [ ] Run the tests and verify missing exports/behavior fail.
- [ ] Implement `sourceFingerprint`, `normalizeTranslationDrafts`, `approveTranslationDraft`, `publicationTranslations` in `src/lib/blogger/translations.mjs`.
- [ ] Extend publisher read/save with sibling translation JSON; implement `generateBloggerTranslations(slug, languages)` and `approveBloggerTranslation(slug, language, sourceFingerprint, contentFingerprint)`.
- [ ] Extend in-memory round-trip tests for generate -> edit -> approve -> publish -> reopen, repeated publication without provider calls, explicit regeneration and provider failure preservation.
- [ ] Run targeted tests and commit the tested backend deliverable.

### 2. Protected API and editor flow

- [ ] Test authenticated same-origin POST actions and rejected foreign/unauthorized requests in `tests/blogger-translation-routes.test.mjs`.
- [ ] Add `src/app/api/posts/[slug]/translations/route.ts`, publisher module declarations and optional translation availability metadata.
- [ ] Add language tabs, generate and approve controls in `public/blogger/index.html` and state transitions in `public/blogger/app.js`. Reuse existing visual editor, public image serialization and preview sandbox.
- [ ] Verify in local browser: Finnish original, generate English/Spanish, edit and save one, approve both, publish exact saved revisions, regenerate only when clicked.
- [ ] Run targeted/full tests, lint/typecheck/build and production dependency audit; commit.

### 3. Integrate and deploy

- [ ] Review the complete diff independently and fix important findings.
- [ ] Push the dedicated branch, open/attach PR, wait for checks, merge and verify exact deployed commit.
- [ ] Verify production access and UI without writing test content. Report real key/account availability and any remaining activation step accurately.
