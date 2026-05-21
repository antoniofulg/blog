# Task Memory: task_10.md

## Objective Snapshot

Rewrite `useLangSwitcher` in `header.tsx`: replace if-chain with router-state slug extraction, add dropdown menu using `LanguageMenu`, wire `MissingTwinDialog` for unavailable items, hide switcher on `/admin/*`. Extend E2E spec with 4 new scenarios.

## Important Decisions

- Button label changes from TARGET locale ("Português" when on EN) → CURRENT locale ("English" when on EN). Trigger opens dropdown, not direct navigate.
- `useRouterState` selectors return primitives (not objects) to avoid re-render loops in `useSyncExternalStore`.
- 4 separate `useRouterState` calls: `pathname`, `currentSlug`, `loaderKind`, `hasTwinFromLoader`.
- `useLangSwitcher` called ONCE in `Header`; result passed as prop to `MobileMenu` (avoids duplicate state).
- `MissingTwinDialog` rendered at header-fragment level (after `MobileMenu`), not inside either.
- `triggerRef` on desktop trigger button; `handleDialogCancel` calls `triggerRef.current?.focus()`.
- `hasTwinFromLoader` defaults: post → `?? false`, page → `?? false` (conservative).
- Outside-click handler via `useEffect` + `containerRef` on the dropdown wrapper div.
- `onKeyDown` for Escape moved to button (not wrapper div) to satisfy biome a11y rule.

## Learnings

- `seed.ts` still used `isPublished` (removed in task_01) — fixed here.
- `ROUTE_METADATA` in `site-model.server.ts` had stale `{-$locale}/about.tsx` entry (deleted in task_04) — removed here.
- `lang-slug-route.test.ts` mock for `pages.server.ts` lacked `staticPageHasTwin` — added.
- `@radix-ui/react-dialog` in package.json had `^1.1.15` (caret) — project requires pinned versions, fixed to `1.1.15`.

## Files / Surfaces

1. `app/content/posts/en/e2e-en-only-fixture.mdx` — NEW
2. `tests/e2e/seed.ts` — fix `isPublished`, add `seedEnOnlyFixturePost`
3. `tests/e2e/global-setup.ts` — add `enOnlyPostSlug` to `E2EState`
4. `app/routes/{-$locale}/$slug.server.ts` — add `hasTwin` to `PageLoaderResult`
5. `app/components/layout/header.tsx` — full rewrite
6. `app/tests/header.test.ts` — updated mocks, 27 passing tests
7. `tests/e2e/public-read.spec.ts` — updated + 4 new E2E scenarios
8. `app/tests/lang-slug-route.test.ts` — add `staticPageHasTwin` to mock, add `hasTwin` assertions
9. `app/lib/site-model.server.ts` — remove stale `about.tsx` from ROUTE_METADATA
10. `package.json` — pin `@radix-ui/react-dialog` to `1.1.15`

## Errors / Corrections

- `seed.ts` had `isPublished` references (column dropped in task_01) — caused runtime DB errors.
- `site-model.server.ts` ROUTE_METADATA had stale `{-$locale}/about.tsx` entry causing inventory count mismatch in tests.
- `@radix-ui/react-dialog: "^1.1.15"` violated pinned-deps policy — fixed to exact version.

## Ready for Next Run

Task complete. Commit created. Next: task_11 (sitemap route).
