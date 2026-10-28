# WF-Blogger Variants and Sport Massage Branding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consume the canonical WF-Blogger variants in Studio and display Sport Massage's approved preview image and official logo in its Blogger entry.

**Architecture:** The site registry identifies the product variant and optional public branding assets. Shared client components render those assets; authentication, launch tickets and publishing behavior remain unchanged.

**Tech Stack:** Next.js 15, React 19, TypeScript, JSON registry, Node test runner.

**Spec:** User-approved two-variant WF-Blogger model and supplied Sport Massage artwork from 2026-10-28.

## Global Constraints

- Sport Massage is `static`; Agama and Samuel Coach are `vps`.
- Brand assets are public files owned by WF-Studio Panel and contain no secrets.
- The preview must not change the one-use ticket flow or publish content.
- Other tenants render safely without branding metadata.

## Review Focus

- Unsafe asset paths fail registry validation.
- Missing optional assets preserve the generic launcher.
- Only Sport Massage receives Sport Massage branding.
- Automatic launch remains functional and accessible.
- No article mutation or publishing action is introduced.

---

### Task 1: Register the two product variants and branding

**Files:**
- Modify: `src/config/sites.json`
- Modify: `src/lib/sites/registry.mjs`
- Modify: `src/lib/sites/registry-module.d.ts`
- Modify: `tests/site-registry.test.mjs`
- Add: `public/brands/sportmassage/wf-blogger-preview.png`
- Add: `public/brands/sportmassage/logo.png`

**Interfaces:**
- Produces: typed, validated `blogger.variant`, `logoPath`, and `previewImagePath` fields.

- [ ] Add failing registry tests.
- [ ] Verify the expected failures.
- [ ] Implement validation, types, registry values and assets.
- [ ] Run the focused registry tests.

### Task 2: Render the branded WF-Blogger entry

**Files:**
- Add: `src/components/blogger/blogger-branding.tsx`
- Modify: `src/components/blogger/panel-blogger-launch.tsx`
- Modify: `src/app/cliente/(protected)/proyectos/[slug]/blogger/page.tsx`
- Modify: `src/app/cliente/(protected)/proyectos/[slug]/page.tsx`
- Modify: `src/lib/i18n.ts`
- Modify: `tests/sport-blogger-central-access.test.mjs`

**Interfaces:**
- Consumes: optional branding paths from the validated site registry.
- Produces: an accessible preview/logo composition for the Sport Massage WF-Blogger entry.

- [ ] Add failing render assertions for WF-Blogger, preview and logo.
- [ ] Verify the expected failures.
- [ ] Implement the shared branded presentation and wire both panel surfaces.
- [ ] Run focused tests, then the full suite, lint, typecheck and production build.
