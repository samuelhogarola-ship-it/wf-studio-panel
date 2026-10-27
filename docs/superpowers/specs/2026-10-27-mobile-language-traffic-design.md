# Mobile dashboard language traffic design

## Intent

The client dashboard must start at the top after login on mobile and expose a compact, immediately readable view of website traffic by language.

## Goals

- Reset the client dashboard viewport to the top when it mounts.
- Add a compact, accessible page-language traffic diagram to the existing rotating analytics card.
- Sport Massage always shows Spanish in red, English in green, and Finnish in blue, including zero values.
- Every other project shows its three highest-traffic base languages, using the same rank palette.
- Keep the detailed Umami analytics view unchanged and complete.

## Non-goals

- Do not use Umami's browser-language dimension as a proxy for page language.
- Do not claim that event metrics represent mutually exclusive people; label them as traffic.
- Do not combine traffic from different websites owned by one client.
- Do not add a charting dependency.

## Constraints

- Fetch only Umami event names in addition to the existing summary requests and accept the explicit `page-language:<code>` contract.
- Normalize regional tags such as `es-ES` and `es-MX` into `es` before ranking.
- Never expose Umami registry keys, website IDs, endpoints, or credentials.
- Use an HTML/CSS stacked bar plus text legend so the diagram remains accessible and light on mobile.

## Approach

The server analytics facade gains an explicit `includeContentLanguages` option used only by the client dashboard summary. It fetches the complete event-name dimension, accepts only `page-language:<code>` events emitted by each website, and the public summary aggregates and sanitizes those rows. The existing rotating analytics card renders the compact diagram for the currently selected project in the portal locale. A dashboard-only client component resets the real window scroll position immediately and again on the next animation frame, avoiding behavior changes on other portal pages and winning over post-login scroll restoration.

