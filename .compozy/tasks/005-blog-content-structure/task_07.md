---
status: completed
title: Locale Post Detail Route + Translation Notice
type: frontend
complexity: medium
dependencies:
  - task_03
  - task_05
---

# Task 07: Locale Post Detail Route + Translation Notice

## Overview

Create `app/components/ui/translation-notice.tsx` — a symmetric notice banner shown when a post is served in a different locale than requested. Create `app/routes/$lang/$slug.tsx` — the locale-aware post detail route with a two-query fallback loader: try `(slug, requestedLang)` first, fall back to any available locale, then 404. Renders `<TranslationNotice />` when serving a fallback locale.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST create `app/components/ui/translation-notice.tsx` accepting `requestedLang: Locale` and `availableLang: Locale` props; renders a localized message (e.g., "Este post não está disponível em Português — mostrando versão em Inglês")
- MUST create `app/routes/$lang/$slug.tsx` as `createFileRoute('/$lang/$slug')` with a two-query loader per TechSpec "Post detail loader result" spec
- MUST implement symmetric fallback: (1) query `(slug, requestedLang)`; (2) if miss, query `WHERE slug = ? LIMIT 1`; (3) if no row, throw `notFound()`
- MUST return `{ post, html, requestedLang, notTranslated, availableLang }` from loader
- MUST render `<TranslationNotice />` when `notTranslated === true`
- MUST increment view count for the post that was actually served (not the requested locale)
- MUST render MDX content via `renderMdx` (same as current `$slug.tsx`)
- MUST display `post.publishedAt`, `post.title`, `post.description` in the post header
</requirements>

## Subtasks

- [x] 7.1 Create `app/components/ui/translation-notice.tsx` — symmetric notice with `requestedLang` and `availableLang` props
- [x] 7.2 Create `app/routes/$lang/$slug.tsx` — two-query loader: try `(slug, lang)`, then `slug` across all locales, then 404
- [x] 7.3 Port MDX rendering, view count increment, and head meta from current `app/routes/$slug.tsx` to new route
- [x] 7.4 Render `<TranslationNotice />` when `notTranslated === true`
- [x] 7.5 Verify `/en/react-suspense` serves English; `/pt-br/react-suspense` fallback serves English with notice

## Implementation Details

See TechSpec "Core Interfaces → Post detail loader result" for the complete loader return type and the three fallback steps. See TechSpec "Core Interfaces → Locale detection utility — View count per language" for confirmation that `incrementViewCount` uses `post.id` and already targets the correct row.

The current `app/routes/$slug.tsx` contains the MDX rendering pattern, view count increment with `useEffect`, and head meta — port these patterns verbatim into the new locale-aware route.

The `getPostBySlugFn` server function in `$lang/$slug.tsx` replaces the one in the current `$slug.tsx`. Update it to accept `(slug: string, lang: Locale)` and implement the two-query fallback.

### Relevant Files

- `app/routes/$slug.tsx` — reference for MDX rendering, head meta, view count increment pattern (do NOT modify here; task_08 handles that)
- `app/lib/mdx/renderer.server.ts` — `renderMdx` import for server-side MDX compilation
- `app/db/queries.ts` — `getPublishedPostsFn` updated in task_03; new `getPostBySlugFn` variant queries by `(slug, lang)` then fallback
- `app/db/client.ts` — DB client for two-query fallback
- `app/db/schema.ts` — `posts` table schema with `lang` column (from task_01)

### Dependent Files

- `app/routeTree.gen.ts` — auto-regenerated; must show `$lang/$slug` nested under `$lang`
- `app/tests/public-routes.test.ts` — add tests for the fallback behavior
- `app/routes/$slug.tsx` — task_08 converts this to a redirect; this new route takes over post rendering

### Related ADRs

- [ADR-004: Technical architecture — `$lang` layout route, localStorage locale, English fallback rendering](adrs/adr-004.md) — symmetric fallback design; two-query loader rationale; `notTranslated` flag

## Deliverables

- `app/components/ui/translation-notice.tsx` with symmetric message
- `app/routes/$lang/$slug.tsx` with two-query loader and fallback rendering
- `/en/<slug>` serves English posts; `/pt-br/<slug>` with no pt-br row serves English with `<TranslationNotice />`
- `tsc --noEmit` exits 0
- `make test` exits 0

## Tests

- Unit tests:
  - [x] `tsc --noEmit` passes — loader return type matches `PostLoaderResult`; `TranslationNotice` props typed correctly
  - [x] Loader mock: `(slug='react-suspense', lang='pt-br')` → no pt-br row → second query returns en row → `notTranslated: true`, `availableLang: 'en'`
  - [x] Loader mock: `(slug='react-suspense', lang='en')` → no en row → second query returns pt-br row → `notTranslated: true`, `availableLang: 'pt-br'`
  - [x] Loader mock: `(slug='missing', lang='en')` → both queries miss → `notFound()` thrown
  - [x] Loader mock: `(slug='react-suspense', lang='en')` → en row found → `notTranslated: false`
  - [x] `<TranslationNotice requestedLang="pt-br" availableLang="en" />` renders without error
- Integration tests:
  - [x] `GET /en/react-suspense` → 200, renders post title, no translation notice (skipped when server not running)
  - [x] `GET /pt-br/react-suspense` (no pt-br post) → 200, renders English content with translation notice visible (skipped when server not running)
  - [x] `GET /en/nonexistent` → 404 (skipped when server not running)
- Test coverage target: >=80% on loader function and `TranslationNotice` component
- All tests must pass

## Success Criteria

- All tests passing (`make test`)
- `tsc --noEmit` exits 0
- `/en/react-suspense` renders post without translation notice
- `/pt-br/react-suspense` renders English content with `<TranslationNotice />` visible
- Missing slug in any locale returns 404
- View count increments on the correct per-locale post row
