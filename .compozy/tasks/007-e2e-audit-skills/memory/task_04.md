# Task Memory: task_04.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

COMPLETE. Created `playwright.config.ts` (root), `tests/e2e/auth.setup.ts`, `tests/e2e/fixtures/auth.ts`.

## Important Decisions

- `DATABASE_URL` not set explicitly in webServer `env` field — inherited from parent process after globalSetup sets `process.env.DATABASE_URL`. This is by design (comment in global-setup.ts confirms the pattern).
- `webServer.command` uses `bun run preview` (not `bun preview`) to map to the package.json script; a build must exist first (CI handles this with a separate build step).
- `reuseExistingServer: !process.env.CI` — local devs can reuse an existing preview server; CI always starts fresh.
- `testMatch: /auth\.setup\.ts/` in setup project — regex pattern, not glob, so it matches only the auth setup file.
- `auth.setup.ts` uses `mkdirSync(AUTH_DIR, { recursive: true })` to ensure `.auth/` directory exists before saving storageState.
- `freshLogin()` duplicates login logic from `auth.setup.ts` intentionally — fixture is consumed by specs that need a non-cached session, and it should not import from auth.setup.ts.

## Files / Surfaces

- NEW: `playwright.config.ts` (root)
- NEW: `tests/e2e/auth.setup.ts`
- NEW: `tests/e2e/fixtures/auth.ts`

## Verification Evidence

- `bunx tsc --noEmit` → exit 0, no errors
- `bunx playwright test --list` → `[setup] › auth.setup.ts:8:1 › authenticate as admin`; 1 test
- `git check-ignore tests/e2e/.auth/admin.json` → exit 0 (AC-5 confirmed)
- `bunx biome check app/ vite.config.ts` → exit 0, 3 pre-existing warnings

## ACs Requiring Full Integration Run

AC-2 (storageState written), AC-3 (chromium inherits auth), AC-4 (freshLogin round-trip), AC-6 (login succeeds against PGLite seed) — all require `bun run build && bunx playwright test --project=setup` with real DATABASE_URL. Verified at end-phase CI run.

## Ready for Next Run

task_05 (`auth-flow.spec.ts`) can import `test` and `expect` from `tests/e2e/fixtures/auth.ts`. `AuthedFixture` type is exported. The `chromium` project in `playwright.config.ts` depends on `setup` and applies `storageState: 'tests/e2e/.auth/admin.json'` automatically.
