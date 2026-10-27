# Sport Massage Branded Blogger Design

## Intent

Expose the existing central WF-Studio Blogger through `https://blogger.sportmassagefuengirola.com` so Sport Massage sees its own branded entry point without creating a second application, database, editor, or deployment.

## Goals

- The custom-domain root opens only the Sport Massage Blogger login or editor.
- Direct access keeps the existing independent Blogger credential.
- The client-panel button continues to use a short-lived, single-use launch ticket and lands on the custom domain without requiring a second login.
- The handoff URL is immediately replaced by a clean root URL after the ticket is consumed.
- Logout clears the custom-domain Blogger session and returns to its root login.
- The configuration is reusable for future static-site tenants by adding a validated custom Blogger origin to the site manifest.

## Non-goals and anti-goals

- No new dynamic website, container, database, editor, or article publishing.
- The custom host must never expose `/cliente`, `/paneladmin`, another tenant, analytics, invoices, or general WF-Studio routes.
- The implementation must not redirect the browser back to `portal.webfuengirola.com` or `admin.webfuengirola.com` after entering the branded host.
- It must not share cookies across unrelated domains or put a reusable session token in a URL.

## Constraints

- Coolify already routes the custom host to the existing `wf-studio-panel` service on port 3000.
- Browser cookies are host-scoped, so the portal cannot directly create a cookie for the Sport Massage domain.
- Existing Supabase launch tickets already provide single-use, audience-bound handoff codes.
- Existing portal and administrator routing must remain unchanged.

## Approaches considered

1. **HTTP redirect to the portal.** Smallest change, but it discards the branded shell and recreates the problem this work is meant to solve.
2. **One central application with a custom host and ticket exchange.** Chosen. The host maps to one tenant, the portal issues a single-use ticket for that exact origin, and the custom host consumes it to create its own host-only session.
3. **A separate application per client.** Rejected because it duplicates deployments and maintenance and contradicts the single central product model.

## Design

The site manifest gains an optional `blogger.customOrigin` for central Blogger runtimes. Registry validation accepts only an exact HTTPS origin whose hostname is a subdomain of the site's canonical domain. A focused helper resolves custom host to tenant and produces the root and handoff destinations.

Middleware treats a configured custom Blogger host as a dedicated tenant surface. `GET /` is internally rewritten to the existing `/acceso/blogger/<siteKey>` page so the browser keeps the clean root URL. Only the root, direct-session endpoint, ticket-consumption endpoint, required Blogger static assets, and the tenant's legacy Blogger API surface are admitted. General panel, admin, authentication, analytics, and cross-tenant paths return 404.

Direct login posts to the same host. The endpoint resolves the validated public origin, accepts the custom host, sets the existing `__Host-` session cookie without a Domain attribute, and redirects to `/`. Logout does the inverse. Existing portal direct access remains available as a compatibility path.

For panel entry, the portal validates the authenticated client and project as today, then creates a launch ticket bound to the custom origin. It redirects to a custom-host exchange endpoint carrying only the short-lived single-use code. The exchange validates host-to-tenant mapping, consumes the ticket for the exact origin, creates the scoped host-only Blogger session, and redirects to the clean root. Invalid, expired, replayed, mismatched, or cross-tenant codes create no session and return to the branded login with a generic error.

The Sport Massage static `/admin/blogger/` gateway is updated in its own repository to point to the branded root. It remains a simple compatibility shortcut and contains no login logic or editor code.

## Verification

- Automated tests cover host mapping, root rewrite, denied routes, direct login/logout, panel ticket exchange, replay/mismatch failure, and unchanged portal/admin behavior.
- The full panel suite, type check, and production build pass.
- Production checks prove both the direct credential flow and the client-panel temporary-token flow land on the branded root, preserve the hostname, and show a working logout without publishing content.
