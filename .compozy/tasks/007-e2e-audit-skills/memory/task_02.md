# Task Memory: task_02.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Complete. Site-model module + vite stub + drift test all delivered.

## Important Decisions

- `findMdxFiles` uses `.catch(() => null)` pattern instead of try/catch with `let entries` to avoid `noImplicitAnyLet` biome error.
- Drift assertion implemented as standalone helper `assertCoverage(keys)` in test file — testable without mocking fs.
- `process.cwd` spied on in fixture tests to redirect content dir to a temp dir.

## Learnings

- gray-matter parses bare YAML dates (`publishedAt: 2026-01-01`) as `Date` objects (js-yaml default behavior).
- `vi.spyOn(process, "cwd")` works in Vitest node environment for redirecting content dir in `getPostInventory()` tests.
- `type RouteEntry` was unused in test (biome warning as unsafe-fix) — removed.
- `#/lib/site-model.server` was already present in `vite.config.ts` SERVER_ONLY_IDS before this task run (pre-added); `content.ts` fields also already extended.

## Files / Surfaces

- `app/lib/site-model.server.ts` — new, 221 lines
- `app/tests/site-model.test.ts` — new, 28 tests, 95.45% branch coverage
- `app/types/content.ts` — fields category/series/seriesPart/draft added (already staged)
- `vite.config.ts` — `#/lib/site-model.server` added to SERVER_ONLY_IDS (already staged)

## Errors / Corrections

- `let entries;` caused `noImplicitAnyLet` biome error — fixed with `.catch(() => null)` pattern.
- TypeScript rejected `Awaited<ReturnType<typeof readdir>>` due to overload resolution — fixed with same pattern.

## Ready for Next Run

task_03 can start: `getRouteInventory()` and `getPostInventory()` available, drift test green.
