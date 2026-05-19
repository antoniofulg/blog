# Workflow Memory

Keep only durable, cross-task context here. Do not duplicate facts that are obvious from the repository, PRD documents, or git history.

## Current State

- task_01 complete: 7 dev deps installed (pinned exact), Chromium ready, 5 .gitignore entries added.
- task_02 + task_03 complete on branch TASK-0007/e2e-audit-skills.

## Shared Decisions

- `drizzle-orm` is already a prod dep at 0.45.2 with `/pglite` subpath confirmed; do not re-add as devDep.
- All `package.json` devDep versions must be pinned exactly (no `^` or `~`) — enforced by `app/tests/biome.test.ts`.

## Shared Learnings

- macOS Playwright browser cache: `~/Library/Caches/ms-playwright/` (not `~/.cache/`); CI uses Linux path.
- `app/tests/docker-compose.test.ts` has 1 pre-existing failure (env var mismatch in `DATABASE_URL`); do not count it as a regression.

## Open Risks

- PGLite@0.4.5 is a fast-moving package; downstream tasks should pin and not upgrade without testing.
- `pushSchema` from drizzle-kit/api requires `db as any` cast — type mismatch between `PgDatabase<any>` in drizzle-kit and `PgliteDatabase<FullSchema>` from drizzle-orm.
- `net.Server.closeAllConnections()` not in @types/node@22 for `net.Server`; use manual socket Set instead.

## Shared Learnings

- `readdir` with `{ withFileTypes: true }` returns `Dirent<string>[]` in TypeScript 6.x; explicit `Awaited<ReturnType<typeof readdir>>` defaults to `Dirent<NonSharedBuffer>[]` — always infer or cast `entry.name as string`.
- Biome `noExportsInTest` is an ERROR (not warning) — avoidable with `// @ts-nocheck` on fixture files instead of `export {}`.
- `playwright-report/` is gitignored but left on disk by Playwright test runs; biome includes `**/index.html` which catches it — delete before CI biome check.

## Shared Learnings (cross-task)

- `tests/e2e/` is excluded from biome's `includes` in biome.json — no biome errors from e2e spec files.
- Login page password label is "Senha" (Portuguese), not "Password" — use `getByLabel("Senha")` in any spec touching `/login`.
- `useLangSwitcher` en→pt-br is BROKEN for un-prefixed en URLs (e.g., `/<slug>`): falls to home instead of `/pt-br/<slug>`. Only pt-br→en direction works. Known app bug; tests must use pt-br→en direction.
- Better Auth session cookie name: `better-auth.session_token` (default, not overridden in `app/lib/auth.ts`).
- Logout trigger: no logout button in the header or admin UI — use `page.request.post('/api/auth/sign-out')`.

## Handoffs

- task_02 complete: site-model module, vite stub, drift test all done. 28 tests pass, 95.45% branch coverage.
- task_03 complete: PGLite harness done. 18 tests pass, 94%+ statement coverage. State file at `os.tmpdir()/pglite-e2e-state.json`. TCP proxy built from `net.Server` + `PGlite.execProtocolRaw()`.
- task_04 can start: `E2E_STATE_FILE`, `getActiveTestDb()`, `clearActiveTestDb()` exported from `tests/e2e/global-setup.ts`.
- task_05 complete: `tests/e2e/auth-flow.spec.ts` with 4 tests (login + wrong-password + session + logout). All tagged `@auth @smoke`.
- task_06 complete: `scripts/lint-test-annotations.ts` AST-based linter done. `lint:tests` script + `lint-tests` Makefile target added. 22 Vitest tests pass. AC-1 through AC-5 verified.
- task_07 complete: CI gate wired up. Matrix extended to 6 entries. Chromium cache, E2E secrets, artifact upload added. `test:e2e` script + `test-e2e` Makefile target added. 11 ci-workflow + 2 makefile tests added. cicd.md updated.
- task_08 complete: e2e-coverage SKILL + symlink + slash command + testing.md + auth.md + AGENTS.md. 13 Vitest tests pass. `.claude/commands/` dir created (was missing).
- task_09 complete: `tests/e2e/admin-write.spec.ts` — 3 tests (admin guard, publish-toggle round-trip, preview). Tagged `@admin` only. `playwright.config.ts` stderr fixed to `"pipe"`.
- task_10 complete: `tests/e2e/public-read.spec.ts` — 4 tests (en render, pt-br render, locale switcher pt-br→en, 404). Tagged `@public @smoke`. MDX fixtures at `app/content/posts/{en,pt-br}/e2e-public-fixture.mdx`. `seedPublishedFixturePosts` added to seed.ts. **Phase 2 complete — all 3 capability specs exist.**
- task_11 complete: `app/lib/content-audit/link-parser.server.ts` — `extractLinks(filePath): Promise<Link[]>` via remark AST. 18 tests pass, 94%+ coverage. Biome: import order (type before value), multi-line function signatures, no unused imports. `vite.config.ts` stub was already present (no change needed). 7 fixture MDX files in `app/tests/fixtures/link-parser/`.
- task_12 complete: `checks.server.ts` (5 check functions + runContentAudit) + `reporter.server.ts` (writeReport). 33 tests pass. `noTranslation?: boolean` added to PostFrontmatter. Both modules added to vite SERVER_ONLY_IDS. `docs/audits/SUMMARY.md` initialized. `bun test` ≠ vitest; use `bunx vitest run` for vi.hoisted support.
- task_13 complete: `scripts/audit-content.ts` (CLI entry, parseTrigger/parseContentDir/runAuditCli exported). `audit:content` script + `audit-content` Makefile target. `app/tests/audit-content-cli.test.ts` (24 unit tests). `docs/audits/SUMMARY.md` baseline row committed (2026-05-19 manual 0/0/0). Integration tests append rows to SUMMARY.md when DB is live — clean before committing.
