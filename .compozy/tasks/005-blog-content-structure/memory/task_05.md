# Task Memory: task_05.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Wrap app in `LocaleProvider` via `__root.tsx` and create `$lang.tsx` layout route with `beforeLoad` validation. Status: **completed**.

## Important Decisions

- `LocaleProvider` wraps `ThemeProvider` (outer), not the other way round — satisfies "sibling wrapper, not inside ThemeProvider" requirement
- `redirect({ to: "/en/blog" as never })` — type assertion required because the `/en/blog` route is typed only after task_06 creates `$lang/blog.tsx`. Remove `as never` once task_06 is done.

## Learnings

- `routeTree.gen.ts` was already auto-updated when TanStack Start Vite plugin ran (no manual `tsr generate` needed; the diff shows `$lang` was auto-added)
- `bunx tsr generate` does NOT work in this project — route tree only regenerates via the Vite dev server (`tanstackStart` plugin)

## Files / Surfaces

- `app/routes/__root.tsx` — added `LocaleProvider` import + outer wrapper in `RootLayout`
- `app/routes/$lang.tsx` — new layout route with `beforeLoad` validation
- `app/routeTree.gen.ts` — auto-updated by Vite plugin (contains `LangRoute`)
- `app/tests/lang-route.test.ts` — new unit tests for both validation branches
- `app/tests/public-routes.test.ts` — added integration `describe.skipIf(port3000Free)` block for `$lang` redirect tests

## Errors / Corrections

- Biome formatter required `describe.skipIf(...)(...)` on a single line, not split across lines — fixed on first test run
- TypeScript rejected `redirect({ to: "/en/blog" })` because `/$lang/blog` route not yet in type system → fixed with `as never` cast

## Ready for Next Run

- task_06 creates `app/routes/$lang/blog.tsx` — remove `as never` cast in `$lang.tsx` once done
- task_07 creates `app/routes/$lang/$slug.tsx` — no changes needed in this task's files
