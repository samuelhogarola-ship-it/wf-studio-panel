# Web Fuengirola Umami Market Breakdown Design

## Intent

Keep one Umami website for `webfuengirola.com` so the existing dashboard total remains authoritative, while making traffic, acquisition and conversion events inspectable by market in WF-Panel.

## Goals

- Preserve the unfiltered aggregate total.
- Add four selectable views: Spain/rest of domain, Mexico, USA and Brazil.
- Define Mexico as `/mexico` and descendants (including `/mexico/en/`), USA as `/usa` and descendants (including `/usa/es/`), and Brazil as `/brasil` and descendants.
- Apply the selected market consistently to summary stats, time series, acquisition dimensions, content dimensions, events and sessions.
- Keep credentials, the Umami website ID and internal registry keys server-only.

## Non-goals and constraints

- Do not create separate Umami websites or alter WF-Studio.
- Do not infer a market from visitor geolocation; the site pathname is the source of truth.
- Do not show the global real-time active visitor count inside a filtered market view because Umami's active endpoint does not accept path filters.
- Production credentials and deployment configuration remain external to this repository.

## Approaches

1. **Selected: one website plus Umami universal path filters.** Query the existing website with `re.^/prefix(?:/|$)` for international markets and three `nre` filters for Spain/rest. This preserves all totals and lets every supported metric use the same server-side filter.
2. **Rejected: group only the top-path response in the browser.** This would miss paths outside the result limit and cannot segment sources, sessions or events.
3. **Rejected: one Umami website per market.** This would fragment the requested aggregate total and require tracker changes in WF-Studio.

## Design

The analytics server module owns the market definitions and translates a validated market key into Umami query parameters. The analytics API accepts an optional `market` query value and never forwards arbitrary client filters. `fetchUmamiDashboard` applies the generated filters to stats, pageviews, event totals, metrics and sessions. The shared analytics panel displays a market selector only when the resolved project registry key is `webfuengirola`, sends the selected key to the API, and labels the event summary as conversion events for the market view.

Tests must prove the exact regex/exclusion parameters, that every relevant request is filtered, that the aggregate total remains unfiltered, and that unsupported projects/keys cannot activate these filters.
