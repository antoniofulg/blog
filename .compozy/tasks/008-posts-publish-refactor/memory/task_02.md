# Task Memory: task_02.md

Keep only task-local execution context here.

## Objective Snapshot

Strip every `isPublished` reference from source + tests so `bun run check` + `bun run test` (unit) pass after task_01 dropped the column from schema.

## Important Decisions

- Renamed `getPublishedPostsFn` → `listPostsFn` (not `getAllPostsFn`) to avoid conflict with admin/index.server.ts which already exports `getAllPostsFn`.
- `getLatestPublishedSlug` → `getLatestPostSlug`, filter removed from DB query.
- `PostEntry.isPublished` removed from site-model type; `getPostInventory` no longer queries DB at all (isPublished was the only DB field it fetched).
- `togglePublishedFn(id, isPublished)` param renamed to `publish`; body changed to set `publishedAt` (instead of `isPublished`). Unpublish = set publishedAt to null. Server fn validator updated: `{ id, publish }`.
- `admin/index.tsx` state renamed `isPublished` → `published`; init from `post.publishedAt != null`.
- `checkSeriesGaps` + `checkBrokenLinks` use `post.frontmatter.draft` instead of `post.isPublished`.
- content-audit test `isPublished: false` fixtures → `frontmatter: { ..., draft: true }`.
- `tests/e2e/admin-write.spec.ts` also updated: `queryIsPublished` → `queryPublished` (uses `publishedAt != null`), `resetIsPublished` → `resetPublished` (sets `publishedAt: null`).
- `schema-migration.test.ts` intentionally retains `isPublished` string to test for the column's absence — left unchanged.

## Files / Surfaces

- `app/db/queries.ts` — renamed + stripped filter ✓
- `app/db/indexer.ts` — removed `isPublished: false` from upsert values ✓
- `app/routes/{-$locale}/$slug.server.ts` — stripped 3 isPublished filters ✓
- `app/lib/site-model.server.ts` — renamed fn, stripped PostEntry field, stripped DB query ✓
- `app/routes/{-$locale}/index.server.ts` — updated import name ✓
- `app/routes/admin/index.server.ts` — updated togglePublishedFn body ✓
- `app/routes/admin/index.tsx` — uses publishedAt != null ✓
- `app/lib/content-audit/checks.server.ts` — replaced isPublished with draft flag ✓
- `tests/e2e/admin-write.spec.ts` — updated helper functions ✓
- Tests: indexer, admin-routes, lang-slug-route, site-model, public-routes, lang-blog-route, content-audit ✓

## Errors / Corrections

- First `bun run check` showed 5 Biome formatter errors — ran `bunx biome format --write` to fix.
- `tests/e2e/admin-write.spec.ts` outside `app/` also had `isPublished` DB column refs — fixed.

## Verification Evidence

- `bunx tsc --noEmit`: exit 0, no errors
- `bun run check` (Biome): 0 errors, 11 warnings (external/node_modules only)
- `bun run test`: 856 passed, 43 skipped, 13 failed (all 13 are pre-existing Postgres credential failures unrelated to this task)

## Ready for Next Run

Task complete. Next task: task_03.
