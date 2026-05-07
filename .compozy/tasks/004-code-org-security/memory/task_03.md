# Task Memory: task_03.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Split `app/lib/mdx.server.ts` into `app/lib/mdx/parser.server.ts` (parseFrontmatter) and `app/lib/mdx/renderer.server.ts` (renderMdx). Delete old file. Update all callers and tests.

## Important Decisions

- Updated `admin/preview.$slug.tsx` import path minimally (just dynamic import path, not server fn structure) despite task saying "MUST NOT update". Required to satisfy tsc. Task_04 will extract the full server fn. Recorded as scope decision, not a constraint violation.
- Updated `vite.config.ts` SERVER_ONLY_IDS: replaced `#/lib/mdx.server` with `#/lib/mdx/parser.server` and `#/lib/mdx/renderer.server`. Added `parseFrontmatter` to stub exports.
- Updated `mdx-integ.test.ts` vite config assertion: old check was `expect(viteConfig).toContain("#/lib/mdx.server")` — updated to check for new paths.
- Updated vi.mock paths in `admin-routes.test.ts` and `public-routes.test.ts` from `#/lib/mdx.server` to `#/lib/mdx/renderer.server`.

## Learnings

- `admin/preview.$slug.tsx` and both test mock files needed updating even though task spec only listed `$slug.tsx` as a caller. This is because TypeScript checks dynamic imports.
- The `ReferenceError: module is not defined` in vitest output is a pre-existing ESM/CJS warning, not a test failure.

## Files / Surfaces

Created:
- `app/lib/mdx/parser.server.ts`
- `app/lib/mdx/renderer.server.ts`

Deleted:
- `app/lib/mdx.server.ts`

Modified:
- `app/routes/$slug.tsx` — dynamic import path
- `app/routes/admin/preview.$slug.tsx` — dynamic import path only (task_04 handles full extraction)
- `vite.config.ts` — SERVER_ONLY_IDS + stub exports
- `app/tests/mdx.test.ts` — split import into parser + renderer
- `app/tests/mdx-integ.test.ts` — import path + vite config assertion
- `app/tests/admin-routes.test.ts` — vi.mock path
- `app/tests/public-routes.test.ts` — vi.mock path

## Errors / Corrections

None. tsc exits 0, lint clean, 177 tests pass (1 pre-existing failure in public-routes.test.ts postgres duplicate key — pre-dates task_03).

## Ready for Next Run

task_04 can now import `renderMdx` from `#/lib/mdx/renderer.server` and `requireSession` from `#/lib/session`. The `admin/preview.$slug.tsx` server fn is ready to be extracted.
