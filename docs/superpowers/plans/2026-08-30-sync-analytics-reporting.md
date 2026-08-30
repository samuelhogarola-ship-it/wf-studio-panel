# Sync Analytics And Monthly Reporting Implementation Plan

> **For Codex:** Follow the test-driven steps below and do not merge until every verification gate is green.

**Goal:** Bring the already-validated dual-Umami dashboards and durable monthly reports into the standalone `wf-studio-panel` repository that Coolify actually deploys, while preserving its deployment-specific configuration and later features.

**Architecture:** Keep the standalone repository as the deployable application. Import only the shared Umami core/UI and report persistence modules from monorepo commit `7072bcd`, wire them into the seven existing operational pages, and retain legacy analytics routes temporarily for compatibility. Supabase stores one report per month and RPC claims make email delivery idempotent.

**Tech Stack:** Next.js 15, React 19, TypeScript, Supabase, Umami v3, Resend, Node test runner, Coolify/Docker.

---

### Task 1: Lock the expected behavior with failing tests

- Import the validated Umami core, panel UI, and monthly-report tests.
- Add assertions for the exact TodoPlástico client and administrator URLs.
- Run the focused tests and confirm they fail for missing shared modules or old wiring.

### Task 2: Add the shared dual-Umami implementation

- Import the Umami core, view model, dashboard data adapter, skeleton, section, and client panel.
- Replace only the analytics block in the seven operational pages.
- Preserve each page's existing operational features and legacy analytics API.

### Task 3: Correct TodoPlástico navigation

- Use `https://todo-plastico.com/panel` as the exact client-panel destination.
- Use `https://todo-plastico.com/ingresar?next=/admin` as the exact administrator destination.
- Stop deriving either link by appending paths to an unrelated domain.

### Task 4: Add durable monthly reports

- Import the monthly report repository, route, cron logic, types, and August migration.
- Adapt the reports page without replacing existing standalone-only functionality.
- Preserve the existing email and Supabase client implementations where already equivalent.

### Task 5: Merge configuration and operations documentation

- Add the two Umami connections, 14 website IDs, report recipient, and cron secret names to `.env.example` without secrets.
- Keep documented legacy aliases during the transition.
- Document migration order, cron invocation, idempotency, and recovery.

### Task 6: Verify, review, and integrate

- Run focused tests, full tests, lint, typecheck, production build, and Docker build.
- Confirm Dockerfile, standalone Next config, CI workflow, and dependency pins remain intact.
- Push the dedicated branch, open a PR, wait for green CI, then squash-merge.
- Verify the deployed endpoint and the seven authenticated analytics panels.
