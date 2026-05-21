# Task Memory: task_05.md

Keep only task-local execution context here.

## Objective Snapshot

Unify `$slug.tsx` loader: post → page → 404. Add discriminated union `SlugLoaderResult = PostLoaderResult | PageLoaderResult`. Update `$slug.tsx` component to dispatch on `kind`. Add tests. COMPLETE.

## Important Decisions

- `getPostBySlugWithLangFn` returns `Promise<SlugLoaderResult>` (was `PostLoaderResult` without `kind`).
- Post lookup logic preserved exactly (exact match → alt-locale check → any-locale fallback). `loadStaticPage` called only after all three post lookups miss.
- `loadStaticPage` imported dynamically (same pattern as other deps) so Vitest can mock `#/lib/mdx/pages.server`.
- `head` function in `$slug.tsx` updated to discriminate on `kind`; pages get no hreflang (task_12 handles that).
- Component split: `LocalePostDetail` (dispatcher) → `PostView` / `StaticPageView` as inner functions.
- `incrementViewCount` called only in `PostView`.
- Existing tests updated with `if (result.kind !== "post") return` narrowing guard after `expect(result.kind).toBe("post")`.

## Learnings

- `pages.server.ts` exists at `app/lib/mdx/pages.server.ts` (task_03 done).
- `about.mdx` migrated to `app/content/pages/{en,pt-br}/about.mdx` (task_04 done).
- Existing test "both miss → notFound" required adding `vi.mock("#/lib/mdx/pages.server")` with default `loadStaticPage: vi.fn().mockResolvedValue(null)`.
- `biome` requires value imports before type imports in import statements.
- `describe.skipIf(cond)(...)` must be written on one line per biome formatting rules.

## Files / Surfaces

- `app/routes/{-$locale}/$slug.server.ts` — added `kind` to `PostLoaderResult`, added `PageLoaderResult`, added page fallback branch
- `app/routes/{-$locale}/$slug.tsx` — updated `head`, split component into `PostView`/`StaticPageView`
- `app/tests/lang-slug-route.test.ts` — added `#/lib/mdx/pages.server` mock, added 7 new unit tests, added 4 integration tests (skipped without server)

## Errors / Corrections

None.

## Ready for Next Run

Task complete. All deliverables shipped and verified.
