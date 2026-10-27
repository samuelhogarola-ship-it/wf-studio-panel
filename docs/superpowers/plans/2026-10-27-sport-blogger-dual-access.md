# Central static Blogger dual-access implementation plan

**Goal:** make the validated panel-to-Blogger temporary handoff the shared rule for every central static Blogger runtime while preserving Sport Massage's independent direct gateway.

## Tasks

1. Add regression tests for the Sport sidebar destination, a second central static site, English auto-launch page, one-use ticket consume, scoped session cookie and absence of tokens in URLs.
2. Split direct credential loading from session-signing configuration and derive the latter from the existing server secret.
3. Extend the existing Blogger launch POST with a portal-only, config-driven central handoff: authorize, rate-limit, create and atomically consume the ticket, verify its binding, set the site-scoped cookie, and redirect to the central editor.
4. Route every eligible central project through the English auto-submit launch screen; restore the focused Sport sidebar to that protected project route.
5. Run targeted tests, lint/type checks and the full suite; then request an independent code review before integration.

## Non-goals

- no new application, backend, database schema, domain or Coolify service;
- no use of `admin.webfuengirola.com` for Sofia;
- no synchronization of the client-panel password and Blogger password;
- no article publication.
