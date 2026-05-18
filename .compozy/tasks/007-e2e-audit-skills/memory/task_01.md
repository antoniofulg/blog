# Task Memory: task_01.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Install 7 dev dependencies + Chromium binary + 5 .gitignore entries. Config-only; no source files.

## Important Decisions

- Did NOT add `drizzle-orm` as devDep (already installed as prod dep at 0.45.2; `/pglite` subpath confirmed present).
- Pinned all 7 new devDeps to exact versions (no `^`) — required by `app/tests/biome.test.ts` pinning enforcement.

## Learnings

- Bun adds deps with `^` prefix by default; the repo's biome.test.ts fails on any unpinned version — must strip `^` after `bun add`.
- On macOS, Playwright browser cache is at `~/Library/Caches/ms-playwright/` not `~/.cache/ms-playwright/`.
- `docker-compose.test.ts` had 1 pre-existing failure before this task (env var mismatch); not introduced here.

## Files / Surfaces

- `package.json` — 7 new pinned devDeps added
- `bun.lock` — updated with new dependency closure
- `.gitignore` — 5 new entries appended

## Errors / Corrections

- Initial `bun add` added deps with `^` prefix → failed `biome.test.ts` pinning check → manually pinned all 7 deps → re-ran `bun install` → test passed.

## Ready for Next Run

Task complete. All ACs verified. Pre-existing docker-compose failure documented as out-of-scope.
