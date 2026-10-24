# Sport Massage Central Dual Access Design

## Intent

Sport Massage must use the single legacy editor and single GitHub-backed content source already hosted by WF Studio. Clients need a seamless entry from Área Cliente and a saved direct URL that falls back to Supabase email/password authentication.

## Goals

- Área Cliente creates a 60-second, single-use ticket bound to the authenticated user, assigned project, client, site and Studio admin origin.
- The Studio admin host consumes that ticket once, revalidates the exact Sport Massage assignment, establishes a Supabase Auth session for the same user and opens the central legacy editor without another login.
- `/acceso/blogger/sportmassagefuengirola` remains the canonical direct URL. Without a valid session it redirects to the existing client login while preserving the destination; after login it authorizes the same project and opens the same editor.
- Both paths use `authorizeBloggerSite` and `/blogger/index.html`; no independent Sport Massage runtime remains in the registry.

## Non-goals

- No changes to the `sportmassage` repository, Hostinger, DNS, public pages, publishing bridge, Umami or other projects.
- No password or business email in source, examples, commands, logs or responses.
- No Coolify, GitHub Pages, Vercel or independent Blogger backend.

## Approach

Reuse the existing hashed `tool_launch_tickets` table and its atomic consume RPC. Replace the external Sport Massage handoff with an internal POST delivery to the Studio admin origin. After consuming and revalidating the ticket, use a server-generated Supabase magic-link token entirely server-side to establish the normal Supabase session cookie, then redirect to the canonical direct Blogger page. Direct login already uses Supabase password authentication and a sanitized return destination, so both paths converge on the same identity, authorization and editor.

Alternatives rejected: sharing cookies between subdomains weakens host isolation; a separate signed Blogger cookie creates a second session model; retaining the independent handoff contradicts the single-editor requirement.

## Security constraints

- Accept only the exact Sport Massage site key and exact Studio portal/admin origins.
- Store only the SHA-256 ticket hash; never put the ticket in a URL, referrer or log.
- Consume once, enforce expiry in PostgreSQL, and revalidate user/client/project/capability before minting a session.
- Return indistinguishable safe failures for expired, replayed, foreign and unauthorized tickets.
- Keep server credentials and generated Supabase verification tokens out of browser responses and logs.

## Provisioning

Account creation or password reset remains an operational Supabase Auth step. Use the Supabase dashboard or the existing authenticated administrator flow to create/reset the user and assign the active WF Studio client/project records; never store the password in Git or application environment variables.
