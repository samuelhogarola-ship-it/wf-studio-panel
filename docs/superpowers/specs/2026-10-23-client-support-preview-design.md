# Client Support Preview — Design

## Purpose

WF Studio administrators need to verify exactly what a client can see without asking for, learning, resetting or reusing the client's password. The current project workspace renders a list called `Vista previa`, but its links point to `/cliente/*`. Those routes accept only a real client identity, so an administrator is redirected back to the admin panel instead of seeing the client experience.

The new support preview provides a temporary, audited and read-only client context while preserving the administrator's real Supabase session. It is a platform capability for every client, with Sport Massage Fuengirola as the first acceptance client.

## Success criteria

1. An administrator can start support preview from an assigned project or client record without knowing the client's credentials.
2. The preview uses the real `/cliente/*` pages, navigation, project assignments, capabilities and data visible to the selected client.
3. Every preview page displays a persistent, unmistakable banner naming the selected client and stating that the session is read-only.
4. Navigation, details, statistics, reports, invoices, bonuses, messages, project pages and supported external tools can be opened.
5. No preview request can create, update, delete, publish, upload, mark as read, pay, request or otherwise mutate client or project data.
6. Starting, ending and expiring support preview records both the administrator and target client in an auditable session.
7. The administrator can leave preview with one action and returns to the admin record from which preview started.
8. Preview expires after 30 minutes, fails closed if the client becomes inactive and immediately removes any project whose assignment or client access changes.
9. Sport Massage can be inspected end to end, including its project, statistics and a read-only Blogger launch, once its client assignment and capabilities are active.
10. Existing client and administrator authentication continues to work unchanged outside support preview.

## Non-goals

- Logging in as the client or changing the authenticated Supabase user.
- Revealing, resetting, storing or sharing a client's password.
- Allowing an administrator to perform client actions while previewing.
- Making admin-only configuration visible inside the client shell.
- Treating a UI-disabled button as sufficient authorization.
- Enabling a project, capability or external tool that has not been provisioned.

## Chosen model

Support preview is an explicit third viewing context, not impersonation:

- **Administrator:** the authenticated user and authority remain the administrator.
- **Selected client:** determines which portal data and navigation are rendered.
- **Support mode:** makes all client-side and server-side mutations unavailable.

The application never changes `profiles.role`, never creates a client login session and never places a client identifier in an unsigned query parameter. A normal client session cannot activate support mode.

## Entry points and user experience

### Starting preview

The administrator sees `Ver como cliente` in:

- `/paneladmin/clientes/[id]` for an active client;
- `/paneladmin/proyectos/[id]` when the project is assigned to an active client and client access is enabled.

The action names the target, for example `Ver como Sofía`. Starting it requires the current administrator session, validates the target server-side, creates one support session and redirects to `/cliente/dashboard`.

If Sport Massage has no active client assignment, has `client_access_enabled=false`, or its project is inactive, the control stays unavailable and explains the exact missing setup rather than creating a partial preview.

### Preview shell

The real `ClientShell` renders the selected client's portal. A high-contrast banner appears on desktop and mobile above all content:

> Modo soporte · Viendo como Sofía · Solo lectura

The banner includes:

- the selected client's name;
- the remaining session time;
- a `Volver al panel administrador` action;
- an accessible explanation that no changes will be saved.

The client email may remain visible in the same places where the real client sees it. The administrator's email is not substituted for the client's identity in the client UI.

### Read-only interaction

Read-only means functional inspection, not a static screenshot:

- all permitted navigation works;
- lists and details open with real current data;
- date ranges, filters, project switching and analytics exploration work;
- report and invoice documents can be opened or downloaded when the client can do so;
- forms and dialogs may be opened to inspect their content;
- every control that would mutate data is disabled and carries `No disponible en modo soporte`.

The server remains authoritative. Forging a form submission, calling an action directly or replaying an API request in support mode returns a read-only error and performs no write.

## Support session architecture

### Database record

A new `admin_support_sessions` table stores:

- `id uuid primary key`;
- `admin_user_id uuid not null`;
- `client_id uuid not null`;
- `token_hash text not null unique`;
- `return_path text not null` restricted to approved `/paneladmin/*` destinations;
- `started_at timestamptz not null`;
- `expires_at timestamptz not null` with a maximum of 30 minutes;
- `ended_at timestamptz null`;
- `end_reason text null` limited to `manual`, `expired`, `replaced`, `client_inactive` or `access_revoked`.

Only administrators can create, read or end their own support sessions. Clients receive no access to this table. A partial unique index permits at most one row with `ended_at is null` per administrator. Before inserting a session, the start transaction closes any expired unfinished row and then ends any remaining active row as `replaced`.

### Cookie

The browser receives an opaque, cryptographically random token in a cookie named `__Host-wf_support_preview` with:

- `Secure`;
- `HttpOnly`;
- `SameSite=Lax`;
- `Path=/`;
- an absolute `Max-Age` no longer than 30 minutes.

Only the SHA-256 hash of the token is stored in the database. The token, client ID and administrator ID are never written to URLs, browser storage or logs.

### Resolution

A single server function resolves the portal viewer for every client route:

1. Read the real authenticated identity.
2. If the identity is a client, use the existing client lookup and ignore any support cookie.
3. If the identity is an administrator, require a valid, unexpired support cookie belonging to that administrator.
4. Load the selected active client and its currently visible projects.
5. Return a discriminated context:

```ts
type PortalViewer =
  | { mode: 'client'; identity: ClientIdentity; client: Client }
  | { mode: 'support'; identity: AdminIdentity; client: Client; supportSessionId: string; expiresAt: string }
```

An administrator visiting `/cliente/*` without a valid support session continues to redirect to `/paneladmin/inicio`. An invalid or expired support session clears the cookie and returns the administrator to the saved admin path with an explanatory status.

## Data access and isolation

The administrator remains subject to existing admin RLS policies. Support-mode reads must additionally apply the resolved `client.id` to every client-owned query. No client ID supplied by the browser is accepted.

The existing request-cached portal loader is extended to cache the resolved `PortalViewer` and its authorized projects. Project lookup remains limited to:

- `project.client_id = selected client`;
- `project.status = active`;
- `project.client_access_enabled = true`;
- active, correctly configured capabilities only.

The implementation does not use the Supabase service role for preview reads. This keeps ordinary admin/client RLS behavior observable during support.

## Mutation boundary

A shared `requireClientMutationAccess()` guard becomes mandatory for every client mutation. It returns the real client context and rejects `mode='support'` before any write or external side effect.

The guard covers at least:

- sending messages;
- marking messages as read;
- requesting services;
- pending-item updates;
- payment or invoice actions;
- uploads;
- Blogger save, publish, archive and media operations;
- any future server action or route under the client product surface.

Read paths must also be checked for hidden side effects. The current messaging page marks inbound messages as read while rendering; support preview must skip that update so opening the page does not change the client's unread state.

Client components receive `readOnly=true` from the server-rendered support context. This disables submission controls and explains why, but it is only presentation-level defence. The server guard is the security boundary.

## External tools and Blogger

### General rule

An external capability can launch from support preview only if its target runtime declares a verified read-only support scope. If it does not, WF Studio shows the tool's availability and configuration state but does not launch it. The system fails closed rather than opening an editor with write permission.

### Blogger handoff

The exact-key `wf-blogger-handoff/v1` contract remains unchanged for existing edit launches. A new `wf-blogger-handoff/v2` contract adds an explicit scope:

- normal administrator/client launch can continue using v1 with edit scope during migration;
- v2 normal administrator/client launch uses `blogger`;
- v2 support preview launch uses `support_readonly`.

WF Studio binds the single-use ticket to administrator, selected client, exact project, site key, audience and scope. The destination creates a local session containing that scope.

For Sport Massage:

- list, search, open, preview and inspect post/category/media metadata are permitted;
- create, update, delete, upload, build, publish and unpublish endpoints reject `support_readonly`;
- the editor keeps controls visible where useful, but disables mutation with the support explanation;
- the page displays the same support/read-only banner and provides a return link to WF Studio;
- direct `sportsmassage` credentials and ordinary Studio launch keep their existing edit scope.

This is a cross-repository contract change. WF Studio must not send a v2 support ticket until the Sport Massage health/discovery response advertises protocol `wf-blogger-handoff/v2` and scope `support_readonly`. A destination that advertises only v1 remains available for normal editing but unavailable from support preview.

## Statistics and documents

Statistics are naturally read-only and remain fully interactive. The existing project authorization resolves the selected client's exact project ID and canonical analytics registry key. Operational Umami credentials and upstream diagnostics remain server-only.

Reports, invoices and resources use the same selected-client filter as the real portal. Viewing or downloading a document is allowed. A route that changes payment, delivery, acknowledgement or read state must call the mutation guard and is disabled in support mode.

## Audit and privacy

The support-session record is the primary audit trail. It records who opened which client and when the session ended, without recording passwords, cookies, document contents or analytics payloads.

External tool launches add an audit event with support session ID, project, capability and read-only scope. Normal page navigation is not logged individually to avoid unnecessary behavioral tracking and write traffic.

The admin client detail shows the current administrator's recent support sessions for that client. The administrator can end their current preview immediately. Expired sessions are treated as ended even if asynchronous cleanup has not yet filled `ended_at`.

## Error handling

- Inactive or unknown client: do not start preview.
- Unassigned or inaccessible project: show the client portal without that project; never preserve stale access.
- Expired/revoked support session: clear cookie and return to the approved admin path.
- Missing read-only external scope: show `Vista de soporte no disponible para esta herramienta`.
- Mutation attempt: return a typed read-only error without partial writes.
- External launch or health failure: keep the user in WF Studio and show a safe retry path.

No error response contains tokens, direct credentials, environment names or upstream secrets.

## Testing

### WF Studio

- Only administrators can start support preview.
- A session can target only an active WF Studio client.
- Cookie is opaque, secure and bound to the creating administrator.
- A client cannot activate or switch support context.
- Preview resolves only the selected client's active visible projects.
- Admin without preview remains blocked from `/cliente/*`.
- Banner and exit action render on desktop and mobile.
- Every portal route renders with support context.
- Mutation actions and direct API calls fail before writing.
- Opening messages does not mark them as read.
- Statistics, documents and filters remain usable.
- Expiry, manual exit, replacement, client deactivation and access revocation fail closed.
- Blogger handoff includes `support_readonly` only for a valid support session and verified destination.

### Sport Massage

- A support ticket creates only a `support_readonly` session.
- Read/list/preview operations work.
- Every mutation endpoint rejects the support session.
- UI mutation controls are disabled on mobile and desktop.
- Direct login and normal Studio launch still edit normally.
- Logout and session expiry revoke support access.

### End-to-end acceptance

1. Open Sport Massage from its assigned project as administrator.
2. Start `Ver como Sofía` without using Sofia's password.
3. Navigate through Inicio, Webs, Estadísticas, Informes, Bonos and Mensajería.
4. Confirm messages retain their unread state.
5. Open Blogger in support mode and inspect existing content.
6. Confirm save, publish, delete and upload are impossible in both UI and API.
7. Exit to the original Sport Massage admin project page.
8. Confirm the support session appears in the audit trail.

## Rollout

1. Add the support-session schema, RLS policies and typed context behind a disabled feature flag.
2. Convert portal reads to the unified viewer context and centralize mutation guards.
3. Add admin entry/exit UX and the persistent banner.
4. Add the scoped Blogger contract in WF Studio and Sport Massage.
5. Verify Sport Massage has an active Sofia client record, assignment, enabled client access and active analytics/Blogger capabilities.
6. Run the full Sport Massage acceptance flow in production.
7. Enable support preview for other clients without changing their credentials or portal modes.

The feature remains disabled globally if any client mutation can bypass the shared guard or if Sport Massage cannot prove read-only Blogger enforcement.
