# Content Authoring Guide

Authoritative reference for creating and maintaining blog posts and static pages. Read before creating a new post.

## Folder Structure

```
app/content/
  posts/
    en/          ← English posts (*.mdx)
    pt-br/       ← Portuguese posts (*.mdx)
  pages/
    en/          ← English static pages (*.mdx)
    pt-br/       ← Portuguese static pages (*.mdx)
```

Each file in `app/content/posts/en/` is served at `/en/<slug>`. Each file in `app/content/posts/pt-br/` is served at `/pt-br/<slug>`.

Static pages under `app/content/pages/<locale>/` are also served at `/<locale>/<slug>` via the same dynamic slug route — see [Static Pages](#static-pages).

The `lang` field is **not** set in frontmatter — it is automatically derived from the directory name.

## Publish Workflow

**File presence is the only publish signal.** There is no `published`, `draft`, or toggle field in frontmatter — these fields do not exist and are not honored.

- **Publish**: commit `app/content/posts/<locale>/<slug>.mdx`, open a PR, merge. The post goes live on the next deploy.
- **Unpublish**: `git rm app/content/posts/<locale>/<slug>.mdx`, commit, push, merge. The route 404s on the next deploy.

No admin toggle, no flag flip, no post-merge step. Write → commit → push → merge → done.

> See ADR-005: Unified `$slug` loader resolves posts + static pages, posts win on collision.

## Frontmatter Schema

### Required Fields

| Field | Type | Example |
|---|---|---|
| `title` | string | `"React Suspense in TypeScript"` |
| `description` | string | `"Short summary for the listing page."` |
| `publishedAt` | YYYY-MM-DD | `2026-05-07` |
| `slug` | string | `react-suspense-typescript` |

### Optional Fields

| Field | Type | Description |
|---|---|---|
| `category` | one of 6 values | Topic classification. See [Category Vocabulary](#category-vocabulary). |
| `series` | string | English-canonical series slug (e.g. `react-performance`). |
| `seriesPart` | integer | 1-based position within the series. Required when `series` is set. |
| `cover` | string | Relative path under `public/` (e.g. `images/react-suspense/cover.jpg`). |

`series` and `seriesPart` are interdependent — both must be set together or both omitted. CI blocks a post that sets one without the other.

### Example Frontmatter

```yaml
---
title: "React Suspense in TypeScript"
slug: react-suspense-typescript
description: "Replace isLoading spaghetti with tree-level loading boundaries."
publishedAt: 2026-05-07
category: frontend
series: react-performance
seriesPart: 2
---
```

## Category Vocabulary

Exactly six categories are valid. CI blocks any other value.

| Value | Use for |
|---|---|
| `frontend` | React, CSS, browser APIs, UI patterns |
| `backend` | APIs, server logic, auth, databases |
| `algorithms` | Data structures, algorithm walkthroughs |
| `infra` | DevOps, Docker, CI/CD, cloud infrastructure |
| `career` | Soft skills, job searching, growth |
| `tooling` | IDEs, linters, build tools, developer experience |

## Image Convention

Post images live at `public/images/<slug>/`. Both language versions of a post share the same images — images are locale-agnostic.

For `slug: react-suspense-typescript`:
- Cover: `public/images/react-suspense-typescript/cover.jpg`
- Inline: `public/images/react-suspense-typescript/diagram.png`

Reference in MDX with a root-relative path: `![Alt text](/images/react-suspense-typescript/cover.jpg)`

## Slug Rules

- Slugs are **English-canonical**: use the same slug for both the English and Portuguese versions of a post (e.g. `react-suspense-typescript` in both `app/content/posts/en/` and `app/content/posts/pt-br/`).
- Slugs are **lowercase kebab-case** with no dots or underscores.
- The slug is the linking key for the language switcher — if slugs differ between locales, the switcher cannot link them.
- Series slugs follow the same conventions: `react-performance`, not `ReactPerformance`.

## Static Pages

Static pages (e.g. `/about`, `/uses`, `/now`) live under `app/content/pages/<locale>/<slug>.mdx`.

**Adding a new page is a content-only change**: drop the MDX file in the correct locale directory — no route file, no loader edit.

```
app/content/pages/en/uses.mdx    → served at /en/uses
app/content/pages/pt-br/uses.mdx → served at /pt-br/uses
```

The same frontmatter schema applies (required: `title`, `description`, `publishedAt`, `slug`).

### Slug Collision Policy

Posts and static pages share the slug namespace. If a post slug and a page slug match for the same locale, **the post wins at runtime** — the static page is silently unreachable for that locale. The content-audit pipeline flags collisions as a `slug-collision` warning so the author can resolve them before the next deploy.

> See ADR-001: Static-pages storage = filesystem-only, encapsulated module.
> See ADR-005: Unified `$slug` loader resolves posts + static pages, posts win on collision.

## Language Switcher

The header's language menu shows one item per locale. Each item carries an availability state for the current route:

- **Available** (twin exists): the item renders normally. Click → navigate directly to the twin in that language.
- **Unavailable** (no twin): the item renders with a `(not available)` hint and `aria-disabled` semantics but stays clickable.

Clicking an unavailable item opens a confirm modal **in the current page's language**:

> "This content is not available in [target language]. You will be redirected to the home page in [target language]. Continue?"

- **Confirm** → navigate to the target-locale home page.
- **Cancel** → stay on the current page.

Availability hint logic applies only to content routes (posts and static pages). Structural routes (homepage, tag pages, 404) always render both items as available. The language menu does not render at all on `/admin/*`.

> See ADR-003: Language-switcher UX = per-menu-item availability hint + confirm modal.

## Branch Naming

Use `post/<lang>/<slug>` for content branches:

```
post/en/react-suspense-typescript    # new English post
post/pt-br/react-suspense-typescript # Portuguese translation
```

The `branch-check` CI job and the GitHub Ruleset both enforce this pattern. Non-content branches use `<type>/short-description` with `<type>` from the commitlint list (`feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `ci`, `hotfix`).

## Locale Routing

| URL | Content |
|---|---|
| `/` | English homepage (post listing) — default locale, no prefix |
| `/en/` | English homepage — explicit-prefix alias of `/` |
| `/pt-br/` | Portuguese homepage (post listing) |
| `/<slug>` | English post or static page (default locale, no prefix) |
| `/en/<slug>` | English post or static page — explicit-prefix alias of `/<slug>` |
| `/pt-br/<slug>` | Portuguese post or static page |

When a translation is missing, the reader sees the language menu with an availability hint — see [Language Switcher](#language-switcher).

## Admin Surface

The `/admin` route is **read-only**. It provides:

- A list of every post (title, slug, locale, twin-status indicator).
- A locale filter (English / Portuguese (BR) / both).
- A "View" button per post that opens the public URL in a new tab.

There is no create, edit, delete, or publish-toggle UI. The author manages content through the filesystem and git — `/admin` is an observer surface, not a write surface.

## CI Enforcement

The frontmatter lint test (`app/tests/mdx.test.ts`) blocks CI if:

1. Any required field (`title`, `description`, `publishedAt`, `slug`) is missing or empty.
2. `category` is set to a value not in the controlled list.
3. `series` is set without `seriesPart`, or `seriesPart` is set without `series`.

All posts under `app/content/posts/` and pages under `app/content/pages/` must pass the lint before merge.
