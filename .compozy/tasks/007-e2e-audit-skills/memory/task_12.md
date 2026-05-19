# Task Memory: task_12.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

COMPLETE. Implemented `checks.server.ts` (5 check functions + `runContentAudit()` orchestrator) and `reporter.server.ts` (`writeReport`). 33 tests pass.

## Important Decisions

- `checkFrontmatter(filePaths)` does its own file walk — catches files that fail getPostInventory's silent skip
- `checkBrokenLinks(posts, knownSlugs, knownPaths)` accepts Sets as params for testability; orchestrator builds from getRouteInventory
- Only absolute paths starting with `/` checked for broken links (relative paths skipped in V1)
- `runContentAudit(contentDir?)` accepts optional contentDir for integration test isolation
- `vi.hoisted` + `vi.mock` pattern used to mock site-model (avoids DB dependency in tests)
- `noTranslation?: boolean` added to PostFrontmatter + parsed in site-model

## Learnings

- `bun test` is bun's runner; `bunx vitest run` / `bun run test` is vitest — only vitest supports `vi.hoisted`
- Biome `noNonNullAssertion` is a warning (not error) but still caught by biome.test.ts — use `?.` instead of `!`
- `access()` from node:fs/promises resolves to `null` not `undefined` in vitest compat — use `.then(() => true).catch(() => false)` instead

## Files / Surfaces

- `app/types/content.ts` — added `noTranslation?: boolean`
- `app/lib/site-model.server.ts` — parse noTranslation in parseMdxFrontmatter
- `app/lib/content-audit/checks.server.ts` — new (5 checks + orchestrator)
- `app/lib/content-audit/reporter.server.ts` — new (writeReport)
- `vite.config.ts` — added checks + reporter to SERVER_ONLY_IDS + stub exports
- `app/tests/fixtures/content-audit/` — 5 MDX fixtures
- `app/tests/content-audit.test.ts` — 33 tests passing
- `docs/audits/SUMMARY.md` — created with header

## Ready for Next Run

task_13 (audit-content.ts script) can start. Consumes `runContentAudit()` + `writeReport()` from checks/reporter. Both modules fully tested.
