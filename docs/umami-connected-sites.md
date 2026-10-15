# Additional public website analytics

The shared registry in `src/lib/analytics/umami-core.mjs` includes these sites in the personal connection and `reports-only` group:

| Site | Domain | Runtime variable |
| --- | --- | --- |
| Bionatura | bionatura.es | `UMAMI_WEBSITE_ID_BIONATURA` |
| Sport Massage Fuengirola | sportmassagefuengirola.com | `UMAMI_WEBSITE_ID_SPORTMASSAGEFUENGIROLA` |
| Deutschkompakt | deutschkompakt.com | `UMAMI_WEBSITE_ID_DEUTSCHKOMPAKT` |

Set each variable to its existing website ID from the personal Umami instance. Keep the existing connection credentials and other environment settings. No database migration is required. IDs are supplied at runtime and are not hardcoded in the registry.

After deploying the registry and setting the three variables, the next monthly report includes these websites. Reports are visible at `/paneladmin/informes`; previously stored monthly snapshots are unchanged. These sites do not add new sidebar projects or project-specific live analytics panels. Live website metrics remain available in the personal Umami instance.

The monthly report uses the same registry as the shared analytics fetcher. Missing IDs can resolve from the exact registered domain; explicit runtime IDs are preferred. Incomplete upstream results retain the existing report failure behavior.

Minimal runtime source change: `src/lib/analytics/umami-core.mjs`. Deploy through the normal Next.js build/restart process; changing the source file alone does not update an already-built application. `.env.example`, tests and this document are supporting files. Agama connection, site mapping and configuration are unchanged.

Verify with `npm test`, including registry grouping/runtime IDs, monthly inclusion and the existing Agama isolation checks.
