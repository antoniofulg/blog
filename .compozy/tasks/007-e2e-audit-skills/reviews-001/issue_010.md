---
provider: manual
pr:
round: 1
round_created_at: 2026-05-19T14:14:47Z
status: resolved
file: tests/e2e/global-setup.ts
line: 55
severity: low
author: claude-code
provider_ref:
---

# Issue 010: Fixture MDX file written to tmpdir is never cleaned up

## Review Comment

`globalSetup` writes a fixture MDX file to `tmpdir() + "e2e-fixture-post.mdx"` (`tests/e2e/global-setup.ts:55-57`) so `seedFixturePost` can record its `filePath` in the `posts` table. The file is created every time the e2e suite runs but is never removed:

- `tests/e2e/global-teardown.ts` is a no-op (`global-teardown.ts:1-4`).
- `scripts/e2e-server.ts:42-46` cleans up `E2E_STATE_FILE` on SIGTERM/SIGINT and the proxy DB, but not the fixture mdx.
- Each run overwrites the same file path, so the file count does not grow, but its contents accumulate stale identity across runs (every run rewrites the same 1-line body so this is benign in practice).

Two consequences:

1. The file persists in `tmpdir()` across reboots on most platforms, leaving an artifact tied to nothing once the test DB is gone. Cleanup hygiene only — no functional bug.
2. The pattern is asymmetric: `e2e-server.ts` is responsible for state file lifecycle, `global-setup.ts` owns the fixture file but has no teardown path. Adding more fixture files in the future inherits the asymmetry and accumulates.

**Suggested fix:** add fixture file cleanup to either `global-teardown.ts` (the documented teardown hook) or to `e2e-server.ts`'s `cleanup()` function alongside `E2E_STATE_FILE` unlinking. Better yet, write the fixture into a per-run temp directory (`mkdtemp(join(tmpdir(), 'e2e-fixture-'))`) so each run gets an isolated path and the dir can be removed wholesale on teardown. Document the lifecycle ownership in `.agents/rules/testing.md`.

## Triage

- Decision: `valid`
- Notes: Confirmed at `global-setup.ts:55-57`. The fixture MDX file is written to `join(tmpdir(), "e2e-fixture-post.mdx")` and never deleted. `global-teardown.ts` is a no-op. `e2e-server.ts` only cleans up `E2E_STATE_FILE`. Fix: add unlink of the fixture file in `global-teardown.ts`. File path is deterministic (`join(tmpdir(), "e2e-fixture-post.mdx")`). `global-teardown.ts` is not listed in batch scope code files but the minimal change (3 lines) is documented here. `.catch(() => {})` silences errors on reruns where the file may already be missing.
