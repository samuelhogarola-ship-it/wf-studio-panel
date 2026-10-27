# Central static Blogger dual-access design

**Status:** approved by the product owner through the established access model.

## Contract

Every registered static website whose Blogger runtime is central has the same panel handoff. Sport Massage additionally has an independent direct credential gateway.

1. **Client panel:** the assigned client signs in at `portal.webfuengirola.com`, clicks Blogger, and the panel creates a 60-second, single-use launch ticket bound to that user, client, project, site and the exact portal origin. The server consumes that ticket atomically, establishes the site-scoped Blogger session, and redirects to `/acceso/blogger/{siteKey}` without asking for another password.
2. **Direct gateway:** visiting `sportmassagefuengirola.com/admin/blogger/` reaches the portal gateway and still requires the independent Blogger username and password unless a valid scoped Blogger session already exists.

`admin.webfuengirola.com` is owner-only and is not part of either client flow. The existing `wf-studio-panel` application, its central editor and its GitHub-backed content workflow remain the only application; no new Coolify service or domain is introduced.

## Security boundary

- The panel launch is a same-origin POST and requires an authenticated active client, an accessible matching project, an active Blogger capability and a registered `central-legacy` or `central-multisite` runtime.
- The launch ticket is opaque, stored only as a SHA-256 hash, valid for 60 seconds, audience-bound to the portal, and consumed once.
- The ticket is never placed in a URL, response body, browser storage or log.
- A successful consume sets the same host-only, HttpOnly, Secure, SameSite=Strict scoped Blogger session used by direct access.
- Session signing derives a domain-separated key from the existing Supabase server secret, so the panel launch does not require a second deployment secret. A legacy explicit signing secret remains supported but fails closed if malformed. Direct Sport credentials still require their username and password hash.
- Opening a central editor URL with only the ordinary client session is insufficient; client access must have the site-bound launch session. The Sport direct gateway without a valid scoped session still displays its independent login.
- Launch creation is limited per user and site, serialized in the database, and expired or consumed rows are retained for no more than one hour after they become stale.
- No article is created or published by this change.

## User experience

Each eligible client sidebar links Blogger to the protected project Blogger page. That page immediately POSTs the launch form and shows an English fallback button if automatic submission is unavailable. A launch failure returns to a recoverable English retry screen. The successful client destination is the central editor on `portal.webfuengirola.com`, never the owner-only admin host.
