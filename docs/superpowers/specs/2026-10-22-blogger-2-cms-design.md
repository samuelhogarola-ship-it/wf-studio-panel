# Blogger 2.0 CMS — Design

## Purpose

WF Studio already has a secure multi-site Blogger with a visual editor, image management, preview, drafts and publishing. Vivir en Fuengirola and Conoce Fuengirola now also have project-specific content management flows for guides and news. The goal is to reuse those capabilities without creating another independent editor for every website.

WF Studio will expose two product levels built on the same editor core:

- **Blogger**: the current, simple post workflow for websites with one blog destination.
- **Blogger 2.0**: a configurable CMS for websites that publish different content types into different site sections, such as `/guias`, `/tips`, `/noticias`, `/consejos` or `/articulos`.

Clients, collaborators and administrators must be able to create and maintain content without editing source code. Each user sees only the projects and content types explicitly enabled for them.

## Success criteria

1. Sport Massage is delivered first as the reference product: its own `/admin/blogger` serves the local editor, accepts the dedicated `sportsmassage` username and an operator-supplied password hash, and no longer redirects ordinary direct access to WF Studio.
2. Sport Massage can remember an explicitly requested direct-login session for 30 days without storing the password, survives service restarts, and invalidates that session on logout.
3. The Sport Massage editor is usable at a 360 px mobile viewport: no horizontal clipping, touch targets are at least 44 px, the visual editor uses a mobile-safe font size, and copy, paste, edit, save and publish remain available.
4. Blogger continues to work for existing Samuel Coach and other configured sites without changing existing URLs or published content.
5. Blogger 2.0 can declare multiple content types and destinations per website without requiring a new editor implementation.
6. The editor supports visual rich text, inline images, preview, SEO, categories, tags, structured sections, FAQs, sources and project-specific relationships.
7. Existing Vivir and Conoce guides and news can be listed and edited through the common editor after their adapters are enabled.
8. TodoPlástico can expose Articles, Guides and Tips through the same editor while preserving its public rendering and `mkt_articles` storage contract.
9. Draft, preview, publish, archive/delete and public-link behavior is explicit and tested for every adapter.
10. Authorization remains project-bound and site-bound; no client can discover or mutate another project's content.
11. Every enabled website supports two independent entry paths: its own direct Blogger credentials and a secure launch from WF Studio or the WF client portal.

## Non-goals

- Replacing the public page design of Vivir, Conoce, TodoPlástico or any other website.
- Moving every site's content into a new central WF Studio database.
- Building a general page builder for arbitrary landing-page layouts.
- Allowing clients to edit services, navigation or unrelated website configuration.
- Automatically enabling Blogger or Blogger 2.0 for every project.

## Product model

### Blogger

Blogger is the simple profile. It exposes one content type named `Post` and one public destination. It retains the current editor, content store and publishing runtime. Sites can keep optional fields such as category, level, language or translated publication languages.

### Blogger 2.0

Blogger 2.0 uses the same editor shell but loads a site content profile. The profile describes:

- available content types and their labels;
- public base paths;
- enabled fields and structured modules;
- controlled category and topic choices;
- supported languages;
- relationship sources, such as businesses or guides;
- storage and publishing adapter;
- preview and public URL behavior.

The selected content type drives the form. A user selecting `Guía` sees guide fields; a user selecting `Noticia` sees news fields. Unsupported fields are not rendered and are rejected by the server.

## Access model

Every deployed Blogger or Blogger 2.0 instance supports two complementary authentication paths.

### Direct website access

- The editor is available from the website's own address, normally `https://example.com/admin/blogger`.
- The client signs in with a website-specific username or email and password.
- These credentials belong to that editor instance and are independent from WF Studio credentials.
- The direct credential can be rotated independently by the website owner or administrator; forgetting it never blocks the portal recovery entry.
- WF Studio never stores, displays, synchronizes or attempts to reuse the direct password.
- Editors may offer `Recordarme en este dispositivo`. When enabled, only a revocable server-side session and secure HttpOnly cookie persist; the website never stores the plaintext password in JavaScript storage.

### WF Studio and client-portal access

- An administrator can launch the editor from the project's WF Studio workspace.
- A client can launch it from the assigned website in the WF client portal.
- WF Studio issues a short-lived, single-use, audience-bound launch ticket only after checking the exact user, project, domain and active Blogger capability.
- The website exchanges that ticket server-to-server and creates its own local editor session.
- This path does not require the user to enter or remember the direct website password.
- It therefore acts as a safe recovery entry: after entering through the client portal, the user can continue editing even when the direct password is forgotten. It never reveals or recovers the previous password.

The two sessions remain independent. Signing out of the direct editor does not sign the user out of WF Studio, and signing out of WF Studio does not invalidate a separately authenticated direct-editor session.

## Architecture

### Shared editor core

The existing Blogger editor remains the UI foundation. It will be separated into focused modules while preserving its current routes:

- content list, search and status filters;
- site and content-type context;
- title, slug, excerpt/introduction and publication metadata;
- WYSIWYG body with Markdown/HTML views;
- formatting for headings, bold, italic, links, lists and quotes;
- image library, featured image, inline images, alt text and captions;
- quick preview and public preview;
- SEO title, description, canonical/public path and tags;
- structured modules enabled by the content profile;
- save draft, publish and archive/delete actions.

The editor must not contain site-name conditionals. Site differences belong in profiles and adapters.

### Content profiles

The canonical site registry gains a versioned content profile. Conceptually:

```ts
type ContentProfile = {
  version: 2
  mode: 'blogger' | 'cms'
  adapter: AdapterConfig
  contentTypes: ContentTypeProfile[]
}

type ContentTypeProfile = {
  key: string
  label: string
  pluralLabel: string
  publicBase: string
  fields: string[]
  modules: Array<'sections' | 'faqs' | 'sources' | 'relations' | 'premiumCta'>
  categories?: Array<{ value: string; label: string }>
  relationKinds?: string[]
  languages?: string[]
}
```

Profiles are server-owned. Browser payloads receive only presentation-safe choices and never adapter credentials, table names, filesystem roots or webhook secrets.

### Normalized document contract

The editor communicates with every adapter through one normalized contract:

```ts
type ContentDocument = {
  id?: string
  siteKey: string
  typeKey: string
  slug: string
  status: 'draft' | 'published' | 'archived'
  title: string
  summary?: string
  introduction?: string
  language?: string
  category?: string
  tags: string[]
  publicationDate?: string
  hero?: { url: string; alt: string; caption?: string }
  body: { format: 'html' | 'markdown'; value: string }
  sections: Array<{ id: string; title: string; body: string }>
  faqs: Array<{ id: string; question: string; answer: string }>
  sources: Array<{ id: string; label: string; url: string }>
  relations: Array<{ kind: string; id: string; label?: string }>
  premiumCta?: { label: string; url: string; text?: string }
  seo: { title?: string; description?: string; image?: string }
  publicUrl?: string
  updatedAt?: string
}
```

Adapters translate between this contract and each website's existing storage shape. Unknown or profile-disabled fields are rejected rather than silently stored.

### Adapter boundary

All adapters implement the same operations:

```ts
interface ContentAdapter {
  list(input): Promise<ContentSummary[]>
  read(input): Promise<ContentDocument>
  saveDraft(input): Promise<ContentDocument>
  publish(input): Promise<PublishResult>
  archive(input): Promise<void>
  uploadImage(input): Promise<ContentImage>
  listRelations?(input): Promise<RelationOption[]>
}
```

Supported adapter families:

1. **Static content adapter** — preserves the current filesystem/build-hook Blogger behavior.
2. **Supabase editorial adapter** — maps normalized documents to approved schemas and tables when WF Studio has a server-side connection.
3. **Signed site adapter** — calls a site-owned authenticated endpoint when the website uses a separate database or deployment boundary.

New websites select an existing adapter family and provide a profile. They do not receive copied editor code.

## Initial site mappings

### Vivir en Fuengirola

- Mode: Blogger 2.0.
- Types: `Guía`, `Noticia`.
- Guide fields: title, introduction, rich body, category, neighborhood, language, status and related businesses.
- News fields: title, introduction, rich body, date, topic, language, status and related guides.
- Enhancement over its current CMS: visual formatting, inline images, preview, headings, links, lists, SEO, optional sections, FAQs and sources.
- Existing Supabase rows remain canonical and are read through the adapter.

### Conoce Fuengirola

- Mode: Blogger 2.0.
- Types: `Guía`, `Noticia`.
- Guides preserve summary, hero image/alt, introduction, sections, FAQs, sources, premium CTA, related businesses, language and status.
- News preserve summary, hero image/alt, introduction, sections, sources, date, controlled category, language and status.
- Existing Supabase rows remain canonical and are read through the adapter.

### TodoPlástico

- Mode: Blogger 2.0.
- Initial types: `Artículo`, `Guía`, `Consejo`.
- Public destinations: configured from the real TodoPlástico routes rather than hard-coded in the editor.
- Categories and tags come from its project profile.
- The adapter maps to the existing `mkt_articles` contract and preserves current public article URLs.
- Structured content unsupported by the current public renderer must be converted by the adapter or withheld from the profile until the renderer supports it.

### Existing simple Blogger sites

- Remain in `blogger` mode.
- Keep their current post list, editor, images, preview and build hooks.
- Can be upgraded to Blogger 2.0 by adding a profile and validated adapter; no client access is activated automatically.

### Sport Massage Fuengirola access baseline

The Sport Massage repository already contains a complete local editor, direct username/password authentication, secure cookies, the Studio ticket exchange, image handling and static publishing. The current release generator nevertheless overwrites `/admin/blogger/` with a redirect to Studio, so those existing assets are not the product users receive. WF Studio also lacks the complete external handoff contract (`launchUrl`, `healthUrl`, adapter capabilities and exchange secret). The work is therefore an activation and hardening of the existing editor, not a rewrite.

Sport Massage is a release gate for the rest of the rollout. No Blogger 2.0 adapter rollout is considered started until this product passes its direct-login, remembered-session and mobile acceptance checks.

Sport Massage is the first end-to-end acceptance site. Completion requires:

- direct login at its own `/admin/blogger` with independent credentials;
- username configured as `sportsmassage` and the user-supplied password stored only as a strong environment hash;
- an explicit, default-enabled `Recordarme en este dispositivo` option that creates a persistent 30-day server-side session without persisting the plaintext password;
- remembered sessions that survive a service restart, are pruned after expiry and are deleted immediately on logout;
- browser password-manager support through correct autocomplete fields, without custom plaintext credential storage;
- mobile acceptance at 360 px for login, post selection, copy/paste editing, image insertion, draft saving and publishing;
- a documented, administrator-controlled direct-password rotation procedure;
- administrator launch from WF Studio;
- client launch from the WF client portal without entering the direct password;
- exchange of a single-use ticket into a Sport Massage-local session;
- health validation before the capability is marked active.

## User experience

### Entry and navigation

- Administrators enter from the selected project workspace in WF Studio.
- Clients enter from their WF client project page or directly from the website's own Blogger login.
- Launching from either WF panel uses a one-time handoff and finishes on the website's editor origin when the editor is hosted there.
- Direct website login always uses the independent website credentials and never redirects through WF Studio unless the user explicitly chooses the WF portal recovery entry.
- A Blogger user sees `Posts` immediately.
- A Blogger 2.0 user sees a content-type selector and then the corresponding content list.
- The editor title always names the current project and content type to prevent publishing into the wrong site.

### Editing flow

1. Select content type.
2. Create a document or open an existing one.
3. Complete common metadata and project-specific fields.
4. Write visually, insert images and manage enabled structured modules.
5. Preview using the target site's rendering contract.
6. Save as draft or publish.
7. After publication, open the exact public URL returned by the adapter.

Changing content type after the first save is not allowed because destinations can use different schemas and URLs.

### Deletion

- Published documents default to `archived` instead of hard deletion.
- Drafts can be deleted when the adapter explicitly supports it.
- Every destructive action requires confirmation naming the document and destination.

## Data flow

1. The protected project route authorizes the authenticated identity against the exact project and active Blogger capability.
2. The server resolves the canonical site and content profile.
3. The browser receives a sanitized editor configuration.
4. API requests repeat authorization and validate the requested content type against the profile.
5. The normalized document is validated before reaching an adapter.
6. The adapter translates and stores or publishes the document.
7. The API returns only sanitized content data, status and public URLs.

The browser never selects arbitrary schemas, repositories, paths, tables or adapter endpoints.

## Security and isolation

- Preserve the existing exact-origin mutation guard and project-bound authorization.
- Require an active Blogger capability for both Blogger modes.
- Resolve `siteKey`, project and domain server-side; never trust browser-provided ownership.
- Keep direct-editor password hashes and reset tokens inside the website's own authentication boundary.
- Never copy direct-editor passwords into WF Studio or send WF Studio passwords to a website.
- Keep launch tickets single-use, short-lived, audience-bound and exchanged only by the authenticated destination server.
- Keep Supabase service credentials, build secrets and signed-adapter secrets server-only.
- Validate URLs for sources, images, CTAs and public destinations.
- Sanitize rich HTML using an allowlist before preview and persistence.
- Restrict image MIME type, file size and destination.
- Log actor, project, content type, document identity and action without logging secrets or full article bodies.

## Compatibility and migration

- The current Blogger API remains operational during the rollout.
- Existing post metadata receives defaults when loaded into the normalized contract.
- Vivir and Conoce content is not copied into WF Studio; adapters read the current canonical rows.
- Existing slugs and public URLs are immutable unless the destination adapter explicitly supports a safe redirect.
- Rollout is per project and content type. A profile can be present while the client capability remains unavailable.
- Disabling Blogger 2.0 removes access but does not delete content.

## Failure behavior

- Profile or adapter misconfiguration fails closed and is visible only to administrators.
- Clients receive a neutral unavailable message without infrastructure details.
- Draft save and publish report distinct states; a successful draft save must never be presented as a successful publication.
- Adapter timeouts do not discard the user's editor state.
- Partial image failures identify the affected file and leave the document editable.
- A publication response without a validated destination URL is treated as incomplete.

## Testing strategy

### Contract tests

- Profile parsing and browser-safe serialization.
- Normalized document validation for each enabled module.
- Adapter conformance for list, read, draft, publish, archive and image operations.
- Translation fixtures for Vivir guides/news, Conoce guides/news and TodoPlástico articles.

### Authorization and security tests

- Cross-client, cross-project and cross-site access rejection.
- Disabled or merely available capabilities cannot mutate content.
- Direct website credentials cannot authenticate against WF Studio and WF Studio passwords are never accepted by direct editors.
- A valid portal launch creates only the exact destination session; replay, expiry, wrong audience and wrong site fail closed.
- Portal launch works without the direct password and does not disclose or reset it.
- HTML sanitization, unsafe URL rejection and image restrictions.
- No storage or credential details in browser configuration or error responses.

### Editor tests

- Blogger simple mode keeps its current behavior.
- Blogger 2.0 changes fields and modules when content type changes.
- Unsaved-change protection, draft, preview, publish and archive flows.
- Existing structured content round-trips without loss.

### Integration tests

- Existing Blogger content store and build hooks.
- Vivir and Conoce adapter fixtures using their real field shapes.
- TodoPlástico `mkt_articles` mapping and public URL generation.
- Administrator and client launch paths reach the same authorized editor context.

## Rollout

1. Introduce profile and normalized-document contracts with no UI behavior change.
2. Refactor current Blogger behind the static adapter and prove regression compatibility.
3. Complete the hosted-editor authentication and handoff contract against Sport Massage as the reference implementation.
4. Add Blogger 2.0 content-type navigation and structured modules.
5. Add and validate the Vivir and Conoce adapters against existing content.
6. Add TodoPlástico profile and adapter once its exact public route mapping is verified.
7. Activate Blogger 2.0 per project only after direct login, portal launch, read, draft, preview and publish checks pass.

## Acceptance checklist

- Existing Blogger sites pass their current test suite unchanged.
- A profile can add `/guias` and `/tips` without modifying editor source code.
- Vivir and Conoce existing documents open and round-trip without field loss.
- TodoPlástico can create a draft, preview it, publish it and open its final URL.
- An administrator can manage every enabled project; a client can manage only assigned active projects.
- The same editor is reachable through the client panel and authorized direct access.
- Direct access uses a separate website credential, while WF Studio/client-panel access uses a one-time handoff and requires no direct password.
- Forgetting the direct password never blocks an authorized client from entering through the client portal; the old direct password remains unrecoverable and can only be replaced.
- No deployment or capability activation occurs as part of merging the editor foundation.
