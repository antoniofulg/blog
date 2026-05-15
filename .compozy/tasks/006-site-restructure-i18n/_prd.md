# PRD — Site Restructure: Organic Content with Locale Foundation

## Overview

The blog is a WIP personal tech site running on TanStack Start + Better Auth + Drizzle + PostgreSQL. Several pages render mocked arrays inline in route files (tutorials, projects), two routes are placeholder stubs ("Em breve" newsletter, empty search), the post feed lives behind a redirect shim at `/$lang/blog`, and the About page hardcodes profile, stack, experience, and fake social links pointing to generic site roots (`https://github.com`, `https://linkedin.com`, `https://twitter.com`). Existing locale infrastructure — locale primitives, `$lang` routes, `posts.lang` column, `content/en` + `content/pt-br` directories — is well-built but underutilized.

V1 removes every mocked surface, makes the post feed the homepage (`/` English, `/pt-br/` Portuguese), adopts URL-prefix locale strategy, migrates About to MDX-per-locale with an indie-dev minimal structure (identity 1-liner + photo + bio + Now section + contact links), and locks a typed `Record<Locale, UIStrings>` i18n contract that V1 partially populates and V2 extends additively.

The product is for three audiences: (a) the author (Antonio) who needs to edit content in MDX rather than TSX; (b) tech-curious visitors arriving via search who expect clean URLs and a credible About page; (c) Brazilian readers who expect Portuguese URLs and a recognizable locale switcher.

## Goals

- Eliminate every mocked surface visible to a visitor (target: 0 mock-data matches in `app/routes/` and `app/components/`).
- Make the blog post feed the homepage at `/`, removing the existing redirect shim.
- Establish locale parity foundation: every visitor-facing page renders in both `en` and `pt-br` (with explicit fallback UX when a translation does not yet exist).
- Lock a typed `UIStrings` contract in V1 so V2 extraction is an additive diff, not a retrofit migration.
- Stabilize the post indexing pipeline so deploys reliably populate the `posts` table and the admin dashboard reflects on-disk content without manual sync steps.
- Ship the restructure as 3 sequential phases (per ADR-002), each independently shippable and visitor-coherent.
- No production traffic exists today; the V1 timeline is bounded by author availability, not by reader uptime SLAs.

## User Stories

### Author (Antonio) — primary persona

- As Antonio, I want About content to live in MDX files per locale so that I can update my bio without editing TSX route files.
- As Antonio, I want the locale switcher labels and core UI strings sourced from a typed module so that future additions are type-checked.
- As Antonio, I want the post feed at `/` so that the homepage reflects real content from day one, not a redirect.
- As Antonio, I want hreflang link tags on every locale-aware page so search engines index both versions correctly.
- As Antonio, I want the admin dashboard to list every post that exists on disk so I can publish, unpublish, and preview without manually running sync scripts.
- As Antonio, I want deploys to leave the `posts` table consistent with the deployed `content/` directory so I do not have to remember a post-deploy manual step.

### English-speaking visitor — primary persona

- As an English reader arriving via search, I want clean post URLs (`/<slug>`) so I can share and remember links.
- As an English reader, I want the homepage to show recent posts so I do not need extra navigation to find content.
- As an English reader, I want the locale switcher labeled in my own language ("English") so I recognize the control instantly.
- As an English reader on About, I want to see real social profile links, not generic site URLs.

### Brazilian visitor (pt-br) — primary persona

- As a Portuguese reader, I want URLs prefixed with `/pt-br/` so I can identify the locale at a glance and share locale-specific links.
- As a Portuguese reader visiting a post that is not yet translated, I want to see the English version with a clear notice rather than a 404, so the URL contract is preserved while expectations are managed.
- As a Portuguese reader, I want the locale switcher labeled "Português" so I find it in my own language.
- As a Portuguese reader, I want About at `/pt-br/about` with Portuguese content so the locale boundary is consistent.

### Recruiter / hiring manager — secondary persona

- As a recruiter visiting About, I want real, verifiable social profile links (GitHub, LinkedIn) so I can validate the developer's online presence.
- As a recruiter, I want About to read as intentional content (identity statement + current focus + clear contact path) so I get an accurate snapshot quickly.

### Search engine crawler — secondary persona (machine)

- As a crawler, I want a valid `/robots.txt` so I do not hit a 404 on a standard probe.
- As a crawler, I want hreflang pairs on locale-aware pages so I can index both `en` and `pt-br` variants correctly without fragmenting ranking signals.

## Core Features

| # | Feature | Priority | What the user gets |
|---|---|---|---|
| F1 | Remove mocked and stub routes | Critical | No more stub "Em breve" newsletter, no empty search page, no fake projects or tutorials catalogues with hand-built arrays. |
| F2 | Blog post feed at the homepage | Critical | `/` renders the English post feed immediately; `/pt-br/` renders the Portuguese feed. No redirect shims. |
| F3 | Locale-prefixed clean post URLs | Critical | English posts at `/<slug>`, Portuguese posts at `/pt-br/<slug>`. Same slug across locales for easy cross-linking. Hreflang pairs on every post page. |
| F4 | Organic About per locale | Critical | `content/en/about.mdx` and `content/pt-br/about.mdx` source the About page. Indie-dev minimal structure: identity 1-liner, photo, bio in MDX body, Now section, contact links. Real links only — no placeholder URLs. |
| F5 | Typed i18n UI string contract | High | Locale switcher displays "English" / "Português" (own-language labels). Post meta labels (e.g., "Published on", "Reading time") and locale-aware 404 copy sourced from typed `UIStrings` module. V2 can extend strings without migration. |
| F6 | Header and footer cleanup | High | Removed: nav items for `Tutorials` and `Projects`; footer links to nonexistent `/feed.xml` and `/sitemap.xml`. Theme toggle and locale switcher retained. |
| F7 | Static `/robots.txt` | Medium | Crawler probes succeed. SEO audit tools no longer report a missing robots route. |
| F8 | Test and fixture cleanup | Medium | Lorem-ipsum fixture moved out of `content/en/` into the test fixtures directory; two affected tests rewritten to assert locale-aware About routing. CI stays green. |
| F9 | Stabilize post indexing pipeline | Critical | Admin dashboard reflects on-disk content after every deploy without manual sync. Deploy workflow runs `bun run sync` after migration; dev workflow performs initial sync at boot. Failures surface loudly. |

## User Experience

### Visitor journey — English reader arriving via search

1. Search result drops the visitor on `/<slug>`. Article renders with title, locale-formatted publish date, body, hreflang pair to `/pt-br/<slug>` (or fallback message if translation absent).
2. Visitor clicks the site logo → lands on `/`. Sees the recent-post feed with cards (date, title, description).
3. Visitor clicks `About` in the header → `/about`. Sees identity 1-liner, photo, bio in narrative form, Now section (current focus, what Antonio is working on), and contact links (GitHub, LinkedIn, email).
4. Visitor optionally clicks the locale switcher labeled "Português" → routed to the equivalent Portuguese page (post detail or About). If no equivalent exists, falls back to the Portuguese feed root with a brief notice.

### Visitor journey — Brazilian reader arriving via search

1. Search result drops the visitor on `/pt-br/<slug>` (if translation exists) OR on `/<slug>` with the existing `TranslationNotice` banner explaining the English fallback when only the English version is published. The article element renders with `lang="en"` attribute so screen readers pronounce correctly.
2. Visitor browses `/pt-br/` feed. If empty (V1 reality at launch), sees the existing minimal "Nenhum artigo encontrado" empty state.
3. Visitor switches to English via the "English" label in the locale switcher → routes to the equivalent English page.

### Author journey

1. Antonio writes a new English post: drops `<slug>.mdx` into `content/en/`. Indexer picks it up. Post is live at `/<slug>` after deploy.
2. Optional translation: Antonio writes `<slug>.mdx` into `content/pt-br/` with the same slug. Post is live at `/pt-br/<slug>` and the translation banner disappears on `/pt-br/<slug>` (since translation now exists).
3. Antonio updates the About bio: edits `content/en/about.mdx` (or `content/pt-br/about.mdx`). Commits, pushes, CD pipeline ships.

### UI / UX considerations

- **Locale switcher** — Own-language labels: "English" / "Português". Inline in the header. On click, navigate to equivalent URL in the target locale; if no equivalent exists, fall back to the target-locale feed root.
- **Translation-pending banner** — Existing `TranslationNotice` component reused. Renders when `/pt-br/<slug>` falls back to English content. Copy: "Este post ainda não está disponível em Português — exibindo versão em inglês". The fallback article element sets `lang="en"`.
- **Empty post feed** — Existing minimal empty state retained ("Nenhum artigo encontrado" + sub-copy). No CTA to English feed in V1; intentional minimalism.
- **Theme toggle** — Existing Sun/Moon button retained without change.
- **404 page** — Existing page retained without change. Both locales already render correctly.
- **WIP banner** — Out of V1 scope. Existing closable banner remains visible.

### Accessibility

- Fallback-locale content sets `lang="en"` on the article wrapper so screen readers switch pronunciation correctly.
- Locale switcher must be keyboard-navigable and announce its current state.
- Indie-dev minimal About requires a real photo with appropriate alt text (the author's name) — no decorative-only avatar placeholders.

## High-Level Technical Constraints

- Must reuse existing locale primitives in `app/lib/locale.tsx` (`Locale` type, `LOCALES`, `DEFAULT_LOCALE`, `detectLocaleFromRequest`, `LocaleProvider`). No new locale module created.
- Must integrate with existing `$lang.tsx` route layout for locale-aware routing.
- Hreflang `<link rel="alternate">` pairs required on all locale-aware visitor pages: feed root (`/`, `/pt-br/`), post detail (`/<slug>`, `/pt-br/<slug>`), About (`/about`, `/pt-br/about`).
- Article elements rendering fallback-locale content must set the `lang` attribute to the actual content language for screen-reader and SEO correctness.
- CI pipeline (`make test`, `make lint`, `make check`) must remain green after each of the 3 phases merges.
- `UIStrings` module loads must validate against a Zod schema; missing required keys fail loudly at module load.
- About MDX frontmatter must validate against a Zod schema at indexer time; required fields (`title`, `locale`) missing fail the indexer.
- All visitor-facing copy that ships in V1 must be sourced from either MDX content files or the `UIStrings` module — no new hardcoded copy in TSX route or component files.

## Non-Goals (Out of Scope)

- **Full nav, footer, and brand UI string extraction.** Reserved for V2 when Portuguese content exists in volume to justify the work. Keys are defined in the `UIStrings` type with TODO comments so V2 is an additive diff.
- **`/sitemap.xml` route.** Deferred until post volume and SEO ambition justify maintenance overhead; the broken footer link is removed in V1.
- **`/feed.xml` RSS route.** Deferred until reader demand signals exist; the broken footer link is removed in V1.
- **Newsletter provider integration.** `/newsletter` was a placeholder; integration is a separate idea.
- **Search implementation.** `/search` was an empty stub; deferred until content volume justifies indexing.
- **Auto-scaffold pt-br companion post stubs when an English post is added.** V2 stretch goal noted in `_idea.md`.
- **Accept-Language auto-redirect on `/`.** Explicit locale routing only; auto-redirect adds cache-hostile complexity and breaks bot indexing.
- **Admin UI changes.** `app/routes/admin/*` is untouched in V1.
- **WIP banner removal or rewrite.** Confirmed out of V1 scope; address in a separate task.
- **Theme system overhaul.** Theme toggle UX and styling stay as-is.
- **Date-based post URLs (`/<year>/<slug>`).** Rejected during idea brainstorming per ADR-001.
- **About engagement features (translation-request CTAs, contact forms).** Out of V1; ADR-001 alternatives 3 and 4 are not pursued.

## Phased Rollout Plan

### Phase 1 (MVP) — Slim down and stabilize

User-visible outcome: a tighter, honest site with no stub pages, no broken footer links, and a reliable admin dashboard that reflects on-disk content after every deploy.

Features:
- F1 — delete `app/routes/tutorials.tsx`, `tutorials.$seriesSlug.tsx`, `projects.tsx`, `newsletter.tsx`, `search.tsx`, `components/tutorial-step.tsx`.
- F6 — remove `Tutorials` and `Projects` nav items from header; remove broken `/feed.xml`, `/sitemap.xml` links from footer; remove deleted-route links from header and footer.
- F7 — ship `/robots.txt`.
- F9 — add `bun run sync` step to deploy workflow after migration; integrate initial sync into the dev boot flow so admin reflects on-disk content without manual intervention.

Success criteria to proceed to Phase 2:
- No visitor encounters a stub page or broken footer link in production.
- CI green on the merged commit.
- `/robots.txt` returns 200 in production.
- Manual audit confirms zero references to deleted routes from header, footer, or `__root.tsx`.
- After deploy, `/admin/` lists every `.mdx` file present in the deployed `content/` directory; admin dashboard is no longer empty when posts exist on disk.
- A fresh `bun run dev` populates the `posts` table from `content/` without manual `bun run sync`.

### Phase 2 — Route restructure

User-visible outcome: post feed at `/`, clean locale-prefixed post URLs, hreflang on every post page and feed root.

Features:
- F2 — blog post feed moves from `/$lang/blog` to the locale root (`/` for en, `/pt-br/` for pt-br).
- F3 — post URLs adopt `/<slug>` (en) and `/pt-br/<slug>` (pt-br). Delete `/`, `/blog`, `/<slug>` redirect shim routes.
- Hreflang pairs render on post detail and feed root in both locales.

Success criteria to proceed to Phase 3:
- `/` and `/pt-br/` render the post feed for the respective locale.
- Post detail pages at `/<slug>` and `/pt-br/<slug>` render end-to-end with hreflang pairs.
- CI green on the merged commit.
- Manual curl audit confirms hreflang pairs on the 4 locale-aware page types in scope for Phase 2.

### Phase 3 — Content and i18n contract

User-visible outcome: real About content per locale, locale switcher relabeled to own-language form.

Features:
- F4 — About migrates to MDX per locale at `content/en/about.mdx` and `content/pt-br/about.mdx`. Indie-dev minimal structure.
- F5 — typed `UIStrings` contract module ships. V1 keys populated: locale switcher labels (own-language), post meta labels, locale-aware 404 copy. Other keys present as TODOs.
- F8 — `content/en/lorem-ipsum.mdx` moves to `app/tests/fixtures/`. Two affected tests rewritten for locale-aware About routing.
- Locale switcher in header displays "English" / "Português".
- Hreflang pairs extend to the About route in both locales.

Success criteria for V1 completion:
- `/about` and `/pt-br/about` render MDX content from the matching `content/<locale>/about.mdx` file.
- `UIStrings` module exports a typed `Record<Locale, UIStrings>` validated by a Zod schema; V1 keys are populated; module load succeeds.
- Locale switcher renders own-language labels.
- All affected tests pass against the new locale-aware About.
- Lorem fixture lives in `app/tests/fixtures/` and is not indexed by the content indexer.
- Zero mocked-data matches remain in `app/routes/` and `app/components/`.

## Success Metrics

User-facing:
- Visitor lands on `/` and sees real post content within first paint (no redirect chain).
- Visitor on About sees real, clickable social links — no generic placeholder URLs.
- Portuguese visitor can identify the locale switcher by its own-language label.
- Portuguese visitor visiting an untranslated post sees the English version with a clear notice instead of an error.

Quality:
- CI `make test` + `make lint` + `make check` green on every phase merge.
- Zero broken visitor-facing links in header, footer, and `__root.tsx` 404 page.
- Zero mocked-data instances in `app/routes/` and `app/components/` per measurement.
- Hreflang pairs present on every locale-aware page type per manual curl audit.
- After a clean deploy, the admin dashboard at `/admin/` renders one row per `.mdx` file in `content/` with no manual sync step required.

Engagement (longer-term observation, non-blocking):
- Per LinkGraph 2026 industry data, new locale pages typically index in 2-8 weeks. Track Google Search Console for `/pt-br/*` coverage in the first 60 days post-V1.
- Per DigitalApplied 2026, 75% of multilingual sites have hreflang errors; V1 success means we are in the correct 25%.

## Risks and Mitigations

### Adoption and visibility

- **SEO churn for indexed legacy URLs**. `/tutorials`, `/projects`, and `/blog` may be indexed by search engines; deletion creates 404 responses for those crawlers. Mitigation: WIP status accepts the temporary 404 surface; if Search Console reports meaningful volume, escalate to a 410 Gone response post-V1.
- **Visitor confusion during phased transitions**. Three discrete visitor-visible changes within V1. Mitigation: Phase 1 is strictly subtractive (no content path URL changes); Phases 2 and 3 each ship coherent, internally consistent improvements. No mid-phase URL flux.

### Author and content

- **About MDX schema drift across locales**. Portuguese About may be written months after English About, by the same author who no longer remembers the field contract. Silent rendering failures (empty `links[]` block) are the worst case. Mitigation: Zod schema validates frontmatter at indexer time; missing required fields fail the indexer loudly.
- **Locale-pair authoring burden**. Every new English post creates an implicit Portuguese translation backlog. Mitigation: V1 accepts asymmetry; the translation banner sets expectations cleanly. V2 stretch goal of auto-scaffolded stubs is noted in `_idea.md`.

### Dependency and external

- **TanStack Router optional-param compatibility with `$lang.tsx`**. Phase 2 routing primitive may need rework. Mitigation: prototype in a scratch branch during Phase 1 before committing the Phase 2 design.
- **Visitor expectation gap during V1.5 (between Phase 2 and Phase 3)**. After Phase 2 ships, About will still live at the legacy `/about` route without locale awareness, while the rest of the site is locale-prefixed. Mitigation: Phase 3 closes the gap within days; Phase 2 PR description explicitly notes the temporary inconsistency.
- **Indexer sync failure during deploy**. After F9 lands, a malformed `.mdx` file or transient DB error during `bun run sync` will fail the entire deploy. Mitigation: pre-merge smoke pass of `bun run sync` against current `content/` confirms clean state before Phase 1 ships; failures during deploy log loudly so the cause is obvious.

### Timeline

- **Phase 3 design surface is largest**. About content shape, UIStrings module, and test rewrites all land together. Risk of scope creep on About sections. Mitigation: ADR-001 strictly enumerates V1 UIStrings keys; About sections fixed to "indie-dev minimal" via clarifying question; deviations require a new ADR.

## Architecture Decision Records

- [ADR-001: V1 Scope for Site Restructure and Organic Content](adrs/adr-001.md) — Accepted typed i18n contract with V1 partial population, free-body About MDX with typed Zod frontmatter, and post-feed home with URL-prefix locale strategy.
- [ADR-002: 3-Phase Rollout for Site Restructure V1](adrs/adr-002.md) — Accepted 3-phase delivery: (1) slim down, (2) route restructure, (3) content + i18n contract.
- [ADR-003: Fold Post Indexing Stabilization into V1 Phase 1](adrs/adr-003.md) — Accepted addition of F9 (`bun run sync` in deploy workflow + initial sync at dev boot) to Phase 1 scope.

## Open Questions

- **TanStack Router primitive for default-locale `/` collapse**. Optional `{-$locale}` path-param idiom versus an explicit `/` route plus `/$lang/*` routes sharing a component. Deferred to TechSpec phase.
- **About storage strategy**. Reuse the `posts` table with a `kind` column (e.g., `post` vs `about`) or create a separate `about_content` table. Deferred to TechSpec.
- **Locale switch behavior on pages with no equivalent**. When a visitor on `/about` clicks "Português" before `content/pt-br/about.mdx` exists, the switcher could (a) navigate to `/pt-br/about` and render a "not yet available" stub, (b) fall back to `/pt-br/` feed root, or (c) disable the switcher with tooltip. Recommend (b) for consistency with post-detail fallback UX; confirm in TechSpec.
- **About photo asset location**. The indie-dev minimal structure includes a photo. Whether it lives in `public/`, is imported via the asset pipeline, or sits next to the MDX file is a TechSpec decision.
- **`/robots.txt` content**. Allow-all is the V1 baseline. Whether the file should include a `Sitemap:` directive is moot until `/sitemap.xml` exists (V2). Recommend allow-all without a Sitemap directive for V1.
- **404 page hreflang**. Whether the 404 page should render hreflang pairs to the equivalent 404 in the other locale is a minor SEO question; deferred to TechSpec.
- **F9 dev-boot integration point**. Whether `syncAll` runs as a vite plugin hook, a wrapper script, or a TanStack Start server-start hook is a TechSpec decision. Deploy-side integration is clearer (workflow step in `cd.yml`).
- **F9 sync failure behavior on deploy**. Whether the workflow should hard-fail (block deploy) or soft-fail (deploy with warning). Recommend hard-fail; revisit if false-positive sync errors become frequent.

