# WF Studio consolidation release — October 2026

This release is prepared on `codex/wf-studio-consolidation`. It contains the Blogger hardening, audited read-only support preview, project capabilities and analytics, payments/invoices, accessible shells, canonical site manifest, server-domain compatibility modules and bounded project reads.

## Release order

1. Run CI on the consolidation branch and confirm `npm ci`, lint, typecheck, tests, the production audit, `npm run test:db` and the build are green.
2. Apply Supabase migrations in filename order. The consolidation migrations are:
   - `202610240001_message_and_resource_rls.sql`
   - `202610240002_payments_and_invoices.sql`
3. Deploy the application revision with the required environment names configured. Never copy values into Git or this document.
4. Run the smoke checks below before enabling support preview or accepting client payment links.

## Required configuration names

Core runtime: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_APP_URL`.

Email and scheduled work: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_TO_EMAIL` or `STAT_REPORT_EMAIL_TO`, `CRON_SECRET`, `PENDING_REMINDERS_CRON_SECRET`, `MONTHLY_STAT_REPORTS_CRON_SECRET`.

Analytics: `UMAMI_PERSONAL_URL`, `UMAMI_PERSONAL_USERNAME`, `UMAMI_PERSONAL_PASSWORD`, `UMAMI_AGAMA_URL`, `UMAMI_AGAMA_USERNAME`, `UMAMI_AGAMA_PASSWORD`, and the per-site `UMAMI_WEBSITE_ID_*` values documented in `.env.example`. Legacy `STAT_REPORT_UMAMI_*` names remain fallback-only during migration.

Blogger and optional integrations: `BLOGGER_SITE_ROOTS_JSON`, the site-specific `BLOGGER_BUILD_HOOK_*` and `BLOGGER_BUILD_SECRET_*` pairs, `BLOGGER_GITHUB_TOKEN`/repository settings where used, `DEEPL_AUTH_KEY`, `WF_BLOGGER_HANDOFF_SECRET_SPORTMASSAGEFUENGIROLA`, and `WF_SUPPORT_PREVIEW_ENABLED` (keep `false` until the support smoke checks pass).

Payments use administrator-supplied HTTPS Stripe links; this release does not require Stripe API or webhook secrets.

## Smoke checks

Use a deployed preview with production-equivalent schema and masked test accounts.

- Admin: `/paneladmin/inicio`, `/paneladmin/proyectos`, `/paneladmin/pagos`, `/paneladmin/facturas`, `/paneladmin/samuel-coach/premium`.
- Client: `/cliente/dashboard`, `/cliente/proyectos`, `/cliente/pagos`, `/cliente/facturas`.
- Security: unauthorized cron requests, cross-client resource/message access, support-preview mutation attempts, invalid Stripe URLs and invoice status transitions must fail closed.
- Browser: 320px layout, keyboard focus order, skip links, mobile navigation, loading/error/not-found states and the payment/invoice forms.
- Integrations: configured Blogger launch, analytics for personal and Agama sources, and a protected invoice print route.

Record the revision, migration result, smoke-test timestamp and any intentionally unavailable integration in the deployment system; do not record credentials or customer data here.

## Rollback

Application-only failures: redeploy the previous known-good application revision while keeping migrations applied. The application is designed to tolerate the new tables and policies being present.

Migration failures: stop deployment, preserve the database error and inspect the failed migration in Supabase before retrying. Do not edit an already-applied migration or run destructive rollback SQL without an approved database recovery plan. Restore from the database backup only after confirming the affected migration and its dependent application revision.

Payment or support-preview issues: disable `WF_SUPPORT_PREVIEW_ENABLED` or remove the affected payment capability from the server configuration, then redeploy the last known-good application revision. Preserve audit rows; do not delete invoices, payment links or support-session history as a rollback shortcut.

## Verification evidence

At the time this document was written, the local gate passed: `npm test` (523 passing, 2 conditional PostgreSQL skips), lint, non-incremental typecheck, production build and `npm audit --omit=dev` (`found 0 vulnerabilities`). The PostgreSQL skips require the CI `npm run test:db` job or an equivalent configured support database before merge.
