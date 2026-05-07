---
title: "TASK-0005: Blog Content Structure — Multilingual Schema, Locale Routing & Language Switcher"
slug: 005-blog-content-structure
status: approved
date: 2026-05-07
---

## Overview

Establish a fully functional bilingual blog: locale-based folder structure (`content/en/`, `content/pt-br/`), a canonical frontmatter schema, a database migration for language and content metadata, locale-aware URL routing (`/en/`, `/pt-br/`), separate blog listing pages per language, a persistent header language switcher, and `hreflang` meta tags. All changes ship in one atomic PR. After this task, the author can publish in English or Portuguese and readers can access both languages immediately.

**Who it is for:** Antonio, writing posts in English and Portuguese, so that every publish decision has a documented answer and readers can discover and switch between language versions without friction.

**Why now:** Establishing locale structure, DB schema, and routing before bilingual content exists eliminates all retroactive migration work. Adding the routing alongside the data foundation delivers a complete, functional feature rather than a half-built one that blocks Portuguese publishing.

## Goals

1. A new post in either language can be published in under 2 minutes from `git checkout -b` to first frontmatter field, with no structural decisions required.
2. After the PR merges, the author can add a file to `content/pt-br/` and it is immediately accessible to readers at `/pt-br/<slug>`.
3. All 3 existing posts migrate to `content/en/` with no data loss; their URLs redirect from `/<slug>` to `/en/<slug>`.
4. The language switcher in the header links readers to the same post in the alternate locale, or to the locale listing when no translation exists.
5. Every published post carries a valid category from the controlled list, enforced by CI before merge.
6. The content conventions are documented in a single `CONTENT.md` file so any future author or agent can orient in one read.

## User Stories

**As Antonio writing a new post,** I want to create a file in `content/en/` or `content/pt-br/`, fill in documented frontmatter fields, push on a `post/<lang>/<slug>` branch, and have the post appear at `/en/<slug>` or `/pt-br/<slug>` after merge — so that the publishing workflow requires no structural decisions.

**As Antonio writing a Portuguese translation,** I want to use the same English-canonical slug as the English version so that the language switcher can automatically link the two versions without additional configuration.

**As a reader on an English post,** I want to see a language switcher in the header that takes me to the Portuguese version when one exists, or to `/pt-br/blog` when it doesn't — so I can explore content in my preferred language.

**As a reader who bookmarked `/blog`** (the old listing URL), I want to be redirected to `/en/blog` automatically — so that existing links continue to work after the routing change.

**As a reader on `/pt-br/blog`,** I want to see only Portuguese posts in the listing — so I don't encounter posts I can't read mixed into my feed.

**As a search engine,** I want `hreflang` meta tags on every post page that link the English and Portuguese versions — so the correct language version is served to the correct audience.

**As an AI agent starting a session,** I want to read `CONTENT.md` and immediately know the folder structure, frontmatter fields, category vocabulary, and branch naming — so I can create or modify posts without asking orientation questions.

## Core Features

### F1 — Locale Folder Structure

The `content/` directory is reorganized into two locale subdirectories:

```
content/
  en/          ← all English posts
  pt-br/       ← all Portuguese posts
```

The 3 existing posts migrate to `content/en/` in the same PR. A `.gitkeep` placeholder holds `content/pt-br/` until the first Portuguese post is written. The watcher already monitors subdirectories recursively when given the `content/` parent directory — no code change required.

### F2 — Database Schema: Language Column + Composite Unique

The `posts` table gains a `lang` column (`text NOT NULL DEFAULT 'en'`). The current `UNIQUE` constraint on `slug` is replaced with a composite `UNIQUE(slug, lang)`. The `filePath` column remains the primary upsert target since file paths are globally unique across locales.

The indexer derives `lang` from the file path: `content/en/react-suspense.mdx` → `lang = 'en'`; `content/pt-br/react-suspense.mdx` → `lang = 'pt-br'`. No author action required.

### F3 — Database Schema: Category, Series, Draft

Four additional nullable columns are added in the same migration:

| Column | Type | Purpose |
|---|---|---|
| `category` | `text` | One of 6 controlled values |
| `series` | `text` | English-canonical series slug |
| `seriesPart` | `integer` | Position within the series (1-based) |
| `draft` | `boolean` | Excludes post from published queries when true |

The indexer reads these fields from frontmatter and persists them. The published post query is updated to exclude `draft = true` posts.

### F4 — Frontmatter Schema & CONTENT.md

`CONTENT.md` at repo root documents the canonical frontmatter schema.

**Required fields:** `title`, `description`, `publishedAt` (YYYY-MM-DD), `slug` (English-canonical, same across all locales).

**Optional fields:** `category` (one of: `frontend`, `backend`, `algorithms`, `infra`, `career`, `tooling`), `series` (English-canonical slug), `seriesPart` (integer; required when `series` is set), `draft` (boolean; omit to publish), `cover` (e.g., `images/react-suspense/cover.jpg`).

The `lang` field is **not** in frontmatter — it is derived from the directory.

`CONTENT.md` also documents: category list, image folder convention, branch naming, series slug rules, and locale routing URL structure.

### F5 — Locale URL Routing

Blog pages are served under locale-prefixed paths:

| Path | Content |
|---|---|
| `/en/blog` | English post listing |
| `/pt-br/blog` | Portuguese post listing |
| `/en/<slug>` | English post detail |
| `/pt-br/<slug>` | Portuguese post detail |

The old routes (`/blog`, `/<slug>`) redirect to their `/en/` equivalents to preserve backward compatibility for existing links and bookmarks. English is the default locale.

Each listing page fetches only posts matching its locale. The post detail route uses the locale prefix to determine which `lang` value to query.

### F6 — Language Switcher

A persistent language switcher appears in the header on all pages. It links to:
- The same post in the alternate locale, when a translation with the same slug exists in the DB
- The locale listing (`/pt-br/blog` or `/en/blog`) when no translation exists

The switcher displays the current locale and the alternate, always visible — not buried in a footer or hamburger menu.

### F7 — `hreflang` Meta Tags

Post detail pages include `hreflang` meta tags in `<head>` linking the English and Portuguese versions when both exist in the DB. This enables search engines to serve the correct language version without auto-redirecting readers.

### F8 — Image Folder Convention

Post images live at `public/images/<slug>/` (locale-agnostic — both language versions of a post share the same images). Documented in `CONTENT.md`. No code change required.

### F9 — Branch Naming for Posts

`post/<lang>/<slug>` is defined as the git branch pattern for new posts (e.g., `post/en/react-suspense`). Added to `.agents/rules/git-workflow.md` as an advisory pattern.

### F10 — Frontmatter CI Lint Rule

A Vitest test scans all MDX files under `content/` and blocks CI if:
1. `title`, `description`, `publishedAt`, or `slug` are missing or empty.
2. `category` is set but not in the controlled list.
3. `series` is set without `seriesPart` or vice versa.

## User Experience

**Author experience:** Every structural decision is pre-made. Create a file in the right locale folder, fill documented frontmatter from `CONTENT.md`, push on a `post/<lang>/<slug>` branch. After the PR merges, the post is live at the correct locale URL.

**Reader experience:** Two separate, clean listing pages — one per language. Each post page has a visible language switcher in the header. No mixed-language feeds, no auto-redirects based on browser locale (readers choose explicitly).

**Transition for existing readers:** `/blog` redirects to `/en/blog`. `/<slug>` redirects to `/en/<slug>`. All existing URLs continue to work.

**Agent experience:** `CONTENT.md` answers every structural question in one read — folder, frontmatter, categories, images, branches.

## High-Level Technical Constraints

- `lang` must be derived from the file path directory name, not from frontmatter, to make it impossible to misconfigure.
- All slugs are English-canonical — the same slug is used for both locale versions of a post. This is the linking mechanism for the language switcher.
- The composite `(slug, lang)` uniqueness constraint replaces the current `slug UNIQUE` constraint.
- Old routes `/blog` and `/<slug>` must redirect to `/en/blog` and `/en/<slug>` to preserve backward compatibility.
- The language switcher must be visible on every page without being triggered by browser locale — reader choice is manual.
- All changes must pass `make test`, `make lint`, and `make check` before merge.

## Non-Goals (Out of Scope)

- **Browser-locale auto-redirect** — poor UX; developers often prefer reading in a non-native language; explicitly excluded
- **Category filter UI on blog listing** — deferred to V2 when posts > 10 per category
- **Series navigation component** (prev/next within series) — deferred to V2 when a series exists
- **Per-language image variants** — images shared across translations; locale-specific images deferred until a real need arises
- **`tags[]` DB column** — stored in frontmatter only; DB column deferred until filtering is needed
- **GitHub Ruleset update for `post/<lang>/<slug>`** — advisory pattern only
- **Reading time display** — deferred to V2 (word count computation)
- **Subdomain or separate-domain approach** (`en.blog.com`) — subdirectory routing is Google-preferred and preserves domain authority

## Phased Rollout Plan

### Phase 1 — This Task (Atomic PR)

All 10 features delivered in `TASK-0005/blog-content-structure`:
- Locale folder structure + existing posts migrated to `content/en/`
- DB migration (lang, category, series, seriesPart, draft columns; composite unique)
- Indexer update (path-derived lang, new field reads, draft filter)
- Locale URL routing + redirect from old routes
- Language switcher in header
- `hreflang` meta tags on post pages
- `CONTENT.md` conventions document
- Git workflow rule update
- CI frontmatter lint with blocking category enforcement

**Exit criterion:** All tests pass, 3 existing posts indexed at `content/en/` with `lang = 'en'`, `/en/blog` lists them correctly, language switcher visible in header, `/blog` redirects to `/en/blog`.

### Phase 2 — Content Growth (Future Task)

When posts > 10 and categories are validated by real usage:
- Category filter UI on listing pages
- Series navigation component (prev/next)
- Reading time display

**Exit criterion:** ≥2 categories with ≥3 posts each; ≥1 series with ≥2 parts.

### Phase 3 — Content Maturity (Future Task)

When first translation pair exists:
- Verify `hreflang` tags are correct in Search Console
- Add language-specific sitemap entries
- Review switcher UX based on reader behavior

## Success Metrics

| Metric | Target | How to Measure |
|---|---|---|
| Author setup time per new post | < 2 minutes | Manual timing on next post |
| Zero slug constraint violations | 0 indexer errors after migration | `make test` + re-index |
| `lang` populated on all posts | 100% non-null after migration | `SELECT COUNT(*) FROM posts WHERE lang IS NULL` |
| `/blog` redirect working | HTTP 301 to `/en/blog` | `curl -I /blog` |
| Language switcher visible | Present on all post and listing pages | Manual dev server test |
| CI lint blocking bad frontmatter | 0 invalid posts merge | CI run history |
| First Portuguese post live | Accessible at `/pt-br/<slug>` after file added | Browser test |

## Risks and Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Author uses non-English slug on pt-BR post | Medium | `CONTENT.md` documents the rule; language switcher silently falls back to listing if slugs don't match — no crash, just degraded UX |
| Category vocabulary proves wrong after 10 posts | Medium | Plain-text column, not DB enum — vocabulary change requires only frontmatter edits and lint rule update |
| Redirect from old routes breaks something unexpected | Low | Both `/blog` and `/$slug` redirects are tested in `make test` before merge |
| Language switcher shows wrong language when no translation | Low | Switcher links to locale listing (safe fallback) when no matching `(slug, lang)` row exists in DB |
| `CONTENT.md` drifts from actual conventions | Low | `.agents/rules/` domain files reinforce the same rules for AI agents; both updated together |

## Architecture Decision Records

- [ADR-001: V1 scope — conventions + DB schema, no UI filtering](adrs/adr-001.md) — established initial data-foundation-only scope
- [ADR-002: Atomic single-PR delivery strategy](adrs/adr-002.md) — all changes in one PR to avoid interim broken state between file structure and DB schema
- [ADR-003: Expand V1 scope to include locale routing and language switcher](adrs/adr-003.md) — routing added to make bilingual publishing functional end-to-end

## Open Questions

1. **Series slug canonicity:** Should `series` values be English-canonical even when a series is written first in Portuguese? Document the answer in `CONTENT.md`.
2. **Draft visibility in admin dashboard:** Should `draft: true` posts appear in the admin dashboard alongside `isPublished: false` posts, or be completely hidden? The admin route currently bypasses `isPublished`.
3. **`syncAll` scope after locale move:** Confirm that `syncAll` is called with `content/` (parent) as its root, not a locale-specific subdirectory — otherwise orphan cleanup only runs for one locale.
4. **`/pt-br/blog` with zero posts:** What does the listing page show when no Portuguese posts exist? Empty state with a message, or redirect to `/en/blog`?
