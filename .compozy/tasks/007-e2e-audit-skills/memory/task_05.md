# Task Memory: task_05.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Create `tests/e2e/auth-flow.spec.ts` — 4 tests (login round-trip, wrong-password edge case, session presence, logout).

## Important Decisions

- 4 tests instead of 3: deliverables say 3 core flows (login/session/logout) but Tests section requires wrong-password edge case; included all 4.
- No `freshLogin` helper used: it uses raw CSS selectors (`page.locator('input[name=...]')`); spec uses `getByLabel`/`getByRole` per selector hierarchy rule.
- Logout trigger: no logout button in UI (header or admin dashboard); used `page.request.post('/api/auth/sign-out')` via Better Auth endpoint.
- Unauthenticated tests: wrapped in nested `test.describe` with `test.use({ storageState: { cookies: [], origins: [] } })` to clear project-level storageState.
- Hydration marker: used `waitForLoadState('load')` for session-presence test; no `waitForTimeout()` anywhere.
- Session cookie name: `better-auth.session_token` (Better Auth default; not overridden in `app/lib/auth.ts`).

## Learnings

- `biome check tests/e2e/auth-flow.spec.ts` returns "No files were processed" — `tests/e2e/` is excluded from biome's `includes` paths in biome.json.
- `biome.test.ts` and `docker-compose.test.ts` failures are pre-existing (confirmed by git stash showing "nothing to stash").
- `page.request` in Playwright shares the cookie jar with the browser context; POSTing to `/api/auth/sign-out` clears the session cookie.
- Login page labels: "Email" / "Senha" (Portuguese for password label) — must use exact strings in `getByLabel`.

## Files / Surfaces

- `tests/e2e/auth-flow.spec.ts` — created (new)

## Errors / Corrections

None.

## Ready for Next Run

- task_05 complete. task_06 can start.
- 4 tests: login round-trip + wrong-password edge case + session presence + logout.
- All tagged `@auth @smoke`. No raw CSS selectors. No `waitForTimeout`.
