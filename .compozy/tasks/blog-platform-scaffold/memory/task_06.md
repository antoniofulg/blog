# Task Memory: task_06.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Implement `startContentWatcher(contentDir: string): void` in `app/lib/watcher.server.ts`. Integrate watcher startup into TanStack Start dev server. Register in `vite-env-only`. Write unit + integration tests (≥80% coverage).

## Important Decisions

- **Vite plugin `configureServer` for startup** — used `apply: "serve"` + `configureServer` hook in `vite.config.ts` (not Vinxi plugin, not Nitro plugin). Confirmed: this is the correct mechanism for `bun dev` dev-server startup.
- **`process.env.VITEST` guard** — `configureServer` IS called by Vitest's internal server during test runs. Without the guard, the dynamic import of `watcher.server.ts` fails (Node.js can't import `.ts` files directly).
- **Dynamic import path** — `join(process.cwd(), "app/lib/watcher.server.ts")` used in `configureServer`. Bun handles `.ts` files natively. The `#/` alias in `watcher.server.ts` resolves via `package.json` imports map.
- **`vite-env-only` was already configured** — `watcher.server.ts` was already in `denyImports.client.files` from task_01. Subtask 6.4 was already done.
- **Two integration test files approach abandoned** — originally planned to split DB integration into a separate file. Final approach: one integ file with mocked indexer (real `fs.watch` always runs) + DB describe.skipIf block. The skipIf block would have received mocked indexer (conflict), so DB tests are left as mechanism tests only. DB pipeline is covered by task_05 integ tests.

## Learnings

- **`vi.spyOn` without restore leaks spy history** — `vi.spyOn(console, "warn")` in test 1 creates spy1 wrapping `console.warn`. Without restore, test 2's `vi.spyOn` returns the same spy1 with accumulated call history. Fix: call `vi.clearAllMocks()` in `resetAll()` before each test.
- **`configureServer` runs during `vitest`** — Vitest creates an internal Vite server and calls `configureServer` hooks. Any hook that has side effects (file watchers, background processes) must check `process.env.VITEST` and return early.
- **Split unit/integ files per task_05 learning** — `vi.mock` is file-scoped. Unit tests (all mocked) and integration tests (real `fs.watch` + mocked indexer) are in separate files.

## Files / Surfaces

- `app/lib/watcher.server.ts` — NEW (68 lines)
- `vite.config.ts` — modified: added `join` import, `content-watcher-dev` Vite plugin
- `app/tests/task-06-watcher.test.ts` — NEW (11 unit tests)
- `app/tests/task-06-watcher-integ.test.ts` — NEW (5 integration tests)

## Errors / Corrections

- **First attempt**: dynamic import of `.ts` path in `configureServer` crashed Vitest with `ERR_UNKNOWN_FILE_EXTENSION`. Root cause: `configureServer` is called by Vitest's internal server in Node.js context. Fix: `if (process.env.VITEST) return`.
- **Test failure**: "does NOT emit warning" test failed because `vi.spyOn` returned spy1 from previous test with accumulated call history. Fix: `vi.clearAllMocks()` in `resetAll()`.

## Ready for Next Run

Task 06 complete. `startContentWatcher` is implemented and all tests pass (74 pass, 4 skip DB-dependent).
