# WF Studio Project Workspaces and Direct Blogger Access

**Date:** 2026-10-20  
**Status:** Approved for implementation
**Primary repository:** `wf-studio-panel`  
**Related website repository:** `sportmassage`

## 1. Purpose

Make every managed website a first-class operational project in WF Studio. Samuel must be able to find every project, open its tools and inspect its configuration from one place. Clients must receive a professional but strictly limited portal that exposes only their own projects and contracted capabilities. A direct Blogger URL must lead to the correct editor instead of dropping the user on a generic panel.

This design extends the existing client portal platform. It does not create a second administration system, duplicate Blogger, or introduce separate credentials for each tool.

## 2. Product surfaces

WF Studio has three related surfaces backed by one identity and authorization model.

### 2.1 Administrator home

`/paneladmin/inicio` is Samuel's personal launcher. It contains:

- the existing product panels;
- a Favorites section containing only projects explicitly selected by the authenticated administrator;
- direct actions for each favorite project, including Blogger, statistics and the public website when configured;
- a clear route to the complete Projects catalog.

Favorites are a display preference. They never grant access, activate a capability or change what clients can see.

### 2.2 Project catalog and workspace

`/paneladmin/proyectos` is the canonical catalog of all managed projects, not only the projects chosen as favorites. The catalog supports search and existing filters and makes active capabilities visible without opening a configuration form.

Opening a project leads first to an operational workspace with:

- public website;
- Blogger;
- project statistics;
- associated client and client-access status;
- domains and hosting;
- invoices, reports and bonuses when enabled;
- warnings for incomplete configuration;
- a secondary Administration section containing the existing project and capability forms.

The primary interface answers “what can I do with this project?” Configuration remains available but is not the first experience.

### 2.3 Client portal and direct tools

The client portal remains separate from Studio administration. A client can see only:

- their portal home;
- projects assigned to their active client record;
- statistics for each project whose analytics capability is active;
- reports, bonuses, invoices and other client-level services that are active;
- Blogger for projects where Blogger is active and access has been granted.

Clients never see administrator navigation, project configuration, other clients, global Studio data or capability controls.

Each website can expose a stable direct Blogger URL such as `https://sportmassagefuengirola.com/admin/blogger/`. That URL uses the same Studio identity but returns the user to the exact Blogger editor after authentication. It does not send the user through the generic Studio home or project overview.

## 3. Recommended architecture

### 3.1 Canonical project model

`client_projects` remains the canonical database inventory. `src/config/sites.json` remains the technical registry for known domains, Blogger runtimes and analytics bindings.

Studio must reconcile the two sources explicitly:

- a registered site with no project record produces an administrator warning and a repair action;
- a project with no compatible site registry entry can still expose non-site capabilities but cannot launch Blogger or project analytics;
- no project is hard-coded into the Projects page or administrator home;
- Sport Massage, aGama and Samuel Coach must be discoverable through the same project query as future sites.

The reconciliation operation must be idempotent and preserve assignments, capability states and client access.

### 3.2 Administrator favorites

Add an administrator-scoped persistence model, `admin_project_favorites`, with:

- `admin_user_id`;
- `project_id`;
- optional `position` for stable ordering;
- `created_at`.

The composite identity is `(admin_user_id, project_id)`. Row-level security permits an administrator to read and edit only their own preferences. Removing a favorite deletes only the preference row.

The project catalog and project workspace expose “Añadir a Inicio” / “Quitar de Inicio”. The administrator home reads the favorite project IDs, then resolves current project and capability data server-side. Archived or inaccessible projects do not render even if a stale favorite row exists.

### 3.3 Capability-driven project tools

Create one shared server-side project-tool resolver used by:

- administrator favorites;
- project catalog cards;
- administrator project workspaces;
- client project navigation and overview.

For each project and viewer role, it returns serializable actions derived from validated capability state. It never copies secrets or untrusted metadata into the browser.

Rules:

- administrators can inspect every capability and launch a correctly configured active tool;
- clients receive actions only for active capabilities on active, client-visible projects assigned to them;
- Blogger launches through an internal authorized route, not by exposing a raw configuration URL;
- analytics always resolves by project key/domain and never falls back to another project's site ID;
- client-level invoices, reports and bonuses remain scoped to the client even when linked from a project workspace.

### 3.4 Statistics per project

Every project may have its own analytics capability and Umami binding. When active and valid:

- administrators see statistics in the project workspace;
- authorized clients see statistics in their project area;
- favorite cards show a statistics shortcut when analytics is active but do not fetch full metrics on the home screen;
- missing or invalid analytics configuration is shown to administrators as a warning and hidden from clients.

No project may inherit the Umami website ID, domain or metrics of another project.

### 3.5 Direct Blogger entry

Add this dedicated Studio route for direct Blogger access:

`/acceso/blogger/[siteKey]`

Behavior:

1. Resolve the exact registered site and project.
2. If there is no session, show the client authentication screen while retaining the validated internal destination.
3. Password login and magic-link login both return to the requested Blogger route.
4. Authorize the user against the project and active Blogger capability.
5. Render the existing editor in a minimal tool shell.

The minimal shell contains the website identity, a Home link and the Blogger editor. It never displays administrator navigation. An administrator using the same URL may access the editor but remains subject to the same exact site resolution.

Direct access does not require a second Blogger user or password. Sofia uses her existing Studio identity. Password recovery remains the supported way to establish a known password when the account already exists.

The Sport Massage static `/admin/blogger/` entry will redirect to this dedicated route instead of the generic client-project route.

### 3.6 Authentication destination continuity

All authentication methods must preserve a validated internal destination:

- middleware records the original protected route;
- the login page passes it to password and magic-link actions;
- the OAuth/magic callback carries it as `next`;
- authenticated entry pages honor it;
- `sanitizeInternalRedirect` restricts destinations to approved Studio paths and rejects external, protocol-relative or malformed URLs.

The default client destination remains the client home when no valid destination exists.

## 4. Navigation and interface

### 4.1 Administrator home

Add a Favorites section above or alongside the existing product panels. Each favorite card shows:

- project name and domain;
- client name when assigned;
- lifecycle and client-access status;
- validated shortcuts for Blogger, statistics and public website;
- a primary “Abrir proyecto” action.

Samuel Coach's existing home card gains a direct Blogger shortcut. Its specialized academy panel remains unchanged.

### 4.2 Project catalog

Each card shows capability badges and high-value actions. The complete catalog includes all current projects regardless of favorite state. Filtering by Blogger or analytics uses capability data already loaded for the catalog.

### 4.3 Project workspace

Order the page as follows:

1. project identity and favorite toggle;
2. operational tool cards;
3. client-access summary and portal preview;
4. warnings;
5. collapsible or visually secondary configuration forms;
6. audit history.

An active Blogger card opens `/paneladmin/blogger/[siteKey]`. An active analytics card opens the project analytics view. Actions that are merely available, unavailable or misconfigured are clearly labelled and do not pretend to launch.

The existing aGama client model for reports, bonuses and related account services is preserved. This work does not replace or redesign those flows; it adds project-specific statistics and exposes the already working services from the unified workspace.

### 4.4 Client home

The client home summarizes account-level items and assigned projects. Each project card shows only permitted actions. Statistics are always identified by project. Reports, bonuses and invoices remain easy to find without exposing Studio administration.

If the client follows a direct Blogger link, the editor opens immediately after authentication; the client can return to their home but is never redirected through Samuel's administrator launcher.

## 5. Authorization and security

- `requireAdmin` protects administrator favorites, catalog, project workspaces and configuration.
- Client project access requires an active auth identity, active client record, project assignment, active project, `client_access_enabled` and the relevant active capability.
- Blogger API authorization continues to enforce the same project ownership and capability checks independently of page navigation.
- Analytics API requests enforce the same project assignment rather than trusting a site key supplied by the browser.
- Raw capability metadata, repository tokens, analytics credentials and launch secrets are never serialized to pages.
- Favorites are not an authorization boundary.
- Direct-login destinations are sanitized before use and after callback.

## 6. Data migration and repair

1. Add `admin_project_favorites` and its row-level security.
2. Reconcile the known site registry with `client_projects` without overwriting existing assignments or states.
3. Verify that Sport Massage, aGama and Samuel Coach have project records and the intended Blogger/analytics capability rows.
4. Preserve aGama's existing reports, bonuses and client-service configuration; activate only its correctly bound project analytics where that capability is missing.
5. Preserve Sofia's current account, Sport Massage assignment and active Blogger entitlement.
6. Backfill no favorites automatically; Samuel chooses them from the catalog.
7. Change the Sport Massage static entry only after the dedicated Studio route is deployed.

## 7. Error handling

- Missing project records produce an administrator repair warning, not a silent omission.
- Broken Blogger or analytics configuration keeps the project visible but disables only the affected action.
- Failed direct authentication returns to the dedicated login with a useful message and retained safe destination.
- A client without the required capability receives a controlled not-found/forbidden response and no project metadata.
- A failed external tool does not break the rest of the project workspace or client portal.

## 8. Testing and acceptance criteria

### Administrator experience

- The Projects catalog lists Sport Massage, aGama, Samuel Coach and every other active project returned by the database.
- Favorite selection persists per administrator and affects only the administrator home.
- Favorite cards and project workspaces expose only validated actions.
- Samuel Coach has a direct Blogger shortcut on the administrator home.
- The project workspace presents operational tools before technical configuration.
- aGama retains its existing reports and bonuses while gaining correctly scoped project statistics.

### Client experience

- A client sees only assigned projects.
- Each active analytics capability exposes statistics for exactly that project.
- Reports, bonuses and invoices remain client-scoped.
- Blogger appears only when active and authorized.
- No client route renders administrator navigation or configuration.

### Direct Blogger access

- An authenticated Sofia entering Sport Massage `/admin/blogger/` reaches her editor directly.
- An unauthenticated Sofia can use password or magic link and returns directly to the editor.
- External or malformed return destinations are rejected.
- A client for another project cannot access Sport Massage Blogger by guessing the URL.
- An administrator can open the same editor from the project workspace.

### Statistics

- Administrator and client views resolve the same project's Umami binding.
- Missing analytics configuration is visible as an administrator warning and hidden from clients.
- Metrics from one project never appear in another project's view.

### Regression

- Existing Samuel Coach, aGama and Sport Massage Blogger API authorization remains intact.
- Existing invoices, reports, bonuses, packs and messaging continue to pass their test suites.
- Authentication callback, redirect-sanitization, RLS, lint, type checking and production build all pass.
- The Sport Massage public blog and Umami tracker remain available throughout rollout.

## 9. Rollout order

1. Add favorite persistence and shared project-tool resolution.
2. Build administrator Favorites, enhanced catalog and operational project workspace.
3. Add client project statistics and verify account-level reports/bonuses/invoices.
4. Add destination-preserving authentication and the dedicated Blogger route.
5. Add the Samuel Coach home shortcut.
6. Reconcile production project data and validate Sport Massage/aGama visibility.
7. Deploy Studio and run administrator/client end-to-end tests.
8. Update Sport Massage `/admin/blogger/` to the dedicated route and verify the public entry.

## 10. Non-goals

- Replacing Supabase authentication.
- Creating separate Blogger passwords or duplicating client accounts.
- Giving clients access to Studio administration.
- Replacing Umami, invoicing, report or bonus data sources.
- Automatically favoriting every new project.
- Activating Blogger or analytics merely because a project exists.
