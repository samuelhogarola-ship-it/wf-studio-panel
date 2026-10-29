# Web Fuengirola Umami Markets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a safe pathname-based market breakdown to the existing Web Fuengirola Umami dashboard without splitting its aggregate website property.

**Architecture:** The server maps a small allowlist of market keys to Umami universal path filters and applies the selected filter to every compatible analytics request. The existing shared panel exposes that allowlist only for the Web Fuengirola registry target and reloads the dashboard when the selection changes.

**Tech Stack:** Next.js 15, React 19, JavaScript modules, TypeScript, Node test runner, Umami v3 API.

**Spec:** `docs/superpowers/specs/2026-10-29-webfuengirola-umami-markets-design.md`

## Global Constraints

- Keep a single Umami website and preserve the unfiltered total.
- Never expose credentials, website IDs or registry keys to client payloads.
- Do not modify WF-Studio.
- Treat pathname, not visitor geolocation, as the market definition.

## Review Focus

- Exact market root paths and descendants must match, while similar prefixes such as `/mexico-city` must not.
- Spain/rest must exclude all three international route families simultaneously.
- Acquisition metrics and custom events must receive the same filter as summary stats.
- Unknown market keys and non-Web-Fuengirola projects must remain unfiltered.
- Real-time active visitors must not present a global number as market-specific.

---

### Task 1: Server-side market filters

**Files:**
- Modify: `src/lib/analytics/umami-dashboard.mjs`
- Modify: `src/lib/analytics/umami-dashboard-module.d.ts`
- Test: `tests/umami-dashboard.test.mjs`

**Interfaces:**
- Produces: `getAnalyticsMarketOptions(projectKey)` and market-aware `fetchUmamiDashboard({ market })`.

- [ ] Write failing tests for total, Mexico, USA, Brazil, and Spain/rest request parameters.
- [ ] Run the targeted test and confirm the new assertions fail for missing behavior.
- [ ] Implement the allowlist and apply filters to stats, pageviews, metrics, events and sessions.
- [ ] Run the targeted test and confirm it passes.

### Task 2: API and panel selection

**Files:**
- Modify: `src/app/api/analytics/[project]/route.ts`
- Modify: `src/components/analytics/project-analytics-panel.tsx`
- Modify: `src/components/admin/authorized-admin-analytics-panel.tsx`
- Modify: `src/components/admin/advanced-project-analytics-panel.tsx`
- Modify: `src/app/cliente/(protected)/proyectos/[slug]/estadisticas/page.tsx`
- Test: `tests/client-analytics-access.test.mjs`

**Interfaces:**
- Consumes: the server-side market allowlist and `market` fetch option from Task 1.
- Produces: an optional market selector whose value is sent as the validated API query.

- [ ] Write failing access/UI tests proving the registry key gates the selector and the API forwards only the selected market key.
- [ ] Run the targeted tests and confirm the expected failure.
- [ ] Add the market query plumbing and selector with aggregate total as default.
- [ ] Run targeted tests, then the full test, lint, typecheck and build commands.
