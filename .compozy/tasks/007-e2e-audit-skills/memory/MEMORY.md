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

## Shared Decisions (Phase 4 — app-audit types)

- `app/lib/content-audit/reporter.server.ts` and (future) `app/lib/app-audit/reporter.server.ts` both import from `tests/e2e/audit-fingerprint.ts` via relative path (`../../../tests/e2e/audit-fingerprint` and `../../../../tests/e2e/audit-fingerprint` respectively). Unusual direction but per TechSpec.
- `escapeMarkdownCell` is now exported from `reporter.server.ts` — app-audit reporter (task_18) should import it from there (not duplicate).
- Fingerprint format: `<!-- audit-fingerprint:content:blocker=X major=Y -->` (note `:content:` type segment). The `FINGERPRINT_GREP_LITERAL = "<!-- audit-fingerprint:"` matches both types.
- `AppAuditCategory`, `AppAuditFinding`, `BrowserSweepResult` types are defined in `app/lib/app-audit/browser-sweep.server.ts` (NOT in checks.server.ts as TechSpec says). task_18 checks.server.ts MUST import these from browser-sweep.server.ts or re-export them. This avoids circular deps.
- `sweepRoute(page, route)` returns `AppAuditFinding[]` (not BrowserSweepResult) — error case returns `[{category:"sweep-error",...}]` per ADR-006; BrowserSweepResult used internally.
- `runLighthouse(url, runnerOverride?)` — optional `runnerOverride` parameter for test injection (createRequire bypasses Vitest mocks). task_18 calls `runLighthouse(url)` without override; tests pass mock runner.
- `@lhci/cli` LighthouseRunner: `run(url, {chromePath, settings})` — `chromePath` at top level (NOT inside settings). Returns JSON string. LHR categories key is `"best-practices"` (hyphenated).

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
- task_14 complete: `.github/workflows/content-audit.yml` (workflow_dispatch + pull_request paths filter, delta suppression via github-script, peter-evans/create-or-update-comment@v4, artifact upload). `app/tests/content-audit-workflow.test.ts` (19 structural tests). Delta suppression: suppress=true when blocker=0 AND major unchanged from previous comment fingerprint.
- task_15 complete: `.agents/skills/content-audit/SKILL.md` (frontmatter + body: 5 categories, severities, output paths, noTranslation opt-out, abort condition, app-audit V2 pivot, a11y-testing non-overlap note). `.claude/skills/content-audit` symlink → `../../.agents/skills/content-audit`. `.claude/commands/content-audit.md` slash-command wrapper. `.agents/rules/audit.md` (coverage matrix, category defs, abort condition, a11y-testing clarification). `AGENTS.md` updated (File Structure, Skill Map, Rules list). `app/tests/content-audit-skill.test.ts` (24 tests). **Phase 3 complete.**
- task_16 complete: `@axe-core/playwright@4.11.3` + `@lhci/cli@0.15.1` installed (exact pins). `tests/e2e/audit-fingerprint.ts` created (AuditType, formatFingerprint, FINGERPRINT_GREP_LITERAL). `reporter.server.ts` refactored: imports formatFingerprint, exports escapeMarkdownCell + buildPRCommentBody. Workflow `body-includes` updated to `"<!-- audit-fingerprint:"`, fingerprint format updated to `:content:`. `app/tests/audit-fingerprint.test.ts` (20 tests). **Phase 4 deps + fingerprint infra done.**
- task_17 complete: `app/lib/app-audit/browser-sweep.server.ts` (sweepRoute returns AppAuditFinding[], 7 probes + try/catch), `a11y-adapter.server.ts` (analyzeA11y), `lighthouse.server.ts` (runLighthouse with runnerOverride param for testability). AppAuditCategory + AppAuditFinding + BrowserSweepResult types defined in browser-sweep.server.ts. 62 Vitest tests pass. bun run build passes.
- task_19 complete: `scripts/audit-fe.ts` (parseTrigger/parseRoutes/parseLighthouse/runAppAuditCli exported; parseLighthouse accepts optional ciEnv param for testability). `audit:fe` + `audit` scripts in package.json. `audit-fe`, `app-audit` (alias), `audit` Makefile targets. `.gitignore` updated. `.github/workflows/app-audit.yml` (workflow_dispatch with lighthouse choice input default "false", paths filter on app/routes/** + app/components/** + app/lib/** + app/db/schema.ts, Postgres service, preview server, delta PR comment body-includes "<!-- audit-fingerprint:app:"). 66 tests pass. Committed 725e53a.
- task_20 complete: `.agents/skills/app-audit/SKILL.md` (frontmatter + 12-category body), `.claude/skills/app-audit` symlink, `.claude/commands/app-audit.md`, `.agents/rules/fe-audit.md` (12 categories, severity scheme, abort condition 3 runs, Triage Workflow, Lighthouse variance notes, fingerprint collision docs). AGENTS.md + cicd.md updated. `app/tests/app-audit-skill.test.ts` (20 tests). Note: fe-audit.md triage section header is "Triage Workflow" (capitalized) — tests check for "Triage Workflow" not lowercase "triage". **Phase 4 complete.**
