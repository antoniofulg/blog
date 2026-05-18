# TechSpec-007: E2E Coverage + Content Audit Skill Pair

## Executive Summary

Two paired agent skills — `e2e-coverage` and `content-audit` — built on a single shared `site-model.server.ts` module that walks `app/routes/` and `app/content/posts/` on demand. End-to-end coverage uses Playwright with a per-suite PGLite singleton (workers=1) and the canonical Playwright `setup` project + `storageState` auth pattern. Content audit uses unified + remark-mdx to parse MDX into AST and validate frontmatter, en↔pt-br translation parity, internal-link integrity, image alt text, and series consistency.

The primary technical trade-off is **simplicity over parallelism**: `workers: 1` serializes the e2e suite, capping V1 at ~90 s total runtime, but removes per-worker PGLite lifecycle complexity and per-spec login overhead. The trade-off is acceptable for the 3-spec V1; revisiting parallelism is gated on the suite growing past 5 specs.

## System Architecture

### Component Overview

```
                  app/lib/site-model.server.ts
                  (single producer of route + post knowledge)
                              │
                ┌─────────────┴─────────────┐
                ▼                           ▼
     tests/e2e/ (Playwright)        app/lib/content-audit/
     ┌──────────────────────┐       ┌─────────────────────────┐
     │ auth.setup.ts        │       │ link-parser.server.ts   │
     │ fixtures/auth.ts     │       │ checks.server.ts        │
     │ db.ts (PGLite)       │       │ reporter.server.ts      │
     │ seed.ts              │       │                         │
     │ auth-flow.spec.ts    │       │ scripts/audit-content.ts│
     │ admin-write.spec.ts  │       └─────────────────────────┘
     │ public-read.spec.ts  │                  │
     └──────────────────────┘                  ▼
                │                  docs/_reports/content-audit-*.md
                ▼                  docs/audits/SUMMARY.md (committed)
       Playwright HTML report
       (CI artifact)
                │
                ▼
    .github/workflows/ci.yml (e2e matrix entry)
    .github/workflows/content-audit.yml (paths-filtered + workflow_dispatch)
    scripts/lint-test-annotations.ts (CI lint step, 48 h SLA)
```

**Component responsibilities:**

- **`app/lib/site-model.server.ts`** — single producer. Exports `getRouteInventory()` (file-system walk of `app/routes/**/*.tsx` joined against a static metadata map) and `getPostInventory()` (filesystem walk of `app/content/posts/**/*.mdx` joined against `posts` table). Stubbed in `vite.config.ts:serverOnlyStubPlugin` for client bundles.
- **`tests/e2e/`** — Playwright surface. Three capability specs (`auth-flow`, `admin-write`, `public-read`), one auth setup (`auth.setup.ts`), shared fixture (`fixtures/auth.ts`), shared PGLite test DB (`db.ts`), shared seed helper (`seed.ts`).
- **`app/lib/content-audit/`** — content-audit core. `link-parser.server.ts` (remark-mdx AST walker), `checks.server.ts` (frontmatter + translation + link + alt + series checks), `reporter.server.ts` (markdown report writer + SUMMARY.md append).
- **`scripts/audit-content.ts`** — entry point that wires up checks and reporter; invoked by `bun run audit:content` and by the GH Action.
- **`scripts/lint-test-annotations.ts`** — CI lint step; scans `tests/e2e/**/*.ts` for `@flaky`, `.skip`, `.todo` annotations with ISO-date comments; fails build if any annotation is older than 48 h.
- **`.agents/skills/e2e-coverage/`** + **`.agents/skills/content-audit/`** — SKILL.md files (canonical) with `.claude/skills/*` symlinks.
- **`.github/workflows/ci.yml`** — adds `e2e` as 5th matrix entry; reuses existing `quality` job pattern with `make test:e2e`.
- **`.github/workflows/content-audit.yml`** — new workflow; `workflow_dispatch` + PR `paths` filter on `app/content/posts/**` and `app/db/schema.ts`.

**Data flow:**

1. Skill invocation (slash command or by name) → reads `site-model.server.ts` → diff against `tests/e2e/**` or `docs/audits/SUMMARY.md` → emits action.
2. e2e CI run → Playwright `globalSetup` boots PGLite + seeds admin user → `auth.setup.ts` runs UI login → admin storageState saved → spec files run serially → JSON + HTML report → artifact upload.
3. content-audit run → `getPostInventory()` → `link-parser` builds AST per file → `checks` runs all validators → `reporter` writes per-run markdown + appends SUMMARY row → PR comment posted (CI only).

## Implementation Design

### Core Interfaces

`app/lib/site-model.server.ts`:

```typescript
import type { Locale } from "#/lib/locale";
import type { PostFrontmatter } from "#/types/content";

export type RouteAuthLevel = "public" | "admin";

export type RouteEntry = {
  path: string;                  // "/", "/pt-br/", "/admin", "/pt-br/:slug"
  locale: Locale | null;          // null = outside {-$locale} group (e.g. /login)
  auth: RouteAuthLevel;
  expectedStatus: 200 | 302 | 401 | 404;
  intent: string;                 // "blog home", "admin dashboard", etc.
};

export type PostEntry = {
  slug: string;
  lang: Locale;
  filePath: string;               // relative to repo root
  frontmatter: PostFrontmatter;
  isPublished: boolean;
  hasTwin: boolean;
};

export async function getRouteInventory(): Promise<RouteEntry[]>;
export async function getPostInventory(): Promise<PostEntry[]>;
```

`tests/e2e/db.ts`:

```typescript
import type { PGlite } from "@electric-sql/pglite";
import type { PgliteDatabase } from "drizzle-orm/pglite";

export type TestDb = {
  db: PgliteDatabase<typeof import("#/db/schema") & typeof import("#/db/auth-schema")>;
  client: PGlite;
  connectionString: string;
  close: () => Promise<void>;
};

export async function createTestDb(): Promise<TestDb>;
```

`tests/e2e/fixtures/auth.ts`:

```typescript
import { test as base, type Page } from "@playwright/test";

export type AuthedFixture = {
  authedPage: Page;
  userId: string;
};

export const test = base.extend<AuthedFixture>({
  authedPage: async ({ page }, use) => {
    // storageState applied by playwright.config project; just yield page
    await use(page);
  },
  userId: async ({}, use) => {
    await use(process.env.E2E_ADMIN_USER_ID ?? "");
  },
});

export { expect } from "@playwright/test";
export async function freshLogin(page: Page): Promise<void>;
```

`app/lib/content-audit/checks.server.ts`:

```typescript
export type Severity = "blocker" | "major" | "minor";

export type FindingCategory =
  | "frontmatter-invalid"
  | "translation-gap"
  | "broken-link"
  | "missing-alt-text"
  | "series-gap";

export type Finding = {
  category: FindingCategory;
  severity: Severity;
  filePath: string;
  line?: number;
  message: string;
  detail?: Record<string, string | number>;
};

export async function runContentAudit(): Promise<Finding[]>;
```

### Data Models

No new persistent database tables. PGLite uses the existing `app/db/schema.ts` + `app/db/auth-schema.ts` via `drizzle-kit push` (programmatic API). Static metadata maps for `RouteEntry` live as a const exported from `site-model.server.ts`.

**`docs/audits/SUMMARY.md` row format (committed):**

```markdown
| Date       | Run trigger      | Blocker | Major | Minor | Top finding                                  |
| ---------- | ---------------- | ------- | ----- | ----- | -------------------------------------------- |
| 2026-05-18 | PR #42 (push)    | 0       | 3     | 1     | translation-gap: en/foo missing pt-br twin   |
```

**`docs/_reports/content-audit-YYYY-MM-DD.md` (gitignored per-run report):**

```markdown
# Content Audit — 2026-05-18

**Trigger**: PR #42 (push)
**Status**: pending  <!-- pending | resolved | acknowledged -->
**Findings**: 4 (0 blocker / 3 major / 1 minor)

## Blocker

(none)

## Major

- **translation-gap** (`app/content/posts/en/react-suspense.mdx`)
  - English post has no pt-br twin. Add `app/content/posts/pt-br/react-suspense.mdx` or set `noTranslation: true` in frontmatter.

## Minor

- **series-gap** (`app/content/posts/en/state-management-part-3.mdx`)
  - Series "state-management" has parts [1, 3]; part 2 missing or unpublished.
```

### API Endpoints

No new HTTP endpoints. Surface is CLI + agent-skill:

- `bun test:e2e` → `bunx playwright test`
- `bun test:e2e:ui` → `bunx playwright test --ui`
- `bun test:e2e:debug` → `bunx playwright test --debug`
- `bun audit:content` → `bun run scripts/audit-content.ts`
- `/e2e-coverage` → invokes `.agents/skills/e2e-coverage/SKILL.md`
- `/content-audit` → invokes `.agents/skills/content-audit/SKILL.md`

GitHub Actions workflows are the CI surface:

- `.github/workflows/ci.yml` — existing; `e2e` added as 5th matrix entry.
- `.github/workflows/content-audit.yml` — new; `workflow_dispatch` + `pull_request` (paths-filtered).

## Integration Points

- **`a11y-testing` skill** — separate skill in `.agents/skills/a11y-testing/`. e2e specs MAY invoke it for page-level axe checks on critical routes (e.g., add `@axe-core/playwright` import + `AxeBuilder({ page }).withTags(["wcag2a","wcag2aa","wcag22aa"]).analyze()` in `public-read.spec.ts`). Integration is by-reference (skill chaining per Skills 2.0); no library-level coupling. `content-audit` does NOT invoke `a11y-testing` (different surface — content vs runtime DOM).
- **Better Auth (`app/lib/auth.ts`)** — e2e setup imports `auth` to call `auth.api.signUpEmail` for seeding the test user. Login round-trip in `auth.setup.ts` uses the same `/login` form path as production.
- **Drizzle ORM** — `drizzle-kit push` (programmatic API from `drizzle-kit/api`) called by `tests/e2e/db.ts:createTestDb()` to apply schema to PGLite. Both `app/db/schema.ts` and `app/db/auth-schema.ts` are passed as inputs.
- **TanStack Router** — `site-model.server.ts` walks `app/routes/**/*.tsx` matching against route file conventions (excludes `__root.tsx`, `routeTree.gen.ts`, `*.server.ts`). Inventory entries are statically declared; a Vitest drift test enforces parity.

## Impact Analysis

| Component                            | Impact Type | Description and Risk                                                              | Required Action                                                       |
| ------------------------------------ | ----------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `tests/e2e/` directory               | new         | Entire Playwright test surface; new top-level test dir; low risk                  | Create with Phase 1 PR                                                |
| `app/lib/site-model.server.ts`       | new         | Shared producer; consumed by skills + drift test; medium risk if walker is wrong  | Add Vitest drift test in Phase 1                                      |
| `app/lib/content-audit/` directory   | new         | Audit core logic; Phase 3 only                                                    | Land in Phase 3 PR                                                    |
| `scripts/audit-content.ts`           | new         | Entry point invoked by CLI + GH Action; Phase 3                                   | Land in Phase 3 PR                                                    |
| `scripts/lint-test-annotations.ts`   | new         | CI lint script for 48 h SLA; medium risk if regex misfires                        | Land in Phase 1; cover with Vitest test                              |
| `playwright.config.ts`               | new         | Playwright root config; defines projects, retries, workers; low risk              | Land in Phase 1                                                       |
| `.agents/skills/e2e-coverage/`       | new         | SKILL.md + symlink at `.claude/skills/e2e-coverage`; Phase 1                       | Land in Phase 1                                                       |
| `.agents/skills/content-audit/`      | new         | SKILL.md + symlink; Phase 3                                                       | Land in Phase 3                                                       |
| `.agents/rules/testing.md`           | new         | Selector hierarchy, wait strategy, naming, tags; Phase 1                          | Land in Phase 1                                                       |
| `.agents/rules/audit.md`             | new         | Output format, severity, categories; Phase 3                                      | Land in Phase 3                                                       |
| `.github/workflows/content-audit.yml`| new         | Manual + paths-filtered trigger; Phase 3                                          | Land in Phase 3                                                       |
| `docs/audits/SUMMARY.md`             | new         | Committed audit history; Phase 3                                                  | Initialize with header row in Phase 3 PR                              |
| `package.json`                       | modified    | Add devDeps (`@playwright/test`, `@electric-sql/pglite`, `unified`, etc.); scripts (`test:e2e*`, `audit:content`); medium risk on lockfile | Phase 1 + Phase 3                                |
| `.gitignore`                         | modified    | Add `tests/e2e/.auth/`, `tests/e2e/storageState.json`, `test-results/`, `playwright-report/`, `docs/_reports/`; low risk | Phase 1 + Phase 3                            |
| `vite.config.ts`                     | modified    | Add `site-model.server` to `serverOnlyStubPlugin` list; low risk                  | Phase 1                                                               |
| `.github/workflows/ci.yml`           | modified    | Add `e2e` to quality matrix; PR-blocking; medium risk                             | Phase 1                                                               |
| `Makefile`                           | modified    | Add `test-e2e` target invoking `bun test:e2e`; low risk                           | Phase 1                                                               |
| `AGENTS.md`                          | modified    | File Structure (`tests/e2e/`, `docs/_reports/`, `docs/audits/`), Skill Map (2 new rows), Rules list (2 new pointers); low risk | Phase 1 + Phase 3                |
| `.agents/rules/cicd.md`              | modified    | Document e2e gate behavior + content-audit workflow + required GH Secrets         | Phase 1 + Phase 3                                                     |
| `.agents/rules/auth.md`              | modified    | Add anti-pattern — e2e MUST use seeded test user; never commit storageState       | Phase 1                                                               |
| GitHub Secrets                       | new         | `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`; required for CI                          | Documented in `cicd.md`; one-time manual setup before Phase 1 merges  |

## Testing Approach

### Unit Tests

- **`site-model.server.ts` walker functions** — Vitest tests verify `getRouteInventory()` returns expected entries for the current `app/routes/` shape, and that adding/removing a fixture route triggers drift. Mocks `fs/promises` for fixture isolation.
- **`scripts/lint-test-annotations.ts`** — Vitest tests verify the regex correctly identifies `@flaky`, `.skip`, `.todo` with ISO-date comments, computes age, returns exit code 1 for >48 h, exit 0 otherwise. Edge cases: annotation without date, multi-line comments, commented-out annotations.
- **`app/lib/content-audit/link-parser.server.ts`** — Vitest tests with fixture MDX files covering: markdown `[text](url)`, JSX `<Link href="">`, JSX `<a href="">`, fragment-only links, absolute external URLs, relative paths.
- **`app/lib/content-audit/checks.server.ts`** — Vitest per-check tests with handcrafted `PostEntry[]` arrays: translation-gap detection, series-gap detection, frontmatter validation, alt-text presence.

### Integration Tests

- **`app/tests/site-model.test.ts` (drift test)** — Vitest test that walks `app/routes/**/*.tsx` and asserts every file appears in `getRouteInventory()`'s static map. Fails CI if a route is added without an inventory entry. Excludes `__root.tsx` and `routeTree.gen.ts`.
- **`tests/e2e/auth.setup.ts`** — performs the UI login round-trip against the running preview server; saves `tests/e2e/.auth/admin.json`. Acts as both setup and integration test for the auth flow.
- **`tests/e2e/auth-flow.spec.ts`** — full login + session lifecycle + logout against the seeded user.
- **`tests/e2e/admin-write.spec.ts`** — admin dashboard guard, publish/unpublish toggle round-trip, preview unpublished post.
- **`tests/e2e/public-read.spec.ts`** — post render in en + pt-br, locale switcher, 404 path.
- **Content-audit pipeline test** (Phase 3) — Vitest integration test seeds a fixtures directory with sample MDX (including a known broken link and a known translation gap), runs `runContentAudit()`, asserts findings array shape and severities.

## Development Sequencing

### Build Order

#### Phase 1 — Foundation + smoke (branch `TASK-0007/e2e-foundation`)

1. **Install dev dependencies** — `bun add -D @playwright/test @electric-sql/pglite drizzle-orm@latest unified remark-parse remark-mdx unist-util-visit @types/unist`. Then `bunx playwright install chromium`. (no dependencies)
2. **`app/lib/site-model.server.ts`** — implement `RouteEntry` / `PostEntry` types + `getRouteInventory()` + `getPostInventory()` + static metadata map. (depends on 1)
3. **Add `site-model.server` to `vite.config.ts:serverOnlyStubPlugin`** — prevents accidental client bundle inclusion. (depends on 2)
4. **`app/tests/site-model.test.ts` (drift test)** — Vitest test asserts every `app/routes/**/*.tsx` has a matching entry. (depends on 2)
5. **`tests/e2e/db.ts` (`createTestDb()`)** — PGLite + `drizzle-orm/pglite` driver wrapper; programmatic `drizzle-kit push`. (depends on 1)
6. **`tests/e2e/seed.ts`** — exports `seedAdminUser(db)` that uses Better Auth's `auth.api.signUpEmail` against the PGLite-backed auth instance. (depends on 5)
7. **`playwright.config.ts`** — root config: `workers: 1`, `retries: process.env.CI ? 1 : 0`, projects (`setup` + `chromium` with storageState + dependency), webServer entry that spawns `bun preview` with `DATABASE_URL` pointing at PGLite. (depends on 1, 5)
8. **`tests/e2e/global-setup.ts`** — Playwright global setup that calls `createTestDb()` + `seedAdminUser()` and writes the connection string to a temp file or env var for the webServer to read. (depends on 5, 6, 7)
9. **`tests/e2e/global-teardown.ts`** — closes PGLite. (depends on 8)
10. **`tests/e2e/auth.setup.ts`** — single test in `setup` project; performs UI login, saves `storageState` to `tests/e2e/.auth/admin.json`. (depends on 7)
11. **`tests/e2e/fixtures/auth.ts`** — Playwright `test.extend` wrapper exporting `AuthedFixture` type + `freshLogin()` helper. (depends on 10)
12. **`tests/e2e/auth-flow.spec.ts`** — capability spec: login round-trip + session presence + logout. (depends on 11)
13. **`scripts/lint-test-annotations.ts`** — Bun TypeScript script; scans `tests/e2e/**/*.ts` for `@flaky`/`.skip`/`.todo` with ISO-date comments; exits 1 if any annotation older than 48 h. (depends on 12 — needs at least one spec file existing)
14. **Update `package.json`** — add scripts `test:e2e`, `test:e2e:ui`, `test:e2e:debug`, `lint:tests`. Add `make test-e2e` and `make lint-tests` targets in `Makefile`. (depends on 7, 13)
15. **Update `.gitignore`** — `tests/e2e/.auth/`, `tests/e2e/storageState.json`, `test-results/`, `playwright-report/`. (depends on 10)
16. **Update `.github/workflows/ci.yml`** — extend `quality` matrix `check: [test, lint, check, build-js, e2e, lint-tests]` (or add as separate job with chromium download cache). Pass `E2E_ADMIN_EMAIL` + `E2E_ADMIN_PASSWORD` via GitHub Secrets. (depends on 12, 13, 14)
17. **Set GitHub Secrets** — manual one-time step: `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`. Documented in `.agents/rules/cicd.md`. (depends on 16)
18. **`.agents/skills/e2e-coverage/SKILL.md` + symlink** — canonical SKILL.md describing bootstrap, generation, run, fixture conventions, hydration marker, tag taxonomy. Symlink `.claude/skills/e2e-coverage -> ../../.agents/skills/e2e-coverage`. (depends on 12)
19. **Slash-command alias** `/e2e-coverage` — thin wrapper invoking the SKILL.md. (depends on 18)
20. **`.agents/rules/testing.md`** — taxonomy (Vitest vs Playwright), selector hierarchy, wait strategy (ban `waitForTimeout`), naming, tags. (depends on 12)
21. **Update `.agents/rules/auth.md`** — anti-pattern: e2e MUST use seeded test user; never commit storageState. (depends on 6, 15)
22. **Update `.agents/rules/cicd.md`** — document e2e gate + required GH Secrets. (depends on 17)
23. **Update `AGENTS.md`** — File Structure (`tests/e2e/`), Skill Map (e2e-coverage row), Rules list (testing pointer). (depends on 18, 20)
24. **End-Phase 1 checkpoint** — open PR `TASK-0007/e2e-foundation`. CI green requires drift test + e2e + lint:tests all passing. Phase 2 starts only after merge.

#### Phase 2 — Cluster specs (branch `TASK-0007/e2e-specs`)

25. **`tests/e2e/admin-write.spec.ts`** — admin dashboard guard (unauthed→redirect), publish/unpublish toggle, preview route. Uses storageState via project config. (depends on Phase 1 merge: 11, 18)
26. **`tests/e2e/public-read.spec.ts`** — post render in en + pt-br, locale switcher, 404 path. Anonymous session via `test.use({ storageState: { cookies: [], origins: [] } })`. (depends on Phase 1 merge: 7)
27. **End-Phase 2 checkpoint** — open PR `TASK-0007/e2e-specs`. CI must show all 3 specs green on 3 consecutive PRs before declaring Phase 2 done.

#### Phase 3 — Content audit (branch `TASK-0007/content-audit`)

28. **`app/lib/content-audit/link-parser.server.ts`** — `unified()` pipeline with `remark-parse` + `remark-mdx`; `extractLinks(filePath: string): Promise<Link[]>` walks for `link` + `mdxJsxFlowElement`/`mdxJsxTextElement` nodes. (depends on 1 from Phase 1 — remark deps)
29. **`app/lib/content-audit/checks.server.ts`** — implement `runContentAudit(): Promise<Finding[]>`: orchestrates frontmatter validation, translation-gap, link-integrity, alt-text, series checks. Uses `getPostInventory()`. (depends on 28, 2)
30. **`app/lib/content-audit/reporter.server.ts`** — write per-run markdown report to `docs/_reports/content-audit-YYYY-MM-DD.md`; append row to `docs/audits/SUMMARY.md`. (depends on 29)
31. **`scripts/audit-content.ts`** — entry point; calls `runContentAudit()` then `report()`; emits exit code 1 if any `blocker` findings (so workflow_dispatch run can fail explicitly). (depends on 29, 30)
32. **Update `package.json` + `Makefile`** — `audit:content` script + `make audit-content` target. Update `.gitignore` to exclude `docs/_reports/content-audit-*.md`. (depends on 31)
33. **`docs/audits/SUMMARY.md` initial commit** — header row + initial baseline row from first local run. (depends on 31)
34. **`.github/workflows/content-audit.yml`** — `workflow_dispatch` + `pull_request` with `paths: ['app/content/posts/**', 'app/db/schema.ts']`. Steps: checkout → setup-bun → `bun install` → `bun audit:content` → upload report as artifact → post PR comment with delta-only logic via `peter-evans/create-or-update-comment@v4` (`comment-author: github-actions[bot]`, `body-includes: <audit-fingerprint>`). (depends on 31)
35. **`.agents/skills/content-audit/SKILL.md` + symlink** — canonical SKILL.md describing scope, categories, severities, output paths, abort condition. (depends on 31)
36. **Slash-command alias** `/content-audit` — thin wrapper. (depends on 35)
37. **`.agents/rules/audit.md`** — output location, severity scheme, coverage matrix, abort condition (two consecutive zero-actionable-finding runs ⇒ evaluate retirement). (depends on 31)
38. **Update `AGENTS.md`** — File Structure (`docs/_reports/`, `docs/audits/`), Skill Map (content-audit row), Rules list (audit pointer). (depends on 33, 35, 37)
39. **End-Phase 3 checkpoint** — open PR `TASK-0007/content-audit`. CI green + first content-audit run produces baseline SUMMARY row.

### Technical Dependencies

- **Bun 1.3.13+** (already pinned in CI).
- **GitHub Secrets** `E2E_ADMIN_EMAIL` + `E2E_ADMIN_PASSWORD` set in repo settings before Phase 1 PR can pass CI.
- **PGLite version compatibility** — confirm `@electric-sql/pglite` ≥ 0.2 supports `drizzle-orm/pglite` driver version pinned in package.json.
- **Chromium binary cache** — GHA caches `~/.cache/ms-playwright` keyed on lockfile hash to avoid re-downloading Chromium on every CI run.
- **No upstream blockers**: Better Auth Drizzle adapter issue #4305 is the only known external risk; mitigation is the fallback `drizzle-kit push` against the static `app/db/auth-schema.ts` (which is the default path anyway).

## Monitoring and Observability

- **Playwright HTML report** uploaded as GHA artifact (`name: playwright-report`, retention: 30 days) on every e2e CI run, regardless of pass/fail.
- **Playwright JSON report** uploaded alongside HTML; consumed by future flake-rate scripts if needed.
- **`docs/audits/SUMMARY.md`** — committed paper trail; one row per audit run with date + trigger + severity counts + top finding.
- **Per-run audit report** at `docs/_reports/content-audit-YYYY-MM-DD.md` uploaded as GHA artifact when CI-triggered (`name: content-audit-report-${{ github.run_id }}`).
- **PR comment** posted by `peter-evans/create-or-update-comment@v4` action with severity counts + top blockers + artifact link; delta-only suppression based on a hidden HTML comment fingerprint embedded in the comment body.
- **Lint-test-annotations script output** — fails the build with a clear "annotation at <file:line> is <hours>h old, exceeds 48h SLA" message; emits one line per offense.
- **No external telemetry** — no Datadog, Honeycomb, etc. Solo dev consumes GHA UI directly.

## Technical Considerations

### Key Decisions

- **Decision**: TypeScript runtime walker for `site-model.server.ts` (not a generated JSON manifest).
  - **Rationale**: zero manual sync; ~15 routes + ~50 posts walk in <100 ms; drift test enforces parity.
  - **Trade-offs**: every consumer pays the walk cost; static metadata map must be hand-updated for new routes.
  - **Alternatives rejected**: generated JSON (extra workflow step), hybrid cache (cache invalidation complexity), per-skill duplication (defeats shared-model design).

- **Decision**: PGLite singleton + `workers: 1` for e2e.
  - **Rationale**: simplest viable lifecycle; PGLite's single-client model is incompatible with parallel workers anyway; V1 has 3 specs.
  - **Trade-offs**: no parallel speedup; suite caps at ~90 s.
  - **Alternatives rejected**: per-worker (complexity), per-test (slow), shared dev DB (state coupling).

- **Decision**: Playwright canonical auth setup + storageState.
  - **Rationale**: framework-native primitive; minimum custom code; reuses cookies across specs.
  - **Trade-offs**: storageState file leak risk (gitignored + secrets-style hygiene required).
  - **Alternatives rejected**: per-spec fresh login (slow), hybrid (extra API surface), API-level injection (UI login path loses coverage).

- **Decision**: mdast (remark) full parse for content-audit link extraction.
  - **Rationale**: accuracy over speed; catches both markdown and JSX-style links; ~50 ms/file is fine at scale.
  - **Trade-offs**: extra deps (`unified`, `remark-parse`, `remark-mdx`, `unist-util-visit`) — most already transitively present via `@mdx-js/mdx`.
  - **Alternatives rejected**: regex (silent miss on JSX links), strip-JSX-then-regex (brittle), external link-check tool (noise + extra dep).

- **Decision**: Strict-block CI + `@flaky` 48 h SLA + auto-retry-once.
  - **Rationale**: balanced for solo dev — retries dampen transients, annotations enable tracked quarantine, SLA prevents permanent drift. Set in ADR-003.
  - **Trade-offs**: lint script is new infra to maintain (~50 LOC).
  - **Alternatives rejected**: documented in ADR-003.

### Known Risks

- **PGLite/Drizzle adapter version skew** — likelihood: medium. `@electric-sql/pglite` evolves quickly; a breaking change could surface mid-development. *Mitigation*: pin exact versions; upgrade through dedicated PR.
- **Vite stub plugin omission** — likelihood: medium. If `site-model.server.ts` isn't added to `serverOnlyStubPlugin` in `vite.config.ts`, the client bundle attempts to import filesystem APIs and SSR breaks. *Mitigation*: build step in step 3 of Phase 1 is explicit; covered by build CI matrix entry.
- **Lint script regex false positives** — likelihood: low-medium. The `@flaky` / `.skip` / `.todo` regex must distinguish real test annotations from string literals or comments referencing them. *Mitigation*: TypeScript AST-based scan via Bun's built-in parser instead of regex (Step 13); Vitest unit tests cover edge cases.
- **Better Auth CLI generator issue #4305** — likelihood: low. The existing `app/db/auth-schema.ts` is static and complete; we never invoke the CLI generator in our flow. *Mitigation*: no action needed unless we adopt CLI-based regeneration later.
- **PR-comment delta suppression edge cases** — likelihood: medium. Multiple pushes to same PR may double-post or miss updates. *Mitigation*: use `comment-id` from previous run (stored in workflow artifact or via `body-includes` fingerprint match); Phase 3 acceptance test must exercise the multi-push case.
- **Drift test false positive on deliberate exclusions** — likelihood: low. A dev-only diagnostic route would trigger drift. *Mitigation*: opt-out entry in the static map (`expectedStatus: null` semantics) documented in `testing.md`.
- **storageState leak** — likelihood: low but high-impact. Accidental commit of `.auth/admin.json` leaks the e2e session token. *Mitigation*: explicit `.gitignore` entry from Phase 1 step 15; Biome or pre-commit hook adds a glob rule to reject `**/.auth/**` files.

## Architecture Decision Records

- [ADR-001: V1 scope and architecture for e2e-coverage + app-audit skill pair](adrs/adr-001.md) — Council-validated decision establishing shared site-model + 2 renderers + 3 capability specs + owned auth fixture + PGLite + PR-blocking CI.
- [ADR-002: Pivot audit skill from browser-sweep to content-audit](adrs/adr-002.md) — Opportunity-scan supersession of ADR-001's app-audit scope; audit targets MDX/frontmatter/translation/link/alt/series instead of browser runtime.
- [ADR-003: PRD scope and phased delivery model](adrs/adr-003.md) — Single PRD covering 3 phases delivered as 3 PRs; CI failure handling combines strict-block + `@flaky` 48 h SLA + auto-retry-once.
- [ADR-004: TechSpec implementation primitives](adrs/adr-004.md) — TypeScript runtime walker for site-model, PGLite singleton + `workers: 1`, Playwright canonical auth setup + storageState, mdast (remark) full parse for MDX links.
