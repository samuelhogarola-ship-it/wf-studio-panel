# WF-Studio Panel Recovery Snapshot

This snapshot identifies the production-ready state of `wf-studio-panel` used for the Coolify deployment on 2026-08-05.

## Restore point

- Branch: `agent/recovery-wf-studio-panel-2026-08-05`
- Base state: `main`
- Latest functional commit before this snapshot: `36a4f53`
- Production deploy commit: `7237ce4`

## Included changes

- `e9902e0`: rollback to the stable panel baseline.
- `7bfecdb`: rebuild marketplace launcher updates.
- `9ec63ee`: stabilize admin login environment handling.
- `8f75506`: add safe Supabase auth diagnostics.
- `fa011ee`: use the standalone Docker runtime.
- `77bf6f0`: make external user panels resilient when integrations are unavailable.
- `7237ce4`: add the explicit pack transition email and fix optional pack form fields.
- `36a4f53`: rename the visible Hours navigation label to Bonuses.

## Coolify recovery

Deploy this branch or the corresponding commit from `main`. The application domain must point only to `wf-studio-panel`; the legacy panel must have no domain. If the domain serves an older build after deployment, restart the Coolify proxy to regenerate its routes.

## Validation

- `npm run typecheck`
- `npm run build`
- Admin login and production panel smoke test.
- Creation of the Agama 10-hour `Marketing y Google` bonus.
- Pack transition email accepted by the application.
