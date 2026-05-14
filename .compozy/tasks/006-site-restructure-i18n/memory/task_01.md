# Task Memory: task_01.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Stabilize post indexing pipeline (F9): add `[sync]` step to `content-watcher-dev` Vite plugin and a `bun run sync` step to `scripts/deploy.sh`.

## Important Decisions

- Extracted `configureServer` logic into `app/lib/dev-boot.ts` (new) rather than keeping it inline in `vite.config.ts`. Reason: the `if (process.env.VITEST) return;` guard in the plugin makes the inline function untestable; extraction lets unit tests call `runDevBoot()` directly with vi.mock.
- `vite.config.ts` plugin calls `runDevBoot` via dynamic import (`await import("./app/lib/dev-boot")`), preserving the lazy-load pattern of the original plugin.
- `[sync]` log format: `[sync] ${JSON.stringify({event: "sync_started"|"sync_completed"|"sync_failed", ...})}` — bracket prefix + JSON body.

## Learnings

- `vi.mock("#/db/indexer", ...)` intercepts static imports in the extracted `dev-boot.ts` module correctly.
- `set -euo pipefail` in `deploy.sh` provides the hard-fail behavior for the sync step without needing an explicit `|| exit 1`.
- Biome pre-existing warnings (3): `locale.tsx noDocumentCookie`, `docker-compose.test.ts noTemplateCurlyInString` × 2. Not introduced by this task.
- Pre-existing test failures (14 tests, 4 files): `indexer-integ`, `sync-integ` (partial), `drizzle-schema`, `seed` integration tests — all require a live PostgreSQL instance with correct credentials.

## Files / Surfaces

- `app/lib/dev-boot.ts` — new; exports `runDevBoot(contentDir?)`: migrate → seed → [sync] syncAll → spawn watcher
- `vite.config.ts` — plugin now delegates to `runDevBoot` via dynamic import
- `scripts/deploy.sh` — added `docker run ... bun run sync` between migrate and compose-up
- `app/tests/dev-boot.test.ts` — new; 10 unit tests covering count, order, error propagation, log output
- `app/tests/deploy-sh.test.ts` — 1 new test: sync ordering (after migrate, before compose-up)
- `app/tests/sync-integ.test.ts` — 1 new test: malformed MDX exits non-zero

## Errors / Corrections

- Initial `dev-boot.ts` used string concat (`"[sync] " + JSON.stringify(...)`) — biome flagged as `lint/style/useTemplate`. Fixed to template literals.
- Initial `dev-boot.test.ts` had line-length formatting issues — fixed by biome formatter.
- Initial `sync-integ.test.ts` had a long `writeFile` line — fixed by biome formatter.

## Ready for Next Run

Task 01 complete. Smoke pass confirmed `bun run sync` indexes 3 posts from `content/en/`. Task 05 (move lorem-ipsum fixture out of content/) depends on this task being complete.
