# Task Memory: task_09.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Implement public blog routes: post list (`/`) and post detail (`/$slug`) with server functions, MDX rendering, view counter, and SEO meta tags.

## Important Decisions

- Used `renderToStaticMarkup` to convert MDX React component to HTML string for `dangerouslySetInnerHTML` in post detail.
- `notFound()` from `@tanstack/react-router` used for 404 (not `throw new Response`).

## Learnings

- **`getPublishedPosts` chain includes `.orderBy()`**: mock must chain `.where()` → `{ orderBy }` → resolvedValue. Task-09 test originally had `.where().mockResolvedValue([])` which broke because `.orderBy()` was called after `.where()`.
- **Handler indirection required for `getPublishedPostsFn`**: `createServerFn().handler(getPublishedPostsFn)` causes TanStack Start Vite plugin to strip `getPublishedPostsFn` from test bundle. Fix: `handler(() => getPublishedPostsFn())`. Same pattern documented in shared memory for task_11.

## Files / Surfaces

- `app/routes/index.tsx` — post list route, `getPublishedPostsFn`
- `app/routes/$slug.tsx` — post detail route, `getPostBySlugFn`, `incrementViewCountFn`
- `app/tests/task-09-public-routes.test.ts` — 9 unit tests, all passing

## Errors / Corrections

- Test file used `.where().mockResolvedValue([])` missing `.orderBy()` step → fixed mock chain.
- `index.tsx` passed `getPublishedPostsFn` directly to `.handler()` → fixed to indirect wrapper.
- Biome format required `handler(() =>\n\tgetPublishedPostsFn()` not `handler(\n\t() => getPublishedPostsFn()`.

## Ready for Next Run

Task complete. 15 test files pass (125 passed, 4 skipped). Biome clean (0 errors). Diff left for manual review/commit.
