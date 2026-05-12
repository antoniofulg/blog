# Task Memory: task_06.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Create `app/routes/$lang/blog.tsx` — locale-filtered blog listing at `/en/blog` and `/pt-br/blog`.

## Important Decisions

- `PostCard` already had `lang` prop support (task_05 added it) — no component changes needed
- Route uses `createServerFn` with `inputValidator` to pass `lang` string to `getPublishedPostsFn`
- `Route.useParams()` in component gives access to `lang` for passing to `PostCard`

## Learnings

- Both files (`$lang/blog.tsx` and `lang-blog-route.test.ts`) were already implemented when task ran
- `bunx tsr generate` does not work — route tree was already auto-regenerated via dev server and `$lang/blog` is in `routeTree.gen.ts`
- `bun test` won't run vitest test files — must use `make test` / `bunx vitest run`

## Files / Surfaces

- `app/routes/$lang/blog.tsx` — route file (already existed, complete)
- `app/tests/lang-blog-route.test.ts` — unit + integration tests (already existed, complete)
- `app/routeTree.gen.ts` — already includes `LangBlogRouteImport` from `$lang/blog`

## Errors / Corrections

None.

## Ready for Next Run

Task 06 complete. Verification: `make check` + `make test` + `make lint` all exit 0 (22 test files, 212 passed).
