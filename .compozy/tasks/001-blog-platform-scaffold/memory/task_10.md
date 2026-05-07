# Task Memory: task_10.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Wire up Better Auth for admin session management. All implementation was done in prior runs (task_11 scaffolded auth before task_10 was formally verified).

## Important Decisions

- Plugin name is `reactStartCookies` (from `better-auth/react-start`), not `tanstackStartCookies` — TechSpec naming differs from actual API.
- Auth API call uses `getRequest()` from `@tanstack/react-start/server`, not `getWebRequest()`.
- Auth client lives in `app/lib/auth.client.ts` (NOT in vite-env-only denyImports).
- vite-env-only config is in `vite.config.ts`, not `app.config.ts` (no Vinxi config in this project).

## Files / Surfaces

- `app/lib/auth.ts` — Better Auth server instance
- `app/lib/auth.client.ts` — authClient for browser use
- `app/routes/api/auth/$.ts` — catch-all GET/POST handler
- `app/routes/__root.tsx` — beforeLoad session loading via createServerFn
- `vite.config.ts` — denyImports for auth.ts
- `app/tests/task-10-auth.test.ts` — 10 unit tests (all passing)
- `app/tests/task-10-auth-integ.test.ts` — 7 integration tests (all passing, require DB)

## Verification Evidence

- `bun vitest run app/tests/task-10-auth.test.ts`: 10/10 pass
- `bun vitest run app/tests/task-10-auth-integ.test.ts`: 7/7 pass
- Full suite: 132 passed, 4 skipped, 0 failures (16 test files)
- Biome: 2 pre-existing warnings, 0 errors
- TS: 0 errors in task-10 files

## Ready for Next Run

Task complete. All deliverables verified.
