# Idea — Posts Publish Refactor

## Overview

The blog ships with three vestigial constraints that fight a solo author and confuse bilingual readers: a `published` boolean column on every post that no frontmatter writes to, a static-page (`/about`) loader that exists outside the content pipeline, and a language switcher that drops readers to the locale homepage when the target translation does not exist. This idea collapses all three into one refactor: file presence becomes the only post-visibility signal, static pages get a first-class directory convention (`app/content/pages/<locale>/<slug>.mdx`) with a single encapsulated access module, and the switcher fires a confirm modal on missing twins instead of silently soft-redirecting.

The audience is the solo technical author (write MDX, `git commit`, push) and the bilingual reader (lands on a post, expects the switcher to land on the same post in the other language or to be told why it cannot). V1 is deliberately narrow — no DB indexing for static pages, no pre-click switcher hint, no admin write affordances — because the corpus is two fixture posts and the leverage is in correctness, not features.

## Problem

Three independent annoyances compound into a high-friction system. **(1) Publish flag is dead weight.** `posts.isPublished` is a NOT NULL boolean default `false`, but no frontmatter field writes to it and the indexer hardcodes `false` on every upsert (`app/db/indexer.ts:97`, intentionally skipped in `onConflictDoUpdate` at `:117`). Three lookup paths in `app/routes/{-$locale}/$slug.server.ts:43,60,77` filter by `eq(posts.isPublished, true)`. The author has no UX to flip the flag except a `togglePublishedFn` in admin that exists solely to satisfy the constraint the same admin imposed. Every new post is born invisible and stays invisible until the author hits a toggle they had to invent. **(2) Static pages live outside the pattern.** The `/about` page reads `app/content/<locale>/about.mdx` via `app/lib/mdx/about.server.ts`. Adding `/uses` or `/now` requires copy-pasting the loader, the route, and the test fixtures — a per-page convention that scales linearly with effort. **(3) Switcher is broken UX.** `useLangSwitcher` in `app/components/layout/header.tsx:49-71` hardcodes branches for blog / about / `$slug` and falls back to the locale root for everything else. Click the switcher on a tag page → land on the homepage. Click on a post without a twin → land on the homepage with no explanation. SimpleLocalize and Magefan both call this the #1 i18n switcher anti-pattern.

Current corpus is 2 e2e fixture posts. Migration risk is near zero — there is no real content trapped behind the publish flag, no real static pages waiting on a convention, no real reader population habituated to the broken switcher. This is the cheapest possible moment to fix all three.

### Market Data

| Tool | Publish gate | Static pages | Locale fallback |
|---|---|---|---|
| Astro | `draft: boolean`, default false | `src/pages/*.mdx` colocated | configurable per-locale |
| Next.js | community `published` flag | `app/<page>/page.mdx` colocated | hreflang only when twin exists |
| Hugo | native `draft: true` | `content/<page>.md` | omits missing translations from menu |
| Eleventy | manual `draft: true` | route-as-code | hand-rolled |

- File-presence gating is non-dominant in the ecosystem (Astro/Hugo/Eleventy all default to a `draft` flag). The accepted trade-off: WIP commits = instant publish. Mitigation: branch-based drafts — unmerged PRs are the staging area.
- TanStack Router's idiomatic locale switcher is `<Link params={(prev) => ({ ...prev, locale })}>` — function-form params preserves the current route. Already supported in this codebase; just unused in `header.tsx:49-71`.
- Asymmetric hreflang is a top-5 international-SEO mistake (Search Engine Journal). Emit `<link rel="alternate" hreflang>` only when a twin exists.

## Core Features

| # | Feature | Priority | Description |
|---|---|---|---|
| F1 | Drop `published` flag end-to-end | Critical | Remove `posts.isPublished` column, all `eq(posts.isPublished, true)` filters, the admin toggle UI + server fn, the indexer's hardcoded value, and all test fixtures referencing the field. File presence under `app/content/posts/<locale>/` becomes the only visibility signal — `git rm` is unpublish. |
| F2 | Fix language switcher with confirm-modal fallback | Critical | Replace the hardcoded `if`-chain with TanStack Router's `<Link params={(prev) => ...}>`. When target twin is absent (via `PostEntry.hasTwin` for posts, `staticPageHasTwin` for pages), open a confirm modal: "Content not available in [target lang], redirect to home?" — confirm → target-locale home; cancel → stay. |
| F3 | Static-pages directory convention | High | Introduce `app/content/pages/<locale>/<slug>.mdx`. Move `about.mdx` into the new location. Add `app/lib/mdx/pages.server.ts` exposing `loadStaticPage`, `staticPageHasTwin`, `enumerateStaticPages` as the single entry point for all page access — no DB row, no indexer extension. |
| F4 | Asymmetric-hreflang emit | High | Render `<link rel="alternate" hreflang>` per route only when the twin exists. Posts use `PostEntry.hasTwin`; pages use `staticPageHasTwin`. |
| F5 | Trim admin to list-only | Medium | Keep `/admin/index` as a post list; each row exposes a "View" button opening the public URL in a new tab. Delete `togglePublishedFn`, edit/new routes, and `/admin/preview/$slug` entirely. Target ≤ 100 LOC across `app/routes/admin/**` (from 262 today). |
| F6 | Extend content-audit to pages | Medium | Wire `enumerateStaticPages` into the content-audit pipeline so the translation-parity rule applies to pages identically to posts. |

## KPIs

| KPI | Target | How to Measure |
|---|---|---|
| Steps from "post written" to "post live" | 1 (single `git commit && git push`) | Manual workflow count, before vs after |
| `/admin/preview/$slug` request count per week | 0 | Server access logs after route deletion (404s remain visible) |
| Language-switch redirects to locale-home when a twin exists | 0% | E2E spec: switch on every fixture post with both twins present, assert URL = twin slug |
| Admin LOC | < 100 (down from 262) | `wc -l app/routes/admin/**` |
| Static page added without a code change | True | Smoke test: drop `app/content/pages/en/uses.mdx`, dev server picks it up, route renders, audit + sitemap include it — zero route or loader edits |
| Asymmetric `hreflang` violations on sitemap | 0 | Audit step: walk emitted `<link rel="alternate">` tags; cross-reference twin file presence |

## Feature Assessment

| Criteria | Question | Score |
|---|---|---|
| **Impact** | How much more valuable does this make the product? | Strong (eliminates 3 separate friction sources for author + reader) |
| **Reach** | What % of users would this affect? | Must do (author = 100%; reader = 100% on any switcher click) |
| **Frequency** | How often would users encounter this value? | Strong (every post write, every switcher click) |
| **Differentiation** | Does this set us apart or just match competitors? | Maybe (file-presence gating + confirm-modal switcher are uncommon, but mostly correctness work) |
| **Defensibility** | Is this easy to copy or does it compound over time? | Pass (correctness, not moat) |
| **Feasibility** | Can we actually build this? | Must do (~2.5 days end-to-end across the three concerns) |

Leverage type: **Quick Win** (correctness refactor with a single compounding hook — the static-pages convention enables low-cost future pages).

## Council Insights

- **Recommended approach:** Ship the bundled refactor. Static pages go filesystem-only via a single encapsulated `pages.server.ts` module (ADR-001). Switcher uses modal-only UX globally for V1 (ADR-002); the pre-click hint is explicitly deferred to V2.
- **Key trade-offs:** Two resolution strategies (posts via DB, pages via filesystem) for "does a translation exist?" — contained behind one module so the seam stays visible and upgradeable. Modal-only switcher trades reader expectation-setting for behavioral consistency and a zero-loader-contract implementation surface.
- **Risks identified:**
  - WIP commits publish instantly (accepted; mitigation = branch-based drafts via unmerged PRs).
  - `existsSync` calls for pages can leak outside the module if no guardrail exists. *Mitigation*: implementation includes a lint rule or grep-based audit flagging direct `app/content/pages` access outside `pages.server.ts`.
  - Modal fatigue if the switcher fires the modal on most clicks during corpus build-out. *Mitigation*: V2 trigger conditions documented in ADR-002 (post count > 10 AND fewer than 50% have twins, OR modal-dismiss rate > 60% over 30 days, OR direct user feedback).
  - Switcher must query the correct twin source per route type. *Mitigation*: single `getTwinAvailabilityForCurrentRoute()` helper covering posts / pages / other.
- **Stretch goal (V2+):** Translation-aware reading layer — surface translation state in-content (post header "available in: 🇺🇸 EN · 🇧🇷 PT-BR"), per-locale RSS feeds with hreflang refs, content-audit translation-coverage dashboard. Compounds with every translated post. Triggered when the V2 trigger conditions in ADR-002 fire or the corpus exceeds 10 posts.

## Integration with Existing Features

| Integration Point | How |
|---|---|
| `app/db/schema.ts` + `indexer.ts` | Remove `isPublished` column; indexer continues to upsert posts with no schema-level visibility gate. |
| `app/db/queries.ts` | Strip `eq(posts.isPublished, true)` from `getPublishedPostsFn`; rename function if "Published" suffix is now misleading. |
| `app/routes/{-$locale}/$slug.server.ts` | Drop the three `isPublished` filters across exact / alt / fallback lookup paths. |
| `app/lib/site-model.server.ts` | `getLatestPublishedSlug` becomes `getLatestPostSlug`; `PostEntry.hasTwin` (already exposed at `:268-279`) stays as the post-twin source for the switcher. |
| `app/lib/mdx/about.server.ts` | Replaced by `app/lib/mdx/pages.server.ts`; `about.tsx` route calls `loadStaticPage("about", locale)`. |
| `app/components/layout/header.tsx` | `useLangSwitcher` rewritten to use `<Link params={(prev) => ...}>` + modal trigger via `getTwinAvailabilityForCurrentRoute()` helper. |
| `app/routes/admin/**` | `index.tsx` trimmed to view-only list; `index.server.ts` keeps `getAllPostsFn`, drops `togglePublishedFn`; `preview.$slug.tsx` + `.server.ts` deleted entirely. |
| `app/tests/**` | All `isPublished` fixtures stripped from `admin-routes.test.ts`, `indexer.test.ts`, `lang-slug-route.test.ts`, `site-model.test.ts`. New tests for `pages.server.ts` module + switcher modal. |
| Content-audit skill | Add `enumerateStaticPages` call so translation-gap parity rule applies to pages. |

## Sub-Features

The bundled idea naturally decomposes into three implementation sub-scopes that can be sequenced within a single PR or split into stacked PRs:

- **SF1 — Drop publish flag** — DB migration removing `isPublished`, code path removal across queries / route loaders / site-model / indexer / admin, fixture cleanup. Single largest test-fixture impact.
- **SF2 — Static-pages convention** — Create `pages.server.ts` module, migrate `about.mdx`, update `about.tsx` route, wire sitemap + content-audit. Smallest blast radius (no DB changes).
- **SF3 — Switcher fix + hreflang** — Rewrite `useLangSwitcher`, add confirm modal component, add `getTwinAvailabilityForCurrentRoute()` helper, update hreflang emission. Touches header + every page's `<head>`.

## Out of Scope (V1)

- **Pre-click switcher hint ("(not translated)" marker)** — Deferred to V2 per ADR-002. Requires either a per-loader contract (invisible-failure-mode risk) or a build-time twin manifest (scope inflation for unvalidated user pain).
- **Indexing static pages into the DB** — Deferred per ADR-001. Trigger to revisit: static-page count > 5, OR any future feature requires queryable per-page metadata (per-page analytics, scheduled publishing, page-level status dashboard).
- **Admin write affordances (create / edit / delete from UI)** — Author writes MDX in their editor. Admin stays read-only for V1 (list + view-in-new-tab). V2 may add a metrics dashboard and translation-gap visibility.
- **Branch-preview deploys (per-branch public preview URLs)** — Adjacent opportunity surfaced in opportunity scan; requires infra refactor (wildcard DNS + Traefik or nginx label-based routing). VPS / Docker stack does not get this free; cost ≫ author value at solo scale.
- **Translation-aware in-content reading layer** — Stretch goal in council insights. Premature for current corpus (2 fixture posts); revisit after V1 ships and engagement data exists.
- **Scheduled publishing** — File-presence gating is incompatible. Accepted trade-off; if ever needed, would require either a frontmatter `publishAt` field + cron-driven indexer or returning to a flag-based model.

## Architecture Decision Records

- [ADR-001: Static-pages storage = filesystem-only, encapsulated module](adrs/adr-001.md) — Pages stay on disk; all access goes through `app/lib/mdx/pages.server.ts`; no DB indexing for low-cardinality structural content.
- [ADR-002: Language-switcher missing-twin UX = modal-only for V1](adrs/adr-002.md) — Switcher button stays plain; modal is the first signal of a missing twin; pre-click hint deferred to V2 with documented trigger conditions.

## Open Questions

- **Q-O1**: Should `getPublishedPostsFn` be renamed after the filter is removed? Candidate names: `getAllPostsFn` (collides with the admin server fn), `listPostsFn`, `getPostsFn`. Pick during PRD task breakdown.
- **Q-O2**: Does the content-audit `translation-gap` rule require any code change beyond walking `pages/<locale>/`, or is the existing parity check generic enough to drop in once `enumerateStaticPages` is wired? Verify during implementation; if not generic, factor the per-locale parity check into a shared helper.
- **Q-O3**: Confirm modal — reusable shadcn / Radix dialog already in the codebase, or new primitive? Read `app/components/ui/` during PRD phase; reuse if available.
- **Q-O4**: When a route has no concept of "twin" (e.g., 404, admin), should the switcher still render? Default proposed: render the switcher button; clicking it treats current route as "no twin" → modal fires → confirm redirects to target-locale home. Confirm during PRD.
- **Q-O5**: Lint rule or grep-based check to enforce ADR-001's encapsulation (`app/content/pages` access only inside `pages.server.ts`)? Implementation choice: eslint custom rule vs. CI grep step. Decide during PRD.
