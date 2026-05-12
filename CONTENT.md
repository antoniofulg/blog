# Content Authoring Guide

Authoritative reference for creating and maintaining blog posts. Read before creating a new post.

## Folder Structure

```
content/
  en/          ← English posts (*.mdx)
  pt-br/       ← Portuguese posts (*.mdx)
```

Each file in `content/en/` is served at `/en/<slug>`. Each file in `content/pt-br/` is served at `/pt-br/<slug>`.

The `lang` field is **not** set in frontmatter — it is automatically derived from the directory name.

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
| `draft` | boolean | Set `true` to exclude from the published listing. Omit to publish. |
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

- Slugs are **English-canonical**: use the same slug for both the English and Portuguese versions of a post (e.g. `react-suspense-typescript` in both `content/en/` and `content/pt-br/`).
- Slugs are **lowercase kebab-case** with no dots or underscores.
- The slug is the linking key for the language switcher — if slugs differ between locales, the switcher cannot link them.
- Series slugs follow the same conventions: `react-performance`, not `ReactPerformance`.

## Branch Naming

Use `post/<lang>/<slug>` for content branches:

```
post/en/react-suspense-typescript    # new English post
post/pt-br/react-suspense-typescript # Portuguese translation
```

This is an advisory pattern. The GitHub Ruleset does not enforce it, but agents and authors should follow it for consistency. Task branches continue to use `TASK-XXXX/short-description`.

## Locale Routing

| URL | Content |
|---|---|
| `/en/blog` | English post listing |
| `/pt-br/blog` | Portuguese post listing |
| `/en/<slug>` | English post |
| `/pt-br/<slug>` | Portuguese post |
| `/blog` | Redirects to `/en/blog` (backward compat) |
| `/<slug>` | Redirects to `/en/<slug>` (backward compat) |

When a translation is missing, the reader sees the available version with a translation notice — no 404.

## CI Enforcement

The frontmatter lint test (`app/tests/mdx.test.ts`) blocks CI if:

1. Any required field (`title`, `description`, `publishedAt`, `slug`) is missing or empty.
2. `category` is set to a value not in the controlled list.
3. `series` is set without `seriesPart`, or `seriesPart` is set without `series`.

All posts under `content/` must pass the lint before merge.
