---
name: task-10-public-read-spec
description: task_10 execution context — public-read capability spec
metadata:
  type: project
---

## Objective Snapshot

Create `tests/e2e/public-read.spec.ts` with 4 tests covering: en post render, pt-br post render, locale switcher, and 404 path. Anonymous session via `test.use({ storageState: { cookies: [], origins: [] } })`.

## Important Decisions

- **Locale switcher direction**: Test goes pt-br → en (works correctly via `startsWith("/pt-br/")` branch). The en → pt-br direction is BROKEN in `useLangSwitcher`: when on `/<slug>` (no prefix), it falls to `else` branch and navigates to home, not `/pt-br/<slug>`. Documented as known limitation; not fixing in this task.
- **404 text**: `$slug.tsx` has its own `notFoundComponent` with hardcoded "Post not found" (not from strings.ts). Root `notFoundComponent` ("Page not found") only fires for truly unmatched routes. Assert `getByRole("heading", { name: "Post not found" })`.
- **MDX fixture files**: Created at `app/content/posts/{en,pt-br}/e2e-public-fixture.mdx`. These are real committed files, accessible to the preview server by absolute path.
- **`REPO_ROOT` in seed.ts**: Use `process.cwd()` (project root) since Playwright and global-setup run from project root.
- **`E2EState` extension**: Added `publicFixtureEnId`, `publicFixturePtBrId`. Doesn't break `admin-write.spec.ts` which only reads old fields.

## Learnings

- `useLangSwitcher` only handles `startsWith("/<locale>/")` — en pages without prefix fall to home navigation on switch.
- `site-model.test.ts` integration test only asserts `Array.isArray` — not broken by adding real MDX fixture files to content dir.
- Locale switcher button has `aria-label="Switch language"` — use `getByRole("button", { name: "Switch language" })`.
- Label shows TARGET locale name: "Português" on en page, "English" on pt-br page.

## Files / Surfaces

- NEW: `app/content/posts/en/e2e-public-fixture.mdx`
- NEW: `app/content/posts/pt-br/e2e-public-fixture.mdx`
- NEW: `tests/e2e/public-read.spec.ts`
- MOD: `tests/e2e/seed.ts` — `seedPublishedFixturePosts`, 3 new constants
- MOD: `tests/e2e/global-setup.ts` — `E2EState` type, call `seedPublishedFixturePosts`
- MOD: `scripts/e2e-server.ts` — initial state includes `publicFixtureEnId`, `publicFixturePtBrId`

## Errors / Corrections

- `site-model.test.ts` "no content dir" test broke when MDX fixtures were added to `app/content/posts/`. Fixed by adding `beforeAll`/`afterAll` with `vi.spyOn(process, "cwd")` isolation (matches existing fixture posts test pattern).
- Biome auto-added `exact: true` to `getByRole` heading matchers and removed unused `consoleErrors` variable from 404 test.

## Verification Evidence

- `bunx playwright test tests/e2e/public-read.spec.ts` → 5 passed (setup + 4 spec tests)
- `make test-e2e` → 12 passed (all 3 specs green)
- `make lint` → 0 errors (3 pre-existing warnings)
- `make check` → clean
- `make test` → 455 passed, 1 pre-existing docker-compose failure (not a regression)

## Status

COMPLETE. 4 tests passing. Phase 2 done. Fixes applied: `exact: true` on heading matchers, removed `consoleErrors` from 404 test (404 responses log console errors by design).
