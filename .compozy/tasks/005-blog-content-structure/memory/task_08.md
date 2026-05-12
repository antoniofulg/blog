# Task Memory: task_08.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Convert `app/routes/index.tsx`, `app/routes/blog.tsx`, `app/routes/$slug.tsx` from data-fetching routes to redirect routes using `detectLocaleFromRequest(getRequest())` in a `createServerFn`.

## Important Decisions

- Used `createServerFn` wrapper for `detectLocaleFromRequest(getRequest())` — `getRequest()` requires server function context, not available directly in route loader
- Pattern: `const detectLocale = createServerFn({ method: "GET" }).handler(() => detectLocaleFromRequest(getRequest()))` then `throw redirect(...)` in loader
- Removed all UI components from `index.tsx` (HeroSection, RecentPosts, CategoriesSection, SeriesSection, NewsletterSection all deleted)

## Learnings

- `getRequest()` from `@tanstack/react-start/server` only works inside `createServerFn` handlers, confirmed by `__root.tsx` usage pattern
- `public-routes.test.ts` had stale `makePost` without `lang`/`category`/`series`/`seriesPart`/`draft` fields — updated to match current schema

## Files / Surfaces

- `app/routes/index.tsx` — replaced entire file (was 266 lines, now 16 lines)
- `app/routes/blog.tsx` — replaced entire file (was 78 lines, now 16 lines)
- `app/routes/$slug.tsx` — replaced entire file (was 116 lines, now 16 lines)
- `app/tests/public-routes.test.ts` — removed getPostBySlugFn/incrementViewCountFn unit tests; added redirect integration tests; fixed makePost to include new schema fields

## Errors / Corrections

None.

## Ready for Next Run

- task_08 complete — all three legacy routes are now redirect-only
- Integration tests (18 skipped) need running server on port 3000 to execute
- task_09 (Language Switcher in Header) is next pending task
