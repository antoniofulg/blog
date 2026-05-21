# Workflow Memory

Keep only durable, cross-task context here. Do not duplicate facts that are obvious from the repository, PRD documents, or git history.

## Current State

Task_01 complete. `isPublished` column dropped from schema, migration `0003_hesitant_cassandra_nova.sql` generated and applied to local dev DB.

## Shared Decisions

- Single-phase migration (no two-phase staging) is safe per ADR-004 — CD pipeline migrate-before-restart ordering covers it.
- Worktrees need `.env` copied from `.env.example` before running tests — no `.env` is present by default.

## Shared Learnings

- `audit-content-cli.test.ts` integration tests cascade-fail until `queries.ts` removes `posts.isPublished` reference (task_02).
- When modifying schema, also update direct raw-SQL tests in `drizzle-schema.test.ts` and `indexer-integ.test.ts` — they assert column existence directly and are in schema-change scope.
- No standalone `tsr generate` CLI in this project. `routeTree.gen.ts` auto-generates only via `tanstackStart` vite plugin at `bun dev`/`bun build`. In the worktree, manually edit `routeTree.gen.ts` when adding/removing route files.
- `vite.config.ts` `importProtection.client.excludeFiles` must be updated when `*.server.ts` route files are deleted or renamed.
- `header.tsx` `useLangSwitcher` navigates to explicit route literals — update when routes are deleted or renamed to keep TS type check clean.

## Cross-Task Learnings

- Never embed literal null bytes (`\x00`) in TypeScript source — `grep` and `biome` treat the file as binary. Use `charCodeAt(i) === 0` loop or `String.fromCharCode(0)` at runtime instead.
- Run tests with `bun run test` (invokes vitest), NOT `bun test` (Bun's own runner which lacks `vi.hoisted`, `vi.mock`, etc).

## Open Risks

(none — all tasks complete except task_14 CONTENT.md docs)

## Cross-Task Learnings (continued)

- Biome (lineWidth=80, tabWidth=2) expands JSX table cells with Tailwind classes — `<ul>/<li>` list structure is 40% more compact than `<table>` for admin views needing LOC budget.
- `ROUTE_METADATA` drift test catches files NOT in the map but not the reverse. When deleting a route, manually remove its ROUTE_METADATA entry AND any test cases that assert the entry exists.

## Handoffs

Task_02 complete. `isPublished` removed from all source + test files. Renamed: `getPublishedPostsFn` → `listPostsFn`, `getLatestPublishedSlug` → `getLatestPostSlug`. `PostEntry.isPublished` removed; `getPostInventory` no longer queries DB. `togglePublishedFn` now manages `publishedAt` only. `schema-migration.test.ts` intentionally retains `isPublished` strings (tests the column's absence).

Note: `tests/e2e/admin-write.spec.ts` (outside `app/`) also contained `posts.isPublished` DB references — updated to use `publishedAt`. Any future task touching `is_published` semantics should audit both `app/tests/` and `tests/e2e/`.

Task_04 complete. `about.mdx` moved from `content/<locale>/` → `app/content/pages/<locale>/`. Legacy `about` route, server fn, MDX loader, and test deleted. `routeTree.gen.ts` manually updated (no standalone `tsr generate` CLI in this project — generation via `tanstackStart` vite plugin only). `header.tsx` navigate calls fixed from `/{-$locale}/about/` to `/{-$locale}/$slug/` with `slug:"about"`. `vite.config.ts` `importProtection.client.excludeFiles` updated.

Task_13 complete. Admin trimmed: preview routes deleted, togglePublishedFn removed, locale filter + View buttons added. Admin wc -l = 93. ROUTE_METADATA + site-model tests updated to reflect deleted route. Only task_14 (CONTENT.md) remains.

Task_10 complete. `useLangSwitcher` rewritten with dropdown LanguageMenu + MissingTwinDialog. `hasTwin` added to `PageLoaderResult`. `seed.ts` `isPublished` references fixed. Stale `{-$locale}/about.tsx` entry removed from ROUTE_METADATA. EN-only fixture added for modal E2E tests (`e2e-en-only-fixture.mdx` + seed). `@radix-ui/react-dialog` pinned to `1.1.15` (no caret). E2E `public-read.spec.ts` extended with 4 new scenarios.

14 integration tests fail in worktree environment with Postgres/network errors — pre-existing, unrelated to code changes.

`app/tests/biome.test.ts` has 1 pre-existing failure (`browser-sweep.server.ts` lint errors) — do not count as a regression.

`app/tests/sitemap.test.ts` has 22 pre-existing TypeScript errors (mock typing, unused import) — tests run and pass; `tsc --noEmit` reports them but they are not new.
