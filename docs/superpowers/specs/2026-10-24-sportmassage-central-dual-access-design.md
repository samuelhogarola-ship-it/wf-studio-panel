# Sport Massage Central Dual Access Design

## Final decision

Sport Massage uses the single existing WF Studio Blogger editor and its current Supabase account. This decision supersedes the proposed internal ticket consumption and session exchange.

- Área Cliente opens `/cliente/proyectos/sportmassagefuengirola/blogger` and embeds `/blogger/index.html` on the portal host using its existing Supabase session.
- The direct URL `https://admin.webfuengirola.com/acceso/blogger/sportmassagefuengirola` uses the existing Supabase email/password login when needed, preserves the destination, and embeds the same editor on the administrator host.
- Cookies remain host-bound. A portal session does not automatically establish a session on the administrator host; the direct entry uses its existing login flow.
- No additional login implementation, launch ticket, consume endpoint, generated magic link or token exchange is required.

## Authorization

Both entries require the current active client, exact assigned active project, enabled client access and active Blogger capability. Registry key, domain and enabled editor runtime remain validated. The legacy editor API uses `authorizeSportBlogger`, which delegates to the same `authorizeBloggerSite` authorization as direct entry.

Only Sport Massage's central legacy runtime stops requiring discarded external launch/provisioning metadata. Other clients retain their existing validation requirements. The project tool remains internal and honors configuration warnings.

## Scope

Remove only Sport Massage's external runtime endpoints, adapter, capability manifest and obsolete handoff-secret example. Keep its existing GitHub publication and optional translation configuration. Preserve all other site registry entries, external-runtime support, public websites, analytics, credentials and infrastructure. No push, merge or deployment is part of this correction.
