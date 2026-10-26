# Sport Massage Minimal Central Access Plan

This plan supersedes the earlier ticket/session-exchange proposal. The existing Supabase session and login are sufficient.

## Scope

- Reuse the Sport Massage registry centralization from commit `ff252f2`.
- Restrict the metadata exception to Sport Massage's validated central legacy runtime; preserve every other client's validation contract.
- Keep the project Blogger button available without external handoff metadata. Its existing internal project route already embeds the central editor under the portal session.
- Remove the obsolete Sport handoff-secret example and document the two entry paths and host-bound sessions.
- Preserve the previous worktree's uncommitted changes. Work in a separate branch; do not push, merge or deploy.

## Verification

1. Run the complete inherited suite before edits.
2. Add a failing regression for the Sport project button without external metadata; restore existing tests that enforce other clients' provisioning requirements and observe their failures against the overly broad inherited exception.
3. Apply the minimal presentation and validation correction, then run the focused tests.
4. Exercise the real registry, project filtering, portal/direct pages and legacy API authorization with an authenticated session and controlled remote database fixtures. Both entries must render `/blogger/index.html` without tickets or a second login. Deny foreign ownership, revoked access, inactive projects, mismatched domain and missing capabilities.
5. Re-run existing direct password-login and host-routing regressions, external handoff tests, the complete test suite, lint, typecheck and build. Run local database integration tests if their local prerequisites are available.
6. Inspect the final diff against `origin/main`; only Sport Massage configuration and its narrowly scoped validation/presentation exception may change production behavior. Record results and make local commits only.
