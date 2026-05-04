---
status: completed
title: Public Blog Routes
type: frontend
complexity: medium
dependencies:
  - task_03
  - task_05
  - task_08
---

# Task 9: Public Blog Routes

## Overview

Implement the two public-facing blog routes: the post list (`/`) and the post detail (`/$slug`). The list displays published posts ordered by date with excerpts. The detail page reads the `.mdx` file from disk, compiles it server-side, renders it with Tailwind typography styles, increments the view counter on each visit, and populates page-level SEO meta tags from frontmatter. Both routes are server-rendered with no client-side data fetching.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST implement `getPublishedPosts()` server function returning `Post[]` where `is_published = true`, ordered by `published_at DESC`
- MUST implement `getPostBySlug(slug: string)` server function returning `{ post: Post, source: string }` for published posts; throw a 404 response for drafts or missing slugs
- MUST implement `incrementViewCount(id: number)` server function that increments `view_count` by 1; called in the post detail route loader
- MUST render MDX content server-side using `renderMdx` from `app/lib/mdx.server.ts`
- MUST apply `prose` Tailwind typography classes to the MDX content container
- MUST set `<title>`, `<meta name="description">`, and `<meta property="og:title">` / `<meta property="og:description">` from frontmatter `title` and `description` fields
- MUST NOT expose draft posts via public routes — `/$slug` for a draft post must return 404
- MUST use semantic HTML: `<article>`, `<main>`, `<time>` for publication date
</requirements>

## Subtasks

- [x] 9.1 Implement `getPublishedPosts()` and `getPostBySlug()` server functions in `app/routes/index.tsx` and `app/routes/$slug.tsx` respectively
- [x] 9.2 Implement `incrementViewCount()` server function and call it in the post detail route's loader
- [x] 9.3 Build the post list page UI — title, date, and excerpt per post; `<main>` and `<article>` landmarks
- [x] 9.4 Build the post detail page UI — post title as `<h1>`, `<time>` date, MDX content wrapped in a `prose` container
- [x] 9.5 Add SEO meta tags using TanStack Start's head management for `title`, `description`, and OG tags
- [x] 9.6 Import and apply Tailwind global CSS (`app/styles/global.css`) in the root layout if not already done

## Implementation Details

See TechSpec "API Endpoints" for the server function signatures. See TechSpec "System Architecture" data flow section for the read path: route loader → Drizzle query → read file from disk → `renderMdx` → React SSR.

Server functions in TanStack Start use `createServerFn` — see TechSpec for patterns. Do not duplicate server function code here; reference the TechSpec "API Endpoints" table.

### Relevant Files

- `app/routes/index.tsx` — new file; post list route
- `app/routes/$slug.tsx` — new file; post detail route
- `app/styles/global.css` (task_01) — Tailwind directives; imported in root layout
- `app/routes/__root.tsx` (task_01, task_10) — root layout; ensure Tailwind CSS is loaded
- `app/lib/mdx.server.ts` (task_08) — `renderMdx` and `parseFrontmatter`
- `app/db/schema.ts` (task_03) — `Post` type
- `app/db/client.ts` (task_03) — `db` instance for server functions

### Dependent Files

- `app/routes/admin/preview.$slug.tsx` (task_11) — reuses similar MDX rendering pattern; may share a render utility

### Related ADRs

- [ADR-002: Content Model and Sync Strategy](adrs/adr-002.md) — public routes query `is_published = true`; content always read from disk at render time
- [ADR-003: MDX Compilation — @mdx-js/mdx Direct](adrs/adr-003.md) — `renderMdx` used here must not run on client

## Deliverables

- `app/routes/index.tsx` — post list page
- `app/routes/$slug.tsx` — post detail page with view counter
- Server functions: `getPublishedPosts`, `getPostBySlug`, `incrementViewCount`
- Unit tests with 80%+ coverage **(REQUIRED)**
- Integration tests for route behavior **(REQUIRED)**

## Tests

- Unit tests:
  - [x] `getPublishedPosts()` returns only rows where `is_published = true`
  - [x] `getPublishedPosts()` orders results by `published_at DESC`
  - [x] `getPostBySlug('missing-slug')` throws a 404 response
  - [x] `getPostBySlug` for a draft post (`is_published = false`) throws a 404 response
  - [x] `incrementViewCount(id)` issues a SQL `view_count + 1` update for the given `id`
- Integration tests (skipIf no DB at port 5432 or no server at port 3000):
  - [x] `GET /` returns 200 and lists only published posts (seed 1 published + 1 draft; assert only 1 appears)
  - [x] `GET /:slug` returns 200, includes `<h1>`, and renders MDX content
  - [x] `GET /:slug` twice increments `view_count` by at least 2 in the database
  - [x] `GET /draft-slug` (is_published = false) returns 404
  - [x] `GET /:slug` response `<head>` contains `<title>` matching the post's frontmatter `title`
- Test coverage target: >=80%
- All tests must pass

## Success Criteria

- All tests passing
- Test coverage >=80%
- Draft posts return 404 on public routes
- View counter increments on each visit to a published post detail page
- OG meta tags are present in the HTML `<head>` for each post
