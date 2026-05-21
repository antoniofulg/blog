## Objective Snapshot

Build `/sitemap.xml` route: GET handler → `getSitemapEntriesFn` → XML with reciprocal hreflang.

## Status

**COMPLETE.** All 34 unit tests pass. 4 integration tests skipped (require dev server).

## Important Decisions

- Two-file approach: `sitemap[.]xml.ts` (route) + `sitemap[.]xml.server.ts` (logic).
- `getSitemapEntriesFn` is a **plain async function** (not `createServerFn`) — GET handler is server-side already.
- `getSitemapXmlResponse` also exported from `.server.ts` — imported by test file.
- x-default added by `renderXml` via `isDefault` flag on entry (not in `alternates` array) — keeps reciprocity clean.
- Posts: twin detection via Set comparison of both locale query results (no filesystem call).
- Pages: twin detection via `staticPageHasTwin(slug, targetLocale)` — mocked separately in tests.
- `SITE_URL` uses `??` (nullish coalescing) — empty string produces empty origin (test-safe, documented).
- `buildAlternates` helper iterates LOCALES to produce reciprocal pairs in one call.
- Add `sitemap[.]xml.server.ts` to `vite.config.ts` `excludeFiles` ✓.
- Manually added to `routeTree.gen.ts` (no standalone `tsr generate` CLI — from shared memory) ✓.
- `SITE_URL` documented in `.env.example` ✓.

## Files Touched

- `app/routes/sitemap[.]xml.server.ts` — existed in worktree, verified correct
- `app/routes/sitemap[.]xml.ts` — existed in worktree, verified correct
- `app/tests/sitemap.test.ts` — existed in worktree, all 34 tests pass
- `app/routeTree.gen.ts` — `SitemapDotxmlRoute` added to import, constant, and `rootRouteChildren`
- `vite.config.ts` — added `sitemap[.]xml.server.ts` to `excludeFiles`
- `.env.example` — added `SITE_URL=http://localhost:3000`

## Errors / Corrections

- Pre-existing biome failure (`browser-sweep.server.ts` lint errors) unrelated to this task.
- Pre-existing TS errors in `sitemap.test.ts` (mock typing, unused `afterEach`) — all 22 errors existed before my changes.
