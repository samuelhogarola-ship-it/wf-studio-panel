# Mobile dashboard language traffic design

## Intent

The client dashboard must start at the top after login on mobile and expose a compact, immediately readable view of website traffic by language.

## Goals

- Reset the client dashboard viewport to the top when it mounts.
- Add a compact, accessible language traffic diagram to the existing rotating analytics card.
- Sport Massage always shows Spanish in red, English in green, and Finnish in blue, including zero values.
- Every other project shows its three highest-traffic base languages, using the same rank palette.
- Keep the detailed Umami analytics view unchanged and complete.

## Non-goals

- Do not claim that language metrics represent unique people; label them as traffic.
- Do not combine traffic from different websites owned by one client.
- Do not add a charting dependency.

## Constraints

- Fetch only the language dimension in addition to the existing summary requests.
- Normalize regional tags such as `es-ES` and `es-MX` into `es` before ranking.
- Never expose Umami registry keys, website IDs, endpoints, or credentials.
- Use an HTML/CSS stacked bar plus text legend so the diagram remains accessible and light on mobile.

## Approach

The server analytics facade gains an explicit `includeLanguages` option used only by the client dashboard summary. The public summary aggregates and sanitizes the language rows. The existing rotating analytics card renders the compact diagram for the currently selected project. A dashboard-only client component resets the window scroll position with a layout effect, avoiding behavior changes on other portal pages.

