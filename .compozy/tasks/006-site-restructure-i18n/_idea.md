# Site Restructure: Organic Content with Locale Foundation

## Overview

The blog is a WIP personal tech site running on TanStack Start + Better Auth + Drizzle + PostgreSQL. Several pages render mocked arrays inline in route files, two routes are placeholder stubs ("Em breve" newsletter, empty search), the post feed lives behind a redirect shim at `/$lang/blog`, and the About page hardcodes profile, stack, experience, and fake social links. Existing locale infrastructure — `app/lib/locale.tsx` primitives, `$lang` routes, `posts.lang` column, `content/en` + `content/pt-br` directories — is well-built but underutilized.

This idea V1 removes every mocked surface, makes the post feed the homepage `/`, adopts a URL-prefix locale strategy (`/` English, `/pt-br/` Portuguese), and migrates About to MDX-per-locale with a typed Zod frontmatter. It locks a typed `Record<Locale, UIStrings>` i18n contract in V1 while deferring full string extraction until Portuguese content actually exists. The goal is to eliminate fake surface area, exercise the dormant locale infrastructure end-to-end, and ship a foundation that compounds across future content and locale work without paying a retrofit tax.

V1 is bounded and largely subtractive. It is not a moat in itself; it removes the obstacles that block credible content shipping.

## Problem

The blog currently fails three concrete tests of credibility and shipping discipline.

First, mocked data is everywhere a visitor looks. The Tutorials page renders four hardcoded series with progress bars that go nowhere. The Projects page lists three projects whose github and demo URLs both point to literal `"#"`. The About page lists six tech logos in a hand-built array, three "experience" cards with PT-BR placeholder copy, and three social icons whose hrefs are `https://github.com`, `https://linkedin.com`, `https://twitter.com` — generic site roots, not real profiles. A hiring manager or recruiter (per [Gola Supply 2026](https://www.gola.supply/blog/developer-portfolio-websites), 93% of them visit personal sites when provided) sees this and bounces.

Second, the structure is incoherent. The route tree shows `/`, `/blog`, and `/<slug>` as three separate redirect shims to `/$lang/*`, while `/$lang/blog` is where the actual feed lives. Header `NAV_LABELS` are hardcoded in English and Portuguese arrays inside the component file. Footer link arrays use 100% Portuguese labels regardless of selected locale, and link to `/feed.xml`, `/sitemap.xml`, `/robots.txt` — none of which exist (the routes return 404). The post-feed-as-home pattern is the dominant minimalist personal blog approach in 2026 (HackerNoon, Marketer Milk, Medium minimalist references), and the existing structure inverts it for no benefit.

Third, locale parity is asymmetric and brittle. `app/lib/locale.tsx` exports `Locale = "en" | "pt-br"`, the DB has a `lang` column with `(slug, lang)` unique constraint, and content directories exist for both — but only `content/en/` has files (and one of those is a `lorem-ipsum.mdx` test fixture). About has zero locale awareness. Tests reference the non-locale `/about` route. The infrastructure was built but never exercised.

### Market Data

- 75% of multilingual sites have hreflang errors that fragment rankings ([DigitalApplied 2026](https://www.digitalapplied.com/blog/international-seo-2026-hreflang-multilingual-guide)).
- Correctly-implemented hreflang yields 15-30% regional organic traffic lift within Q1 ([ClickRank 2026](https://www.clickrank.ai/hreflang-tags-complete-guide/)).
- 40-60% of traffic comes from non-primary markets within 18 months for 3+ market sites (ClickRank).
- New locale pages index in 2-8 weeks; meaningful traffic growth at months 5-8 ([LinkGraph 2026](https://www.linkgraph.com/blog/hreflang-implementation-guide/)).
- 93% of hiring managers visit personal sites when provided ([Gola Supply 2026](https://www.gola.supply/blog/developer-portfolio-websites)).
- Default-locale no-prefix is the recommended TanStack Router pattern; pure-prefix (forcing `/en/`) creates a "useless root" problem ([TanStack Router Discussion #2713](https://github.com/TanStack/router/discussions/2713)).

## Summary / Differentiator

Personal tech blog 2026 trend: minimalist post-feed-as-home + editorial multi-locale MDX + zero scaffolding waste. The differentiator here is that the locale infrastructure already exists — V1 is mostly subtraction (delete mocks + redirect shims) plus a thin contract layer (typed UIStrings with Zod). The industry-typical alternative — keep a landing page, bolt on i18n later — is slower, more expensive, and looks dated next to indie-dev minimalist competitors.

## Core Features

| # | Feature | Priority | Description |
|---|---|---|---|
| F1 | Delete mocked routes and stubs | Critical | Remove `tutorials.tsx`, `tutorials.$seriesSlug.tsx`, `projects.tsx`, `newsletter.tsx`, `search.tsx`, `blog.tsx`, `index.tsx`, `$slug.tsx`, and `components/tutorial-step.tsx`. Update header/footer nav arrays. Regenerate `routeTree.gen.ts`. |
| F2 | Blog post feed becomes `/` | Critical | English feed renders at `/`; Portuguese feed at `/pt-br/`. Default-locale collapse uses TanStack Router optional-param idiom or explicit `/` route plus `/$lang/*` routes with shared component. No Accept-Language auto-redirect. |
| F3 | Post URLs adopt locale prefix | Critical | English posts at `/<slug>`; Portuguese at `/pt-br/<slug>`. Same slug across locales. Hreflang `<link rel="alternate">` pairs render on each post per locale. |
| F4 | About migrates to MDX per locale | Critical | New files `content/en/about.mdx` and `content/pt-br/about.mdx`. Indexer recognizes About as singleton content (separate from posts). Zod frontmatter: required `title`, `locale`; structured optional `links[]` (each with `label`, `url`, `kind`); bio + narrative live in MDX body. |
| F5 | Typed i18n UI string contract | High | New module `app/lib/i18n/strings.ts` exporting `type UIStrings` + `const strings: Record<Locale, UIStrings>` + Zod schema. V1 populates only the keys pt-br post rendering needs (locale switcher label, post meta labels, locale-aware 404 copy). Header nav, footer, brand copy keys defined in the type as TODOs but strings stay hardcoded — V2 extraction becomes an additive diff. |
| F6 | Footer and header cleanup | High | Remove `Tutorials` and `Projects` from `NAV_LABELS` and footer `navLinks`. Remove broken links to `/feed.xml`, `/sitemap.xml`. Keep header locale switcher and theme toggle. |
| F7 | Static `/robots.txt` | Medium | Five-line route allowing all crawlers and pointing to canonical host. Removes 404 from common SEO audit tools and standard crawler probes. |
| F8 | Fixture move and test rewrites | Medium | Move `content/en/lorem-ipsum.mdx` to `app/tests/fixtures/lorem-ipsum.mdx`; update test references. Rewrite `public-routes.test.ts:154` and `header.test.ts:149` to assert locale-aware About routing. |

## KPIs

| KPI | Target | How to Measure |
|---|---|---|
| Mocked data instances in `app/routes/` and `app/components/` | 0 (from ~10+) | `rg "mock\|placeholder\|lorem\|TODO\|fake\|github\.com\|linkedin\.com\|twitter\.com" app/routes app/components` returns 0 matches in user-facing files |
| User-facing pages with en + pt-br parity | 100% | Manual GET each of `/`, `/<slug>`, `/about`, `/pt-br/`, `/pt-br/<slug>`, `/pt-br/about`, 404 paths — all render valid content or documented fallback |
| Hreflang alternate pairs on locale-aware pages | 100% | Curl each locale-aware URL; assert both `<link rel="alternate" hreflang="en">` and `hreflang="pt-br">` present on every locale-aware page |
| Routes and components deleted | ≥ 9 files | `git diff --name-status main -- app/routes/ app/components/` shows ≥ 8 routes and ≥ 1 component as `D` |
| `make check` + `make test` + `make lint` after merge | Green | CI workflow `ci.yml` passes on the merged commit |
| Broken footer/header links | 0 (from 4+) | Manually audit final `header.tsx` and `footer.tsx` link arrays; every href resolves to a 200 in dev server |

## Feature Assessment

| Criteria | Question | Score |
|---|---|---|
| **Impact** | How much more valuable does this make the product? | Strong |
| **Reach** | What % of users would this affect? | Must do |
| **Frequency** | How often would users encounter this value? | Must do |
| **Differentiation** | Does this set us apart or just match competitors? | Maybe |
| **Defensibility** | Is this easy to copy or does it compound over time? | Strong |
| **Feasibility** | Can we actually build this? | Must do |

Leverage type: **Quick Win + Compounding Feature.** Immediate credibility uplift (remove fake socials and stub pages) plus long-term velocity (organic content = no code edits per copy change; typed i18n contract = no V2 retrofit).

## Council Insights

- **Recommended approach:** Adopt the V1 scope above. Lock typed `Record<Locale, UIStrings>` + Zod schema in V1 but populate only what pt-br post rendering needs. About uses free-body MDX with typed Zod frontmatter (required `title` + `locale`; structured `links[]`; prose in body). Default-locale `/` always renders English (no Accept-Language auto-redirect).
- **Key trade-offs:**
  - Lock i18n format in V1 (small upfront cost) vs defer it (high retrofit cost when pt-br content lands).
  - Free-body About (low maintenance) vs typed Zod schema (loud failures); resolved by typing only routing-critical and structured-rendering fields, leaving prose in body.
  - Ship `/robots.txt` in V1 (5 lines, removes broken link) vs defer; ship; defer `/sitemap.xml` and `/feed.xml` to V2.
- **Risks identified:**
  - Default-locale `/` collision when adding `/pt-br/` child routes — TanStack Router optional `{-$locale}` may interact awkwardly with `$lang.tsx`; prototype during PRD/TechSpec phase.
  - Indexer-side Zod failures could block deploys if pt-br About frontmatter drifts — mitigation: keep frontmatter schema minimal, optional fields default to empty.
  - SEO churn on `/tutorials`, `/projects`, `/blog` if indexed by Google — accept 404s; WIP status justifies; consider 410 Gone later if reach matters.
  - i18n scope drift pressure during V1 — mitigation: ADR-001 strictly enumerates V1 keys; deviations require a new ADR.
- **Stretch goal (V2+):** Auto-scaffold pt-br companion post stub when an English post is added. Indexer detects missing locale pair and emits a draft `.mdx` at the matching path with copied frontmatter plus `<!-- TODO: translate -->`. Converts absence-of-pt-br-content from silent gap to tracked backlog item. Listing UI shows "pt-br translation pending" badge.

## Out of Scope (V1)

- **Full nav, footer, and brand UI string extraction** — Speculative work for a locale with zero readers; keys defined in `UIStrings` type as TODO comments so V2 extraction is an additive diff, not a retrofit.
- **`/sitemap.xml` route** — Deferred until post volume and SEO ambition justify maintenance overhead; broken footer link removed in V1.
- **`/feed.xml` RSS route** — Deferred until reader feedback signals real demand; broken footer link removed in V1.
- **Newsletter provider integration** — `/newsletter` was a placeholder ("Em breve", disabled form, no provider chosen); deletion is V1, integration is a separate idea.
- **Search implementation** — `/search` was an empty stub; content volume does not yet justify the indexing and UI work.
- **Auto-scaffold pt-br companion posts** — V2 candidate (stretch goal); depends on V1 indexer + About migration landing cleanly.
- **Accept-Language auto-redirect on `/`** — Explicit locale routing only; auto-redirect adds cache-hostile complexity and breaks bot indexing.
- **Admin UI changes** — `app/routes/admin/*` is untouched; admin authoring workflow remains as-is.

## Integration with Existing Features

| Integration Point | How |
|---|---|
| `app/lib/locale.tsx` | Reuse `Locale` type, `LOCALES`, `DEFAULT_LOCALE`, `detectLocaleFromRequest`, `LocaleProvider`. No changes needed. |
| `app/routes/$lang.tsx` | Locale layout used by post feed, post detail, About. May be promoted to handle `/` default-locale collapse. |
| `app/db/schema.ts` `posts.lang` | Unchanged. About storage strategy (separate table vs reuse posts) deferred to TechSpec. |
| `app/db/indexer.ts` | Extend to index About MDX files as singleton content type, or build a sibling `about-indexer.ts`. Frontmatter validated via Zod. |
| `app/lib/mdx/parser.server.ts`, `renderer.server.ts` | Reused for About body rendering. |
| `app/components/layout/header.tsx`, `footer.tsx` | Remove Tutorials and Projects nav items; remove broken `/feed.xml`, `/sitemap.xml` links; eventually consume `UIStrings` module (V1 partial; V2 full). |
| `routeTree.gen.ts` | Auto-regenerates after route deletions and moves via `bunx tsr generate` or dev server. |
| `app/tests/public-routes.test.ts`, `header.test.ts` | Rewrite 2 affected tests to assert locale-aware About routing. |
| `app/tests/fixtures/` (new) | Receives `lorem-ipsum.mdx` moved from `content/en/`. |

## Architecture Decision Records

- [ADR-001: V1 Scope for Site Restructure and Organic Content](adrs/adr-001.md) — Accepted typed i18n contract (V1 partial population) + free-body About MDX with typed Zod frontmatter + post-feed home with URL-prefix locale strategy.

## Open Questions

- **Routing primitive choice:** TanStack Router optional `{-$locale}` path-param idiom vs explicit `/` route plus `/$lang/*` routes sharing a component? Prototype during PRD or TechSpec phase; both viable.
- **Indexer extension vs sibling module:** Extend `app/db/indexer.ts` to handle About as singleton content type, or build `app/db/about-indexer.ts`? Decision affects DB schema (separate `about_content` table vs reusing `posts` with a `kind` column).
- **`/robots.txt` implementation:** Static file in `public/` vs TanStack Start route handler? Both work; pick during implementation based on existing static asset patterns.
- **Test rewrite scope:** Update affected tests in the same PR as route changes, or stage as follow-up PR? Same PR keeps CI green continuously; recommend same PR.
- **Hreflang on non-post pages:** Apply hreflang to About + post feed root, or only post detail? V1 scope says all locale-aware pages — confirm in PRD that About + feed root pages get pairs too.

