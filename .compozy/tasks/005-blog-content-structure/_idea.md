---
title: "TASK-0005: Blog Content Structure — Multilingual Schema, Image Folders & Branch Naming"
slug: 005-blog-content-structure
status: draft
date: 2026-05-07
---

## Overview

Establish a scalable, bilingual content schema for the blog: locale-based folder organization (`content/en/`, `content/pt-br/`), frontmatter conventions (category, series, draft, lang), DB columns to store and query those fields (including a `lang` column with a revised unique constraint), an image asset folder pattern, and git branch naming for post authoring. V1 ships conventions + DB schema only. Locale-aware URL routing and language switcher UI are deferred to a dedicated i18n routing task.

**Who it is for:** Antonio, writing posts in both English and Portuguese, so every publish decision — which folder, which fields, which branch — has a documented answer with no cognitive overhead.

**Why now:** At 3 posts and zero locales, retrofitting is still cheap. The DB change (`slug` unique constraint → `(slug, lang)` composite) is trivial on an empty-ish table. At 50 bilingual posts it's a painful migration with risk of data loss.

**Ambition:** Quick Win — one DB migration, one schema update, documented conventions.

## Problem

The `content/` directory holds 3 flat English-only MDX files. Current frontmatter carries `title`, `slug`, `description`, `publishedAt`. The DB schema (`posts` table) has `slug text UNIQUE` — a constraint that breaks immediately when the same post exists in two languages with the same slug.

Three pain points compound as bilingual content grows:

**Constraint collision.** `content/en/react-suspense.mdx` and `content/pt-br/react-suspense.mdx` both resolve to `slug: react-suspense`. The current DB UNIQUE constraint on `slug` rejects the second insert. Without a `(slug, lang)` composite unique, the indexer cannot handle bilingual content at all.

**No language signal in the DB.** The indexer derives nothing from the file path currently. The blog has no way to query "all English posts" or "all Portuguese posts." Serving the right language to the right reader is impossible without a `lang` column.

**Discoverability gap and asset chaos.** Same problems as a monolingual blog but compounded: categories, series, and image folders need to be consistent across locales. A series of 4 posts in Portuguese and the same series translated to English must be structurally linked, not just by prose references.

### Market Data

From Contentlayer, Velite, Astro, Fumadocs docs (2024-2025):
- Astro has first-class i18n routing (`i18n.defaultLocale`, `i18n.locales`) with locale-based `content/[locale]/` directories — the industry standard pattern for static-site blogs
- Fumadocs uses `content/[locale]/docs/` for multilingual documentation
- `lang` as a frontmatter field OR path-derived locale (from parent directory name) are both common; path-derivation is preferred because it's impossible to forget
- Series: `series: string` + `seriesPart: number` in frontmatter — translations of the same series share the same `series` slug
- Image assets: `public/images/<slug>/` (locale-agnostic) is simpler than `public/images/<lang>/<slug>/` when images are shared across translations (most common case)

## Core Features

| # | Feature | Priority | Description |
|---|---------|----------|-------------|
| F1 | Locale folder structure | Critical | Move/reorganize `content/` into `content/en/` and `content/pt-br/` subdirectories. Update the watcher and indexer path patterns to scan both. Document folder convention in `CONTENT.md`. |
| F2 | DB schema: `lang` + composite unique | Critical | Add `lang text NOT NULL DEFAULT 'en'` column to `posts` table. Drop `UNIQUE` on `slug`; add `UNIQUE(slug, lang)`. Indexer derives `lang` from the `content/<lang>/` parent directory name — no frontmatter field required. Generate Drizzle migration. |
| F3 | Frontmatter schema | High | Define canonical frontmatter fields beyond existing `title/slug/description/publishedAt`: `category` (one of 6 controlled values), `series` (string slug), `seriesPart` (integer), `draft` (boolean). Documented in `CONTENT.md`. `lang` is path-derived, not a frontmatter field. |
| F4 | DB schema: category, series, draft | High | Add `category text`, `series text`, `seriesPart integer`, `draft boolean` nullable columns to `posts` table. Update indexer to read and persist these fields. Same migration as F2. |
| F5 | Image folder convention | High | Define `public/images/<post-slug>/` as the canonical image location (locale-agnostic — images are shared across translations by default). Document `cover` frontmatter field as `images/<slug>/cover.jpg`. No code change — convention only. |
| F6 | Branch naming for posts | Medium | Define `post/<lang>/<slug>` as the git branch pattern for new posts (e.g., `post/en/react-suspense`, `post/pt-br/react-suspense`). Add to `.agents/rules/git-workflow.md`. |
| F7 | Frontmatter CI lint rule | Medium | Add a Vitest test that reads all MDX files under `content/` and asserts each has `title`, `description`, and `publishedAt`. Catches missing required fields before merge. |

## KPIs

| KPI | Target | How to Measure |
|-----|--------|---------------|
| Zero slug constraint violations in indexer | 0 errors after DB migration on all existing posts | `make test` + indexer re-run |
| Author decision time for new post setup | < 2 min from `git checkout -b` to first frontmatter field | Manual timing on next post publish |
| All posts carry `lang` column correctly | 100% of rows have non-null `lang` after migration | `SELECT COUNT(*) FROM posts WHERE lang IS NULL` |
| Category field populated on all posts | 100% of published posts within 30 days of ship | `SELECT COUNT(*) FROM posts WHERE category IS NULL AND is_published = true` |
| Zero CI failures from missing frontmatter | 0 regressions on `make test` after lint rule added | CI run on all PRs |
| First Portuguese post indexed correctly | `lang = 'pt-br'` row appears in DB after adding first pt-br file | DB query after first pt-br post |

## Feature Assessment

| Criteria | Question | Score |
|----------|----------|-------|
| **Impact** | How much more valuable does this make the product? | Must do |
| **Reach** | What % of users would this affect? | Must do |
| **Frequency** | How often would users encounter this value? | Strong |
| **Differentiation** | Does this set us apart or just match competitors? | Maybe |
| **Defensibility** | Is this easy to copy or does it compound over time? | Strong |
| **Feasibility** | Can we actually build this? | Must do |

**Leverage type:** Quick Win — one DB migration, one indexer update, permanent structural clarity for bilingual growth.

## Council Insights

- **Recommended approach:** Add `lang` column + composite `(slug, lang)` unique constraint in the same migration as category/series columns. Derive `lang` from the `content/<lang>/` folder path — no frontmatter field to forget. Image assets stay locale-agnostic (`public/images/<slug>/`) since most images are shared across translations.
- **Key trade-offs:** Path-derived `lang` vs. frontmatter `lang` field (council: path-derivation is simpler and unambiguous — the directory name IS the locale). Fixed category vocabulary vs. emergent (resolved: soft list, plain text column, not a DB enum).
- **Risks identified:** `(slug, lang)` composite constraint means slugs must be the same across translations of the same post — if a Portuguese slug is different (e.g., translated title), the link between translations is lost. Mitigation: document that slug is always the English canonical form regardless of locale.
- **Stretch goal (V2+):** Locale-aware routing (`/en/blog/`, `/pt-br/blog/`), language switcher UI, browser-locale redirect, and series navigation with per-language awareness.

## Integration with Existing Features

| Integration Point | How |
|---|---|
| `app/db/schema.ts` | Add `lang text NOT NULL DEFAULT 'en'`; drop `slug UNIQUE`; add `UNIQUE(slug, lang)`; add `category text`, `series text`, `seriesPart integer`, `draft boolean` (all nullable) |
| `app/db/indexer.ts` | Derive `lang` from parent directory name (`content/en/` → `'en'`); read `category`, `series`, `seriesPart`, `draft` from frontmatter; update upsert target to `(filePath)` (unchanged — filePath is already unique per locale) |
| `app/lib/watcher.server.ts` | Ensure the watcher scans `content/en/**` and `content/pt-br/**` (currently scans a single `contentDir`; may need to accept multiple dirs or a glob) |
| `app/db/queries.ts` | Update `getPublishedPostsFn` to filter `draft IS NOT TRUE`; optionally accept `lang` parameter in V2 |
| `.agents/rules/git-workflow.md` | Add `post/<lang>/<slug>` branch pattern |
| `app/tests/` | Add frontmatter lint test covering all `content/**/*.mdx` |

## Out of Scope (V1)

- **Locale-aware URL routing** (`/en/blog/`, `/pt-br/blog/`) — requires TanStack Router i18n layout; dedicated task; no posts to route yet
- **Language switcher UI** — depends on locale routing being in place first
- **Browser-locale redirect** — depends on locale routing
- **Category filter UI** — no posts to filter; deferred to V2 when posts > 10
- **Series navigation component** — no series exists yet; deferred to V2
- **Per-language image variants** — images shared across translations in V1 (`public/images/<slug>/`); locale-specific images deferred until needed
- **`tags[]` DB column** — stored in frontmatter only in V1; DB column deferred until filtering is needed
- **DB enum for category** — plain text preferred; no migration cost when vocabulary evolves

## Architecture Decision Records

- [ADR-001: V1 scope — conventions + DB schema, no UI filtering](adrs/adr-001.md) — adds DB columns now while migration is cheap; defers UI to V2

## Open Questions

1. **Slug canonicity across locales:** Should the Portuguese translation of "react-suspense" always use `slug: react-suspense` (English canonical), or can it use a translated slug (e.g., `slug: suspense-react`)? If translated slugs are allowed, a `translationKey` field is needed to link them.
2. **Watcher multi-directory:** `watcher.server.ts` currently accepts a single `contentDir`. Should it be updated to scan multiple directories, or scan the parent `content/` directory recursively (already works but derives `lang` from subdir name)?
3. **Default locale handling:** For existing posts currently at `content/lorem-ipsum.mdx`, they need to move to `content/en/lorem-ipsum.mdx`. Should this migration happen in this task or in a follow-up?
4. **Category controlled list:** From the session: `frontend`, `backend`, `algorithms`, `infra`, `career`, `tooling`. Should the CI lint rule validate against this list (throw on unknown category) or remain advisory?
