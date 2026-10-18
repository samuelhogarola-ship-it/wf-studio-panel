# WF Studio Client Portal Platform

**Date:** 2026-10-17  
**Status:** Proposed  
**Primary repository:** `wf-studio-panel`

## 1. Purpose

Turn the existing WF Studio client area into a professional, repeatable portal that can be offered to every client without rebuilding navigation or access rules for each new website.

The platform must preserve the tools and data that already work while making them discoverable through a consistent client experience. It must also support a per-site Blogger and restore the valuable legacy Samuel Coach articles so that their established search intent can be served again.

## 2. Product model

WF Studio has two related surfaces:

- **Studio administration:** Samuel manages every client, project, service, entitlement and invitation.
- **Client Portal:** each client sees only their projects, contracted services and activated tools.

A client may own one or more website projects. A project may be managed internally before the client receives portal access. Client access is optional and can be enabled later without changing code.

The first supported portal capabilities are limited to functions that already exist or have an existing destination:

- products/services;
- domains;
- hosting;
- invoices;
- hour packs and reports;
- Blogger;
- statistics.

No domain registrar, hosting control plane, accounting system or new content editor will be built as part of this phase. Studio aggregates the existing data and launches the existing tools.

## 3. Current state and constraints

- Client records, authentication, invoices, packs, activities, services, reports and client-scoped row-level security already exist.
- The client navigation is currently static and exposes the same sections to every account.
- Project analytics already use the shared Umami infrastructure and a site registry.
- Samuel Coach already exposes an online protected administration hub with `/admin/`, `/admin/blogger/` and `/admin/informes/`.
- Existing client data and direct tool URLs must continue to work during migration.
- Existing local changes in website repositories must not be overwritten.

## 4. Recommended architecture

### 4.1 Project registry

Add `client_projects` as the canonical inventory of websites managed through Studio.

Required fields:

- `id`;
- `client_id`, nullable until a project is assigned;
- stable `slug`;
- display `name`;
- canonical `domain`;
- lifecycle state: `draft`, `active`, `archived`;
- client access flag;
- optional hosting label and management URL;
- optional analytics registry key;
- timestamps.

Every newly created website is registered in Studio immediately, even if it has no client account or client-facing tools yet.

### 4.2 Project capabilities

Add `project_capabilities` with one row per project and capability. Supported keys are:

- `products`;
- `domains`;
- `hosting`;
- `invoices`;
- `bonuses_reports`;
- `blogger`;
- `analytics`.

Each capability has one of three states:

- `unavailable`: the project does not support it;
- `available`: Studio can provision or enable it, but the client cannot use it;
- `active`: the capability is visible and usable in the Client Portal.

A capability may include a protected launch URL and non-secret display metadata. Secrets and signing keys must never be stored in browser-readable metadata.

Invoices and packs remain client-owned records. Their capability rows control presentation; existing tables remain their source of truth.

### 4.3 Automatic registration

Provide an authenticated project-registration endpoint for the website creation workflow. Registration must be idempotent by project slug or canonical domain.

Creating a website results in:

1. a Studio project record;
2. known capabilities recorded as `available` or `unavailable`;
3. no automatic client invitation;
4. no public empty blog;
5. no Blogger access until blog provisioning succeeds.

Studio also keeps a manual “Register project” action for existing sites and recovery when an automated registration fails.

## 5. Blogger lifecycle

Blogger is project-specific. Each website with a blog has its own editor and content collection.

The Blogger states mean:

- `unavailable`: the website is not blog-ready;
- `available`: blog support exists or can be provisioned, but no client editor is active;
- `active`: the public blog and protected editor are connected and client access is allowed.

New website templates should be blog-ready without publishing an empty `/blog/`. Activating Blogger provisions or connects:

- the public blog index;
- article routes;
- images;
- categories and tags;
- metadata and canonical URLs;
- sitemap entries;
- the protected editor.

Deactivating client access must not unpublish existing articles. It only removes editing access from the Client Portal.

Initial intended states:

- Samuel Coach: active;
- Agama: active;
- Web Fuengirola: active, connected to its existing blog and Blog Creator configuration;
- Viking: connect or provision, then active;
- Sportmassage: available until its blog is created, then active;
- projects without blogs: unavailable or available, never active by default.

## 6. Authentication and authorization

Studio remains the identity authority for portal access.

- Administrators can read and manage every client, project and capability.
- Clients can only read projects assigned to their authenticated client record.
- Clients can only launch capabilities marked `active`.
- Direct Blogger URLs remain supported for users who already use them.
- Launching Blogger from Studio should not require a second login.

Cross-domain single sign-on must use a short-lived, single-use server-to-server handoff. Studio generates a signed launch token containing the user, client, project, capability, expiry and nonce. The target website validates and consumes it, establishes its own secure session, and redirects to the tool. Tokens must not contain reusable credentials, must expire within minutes and must be rejected after use.

If a target tool has not yet implemented the handoff, Studio displays the protected direct link and clearly marks that a separate sign-in may be required. This fallback cannot grant broader access.

Supabase row-level security must protect the new project and capability tables. UI filtering is never the authorization boundary.

## 7. Studio administration experience

### 7.1 Project inventory

Studio gains a Projects area with:

- search and filters by client, status and capability;
- project name, domain, client, hosting and portal state;
- clear warnings for missing analytics IDs, broken launch URLs or incomplete provisioning;
- “Register project” and “Invite client” actions.

### 7.2 Project detail

The project detail groups existing functions rather than duplicating them:

- overview;
- products/services;
- domain;
- hosting;
- invoices;
- bonuses/reports;
- Blogger;
- statistics;
- client access.

Each capability card shows its state, destination, last validation and available action. Changing a state is explicit and audited.

### 7.3 Invitations

The administrator can assign a project to an existing client or create/invite a new client. The invitation screen previews exactly which projects and navigation items the client will receive.

Not accepting an invitation does not affect Studio management or the public website.

## 8. Client Portal experience

The Client Portal uses the existing authenticated client area but replaces static navigation with server-derived navigation.

- A client with one project enters directly into its overview.
- A client with multiple projects gets a project selector.
- Client-level pages such as invoices and packs aggregate safely across that client's projects.
- Project-level pages such as Blogger and statistics always identify the selected website.
- Sections without an active capability are absent, not disabled clutter.
- Desktop and mobile navigation expose the same capabilities.

The overview presents concise service status, pending actions, renewals, invoice alerts, active hour packs and quick access to project tools. It should feel as clear and dependable as a mainstream hosting dashboard without copying its visual identity or adding unsupported controls.

## 9. Basic Blogger experience

The existing Blogger remains the editor. Studio supplies context and secure access; it does not fork a second editor.

The baseline editing experience is intentionally simple:

- list, search and filter posts;
- create and edit;
- draft, publish and unpublish;
- title, body, excerpt, date and featured image;
- categories and tags;
- article slug;
- SEO title and description;
- preview;
- validation that prevents malformed or duplicate public URLs.

Clients must not receive filesystem, deployment or site-wide configuration access.

## 10. Samuel Coach content recovery

Restoring the editor alone does not restore search visibility. Samuel Coach requires a content and URL recovery pass.

For every recoverable historical article:

1. inventory the old URL, title, publication date, content, images and metadata;
2. restore the original URL whenever safe;
3. otherwise add a permanent one-to-one redirect to the chosen canonical URL;
4. preserve meaningful publication dates and authorship;
5. restore internal links and referenced media;
6. prevent duplicate or thin variants from being indexed;
7. include canonical articles in the blog index and XML sitemap;
8. verify HTTP status, canonical, title, description and structured data;
9. submit the resulting sitemap through the established search workflow.

No claim of immediate ranking recovery should be made. The implementation restores crawlability, URL continuity and content quality signals; search engines decide ranking and timing.

## 11. Existing-site migration

Migration is additive and must not break current access.

1. Create project and capability tables with RLS.
2. Backfill project records from known Studio/Umami registries and existing client services.
3. Map Ángel's existing domains, reports and services without changing their source records.
4. Register Samuel Coach, Agama, Web Fuengirola, Viking and Sportmassage Blogger states.
5. Keep current static client navigation as a temporary fallback until a client's capability set is complete.
6. Enable dynamic navigation for internal/admin testing.
7. Enable selected clients one at a time.
8. Remove the fallback only after all active clients are mapped.

Backfills must be idempotent and safe to rerun.

## 12. Reliability and error handling

- Missing capability configuration hides the client action and creates an administrator warning.
- A broken external tool must not break the rest of the Client Portal.
- Tool launch failures return the user to the project page with a useful recovery message.
- Registration and provisioning endpoints are idempotent and authenticated.
- All capability state changes are timestamped and attributable to an administrator.
- URLs are allowlisted to known HTTPS project domains; localhost and arbitrary external destinations are rejected in production.
- Archived projects remain available to administrators but are removed from normal client navigation.

## 13. Testing and acceptance criteria

### Authorization

- A client cannot query or launch another client's project or capability.
- An inactive capability is inaccessible even when its route is guessed.
- Administrators retain access to all projects.
- Expired, reused, altered or wrong-project launch tokens are rejected.

### Registration and configuration

- Automated registration is idempotent.
- A new project does not expose Blogger by default.
- Activating Blogger only succeeds after a valid editor destination is present.
- Existing clients retain invoices, packs, reports and services after migration.

### Interface

- Navigation exactly matches active capabilities.
- Single-project and multi-project accounts follow their intended entry flows.
- Desktop and mobile expose equivalent actions.
- Missing analytics or tool configuration is visible to administrators, not leaked as a client error trace.

### SEO recovery

- Restored Samuel Coach URLs return `200`, or their old URLs return one permanent redirect to a `200` canonical page.
- Canonicals are self-consistent and indexable posts appear in the sitemap.
- No historical article is silently dropped from the migration inventory.

### Regression

- Existing authentication, invoices, packs, reports, messaging and admin panels continue passing their current test suites.
- Production build, lint and type checking pass before rollout.

## 14. Rollout

The rollout is phased to reduce risk:

1. data model, RLS and read-only project inventory;
2. administrator capability management and registration endpoint;
3. dynamic Client Portal navigation and project selector;
4. statistics and existing service integrations;
5. secure Blogger launch for Samuel Coach, Agama and Web Fuengirola;
6. Samuel Coach content/URL recovery;
7. Viking and Sportmassage Blogger onboarding;
8. selected-client pilot, beginning with an existing cooperative client;
9. general availability for future clients.

Each phase must be deployable without requiring later phases to keep existing client access operational.

## 15. Out of scope

- Building a new hosting control plane;
- becoming a domain registrar;
- replacing invoicing or Umami;
- replacing each site's existing Blogger implementation;
- automatically publishing empty blogs;
- adding ecommerce or unrelated website-builder features;
- promising a specific Google ranking or recovery date.
