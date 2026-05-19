# TechSpec-007: E2E Coverage + Content Audit + App Audit Skill Trio

## Executive Summary

Three paired agent skills — `e2e-coverage`, `content-audit`, and `app-audit` — built on a single shared `site-model.server.ts` module that walks `app/routes/` and `app/content/posts/` on demand. End-to-end coverage uses Playwright with a per-suite PGLite singleton (workers=1) and the canonical Playwright `setup` project + `storageState` auth pattern. Content audit uses unified + remark-mdx to parse MDX into AST and validate frontmatter, en↔pt-br translation parity, internal-link integrity, image alt text, and series consistency. App-audit (Phase 4, ADR-005) is a fuzzer that walks every route × locale × auth-state combination via Playwright probes for console errors, network failures, missing meta, image health, mixed-content, hydration mismatches, slow responses, plus delegated a11y checks via `@axe-core/playwright` and optional Lighthouse perf/SEO/best-practices via `@lhci/cli` sharing Playwright's bundled Chromium.

The primary technical trade-off is **simplicity over parallelism**: `workers: 1` serializes the e2e suite, capping V1 at ~90 s total runtime, but removes per-worker PGLite lifecycle complexity and per-spec login overhead. The trade-off is acceptable for the 3-spec V1; revisiting parallelism is gated on the suite growing past 5 specs.

Phase 4 introduces a secondary trade-off: **signal coverage over CI cleanliness**. App-audit's 11+1 categories (11 from ADR-005 plus `sweep-error` from ADR-006) walk 28 inspections per run and accept Lighthouse score variance (±10 perf-points on shared GHA runners) as a known noise vector. Mitigations: counts-only PR-comment fingerprint suppresses re-posts when blocker + major counts are stable; Lighthouse default ON locally / OFF in CI (per ADR-006); per-route try/catch emits `sweep-error` findings so partial failures stay observable without aborting the whole run.

## System Architecture

### Component Overview

```
                  app/lib/site-model.server.ts
                  (single producer of route + post knowledge)
                              │
                ┌─────────────┼──────────────┐
                ▼             ▼              ▼
     tests/e2e/        app/lib/        app/lib/
     (Playwright)      content-audit/  app-audit/
     ┌────────────┐    ┌─────────────┐ ┌──────────────────────┐
     │ auth.setup │    │ link-parser │ │ browser-sweep        │
     │ fixtures/  │    │ checks      │ │ checks               │
     │ db.ts      │    │ reporter    │ │ a11y-adapter         │
     │ seed       │    │             │ │ lighthouse           │
     │ auth-flow  │    │ scripts/    │ │ reporter             │
     │ admin-write│    │ audit-      │ │                      │
     │ public-read│    │ content.ts  │ │ scripts/audit-fe.ts  │
     └────────────┘    └─────────────┘ └──────────────────────┘
            │                │                    │
            │                ▼                    ▼
            │   docs/_reports/content-audit-*.md  docs/_reports/app-audit-*.md
            │                ▼                    ▼
            │            docs/audits/SUMMARY.md (committed, `Type` column)
            ▼
     Playwright HTML report (CI artifact)
     Lighthouse HTML report (CI artifact when --lighthouse=true)
            │
            ▼
   .github/workflows/ci.yml (e2e matrix entry — PR-blocking)
   .github/workflows/content-audit.yml (paths-filtered + workflow_dispatch — informational)
   .github/workflows/app-audit.yml (paths-filtered + workflow_dispatch — informational)
   scripts/lint-test-annotations.ts (CI lint step, 48 h SLA)
   tests/e2e/audit-fingerprint.ts (typed AuditType union + fingerprint helper, shared)
```

**Component responsibilities:**

- **`app/lib/site-model.server.ts`** — single producer. Exports `getRouteInventory()` (file-system walk of `app/routes/**/*.tsx` joined against a static metadata map) and `getPostInventory()` (filesystem walk of `app/content/posts/**/*.mdx` joined against `posts` table). Stubbed in `vite.config.ts:serverOnlyStubPlugin` for client bundles. `RouteEntry` shape unchanged in Phase 4 (no audit-specific fields per ADR-005).
- **`tests/e2e/`** — Playwright surface. Three capability specs (`auth-flow`, `admin-write`, `public-read`), one auth setup (`auth.setup.ts`), shared fixture (`fixtures/auth.ts`), shared PGLite test DB (`db.ts`), shared seed helper (`seed.ts`). Also hosts the new `audit-fingerprint.ts` module (Phase 4) exporting `AuditType` union and `formatFingerprint()` helper shared by both audit reporters.
- **`app/lib/content-audit/`** — content-audit core. `link-parser.server.ts` (remark-mdx AST walker), `checks.server.ts` (frontmatter + translation + link + alt + series checks), `reporter.server.ts` (markdown report writer + SUMMARY.md append; exports `escapeMarkdownCell` for app-audit reuse).
- **`app/lib/app-audit/`** — app-audit core (Phase 4). `browser-sweep.server.ts` (Playwright probe orchestrating console/network/meta/image/mixed-content/hydration/slow-response listeners per route, with per-route try/catch + `sweep-error` finding emission per ADR-006), `checks.server.ts` (orchestrator running all category checks across the 28-inspection matrix), `a11y-adapter.server.ts` (direct `@axe-core/playwright` invocation with WCAG 2/2.2 AA tags), `lighthouse.server.ts` (optional `@lhci/cli` runner sharing Playwright's bundled Chromium via `chromium.executablePath()` per ADR-006), `reporter.server.ts` (markdown report writer + SUMMARY.md append; imports `escapeMarkdownCell` from content-audit's reporter — no duplication).
- **`scripts/audit-content.ts`** — content-audit entry point; invoked by `bun run audit:content` and by the GH Action.
- **`scripts/audit-fe.ts`** — app-audit entry point (Phase 4); invoked by `bun run audit:fe`, `make audit-fe`, `make app-audit`, the GH Action, and `make audit` (composite). Defaults Lighthouse ON locally / OFF in CI per ADR-006; honors `--lighthouse` / `--no-lighthouse` overrides. Emits `[audit-counts] blockers=N majors=N minors=N` machine-readable line for the workflow to parse.
- **`scripts/lint-test-annotations.ts`** — CI lint step; scans `tests/e2e/**/*.ts` for `@flaky`, `.skip`, `.todo` annotations with ISO-date comments; fails build if any annotation is older than 48 h.
- **`.agents/skills/e2e-coverage/`** + **`.agents/skills/content-audit/`** + **`.agents/skills/app-audit/`** — SKILL.md files (canonical) with `.claude/skills/*` symlinks.
- **`.github/workflows/ci.yml`** — adds `e2e` as 5th matrix entry; reuses existing `quality` job pattern with `make test:e2e`. Unchanged in Phase 4.
- **`.github/workflows/content-audit.yml`** — content-audit workflow; `workflow_dispatch` + PR `paths` filter on `app/content/posts/**` and `app/db/schema.ts`. Reporter refactored in Phase 4 to import fingerprint helper from `tests/e2e/audit-fingerprint.ts` (same behavior, single source of truth).
- **`.github/workflows/app-audit.yml`** — app-audit workflow (Phase 4); `workflow_dispatch` (with `lighthouse: false` default input) + PR `paths` filter on `app/routes/**`, `app/components/**`, `app/lib/**`, `app/db/schema.ts`. Uploads per-run report + optional Lighthouse HTML as artifacts; posts delta-only PR comment via `peter-evans/create-or-update-comment@v4` with fingerprint marker `<!-- audit-fingerprint:app:blocker=X major=Y -->`.

**Data flow:**

1. Skill invocation (slash command or by name) → reads `site-model.server.ts` → diff against `tests/e2e/**` or `docs/audits/SUMMARY.md` → emits action.
2. e2e CI run → Playwright `globalSetup` boots PGLite + seeds admin user → `auth.setup.ts` runs UI login → admin storageState saved → spec files run serially → JSON + HTML report → artifact upload.
3. content-audit run → `getPostInventory()` → `link-parser` builds AST per file → `checks` runs all validators → `reporter` writes per-run markdown + appends SUMMARY row (`Type: content`) → PR comment posted (CI only).
4. app-audit run → `getRouteInventory()` → `browser-sweep` iterates `routes × locales × auth-state` (28 inspections; per-route try/catch emits `sweep-error` finding on probe failure) → optional `lighthouse` adapter runs `@lhci/cli` per route (default OFF in CI) → `a11y-adapter` runs `AxeBuilder` per route → `checks` orchestrator collects all findings → `reporter` writes per-run markdown + appends SUMMARY row (`Type: app`) → PR comment posted with counts-only fingerprint (CI only).

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

`app/lib/app-audit/checks.server.ts` (Phase 4):

```typescript
export type AppAuditCategory =
  | "console-error"
  | "hydration-mismatch"
  | "network-fail"
  | "broken-image"
  | "missing-meta"
  | "mixed-content"
  | "slow-response"
  | "a11y-violation"
  | "seo-score-drop"
  | "perf-budget-breach"
  | "best-practices-fail"
  | "sweep-error"; // ADR-006: probe-infra failures, excluded from abort-condition

export type AppAuditFinding = {
  category: AppAuditCategory;
  severity: Severity; // reuses content-audit's union
  filePath: string;   // route path or asset URL
  message: string;
  detail?: Record<string, string | number>;
};

export async function runAppAudit(opts: { lighthouse: boolean }): Promise<AppAuditFinding[]>;
```

`app/lib/app-audit/browser-sweep.server.ts` (Phase 4):

```typescript
import type { Page } from "@playwright/test";
import type { RouteEntry } from "#/lib/site-model.server";

export type BrowserSweepResult = {
  route: RouteEntry;
  consoleErrors: string[];
  failedRequests: { url: string; status: number; reason: string }[];
  hydrationMismatch: boolean;
  metaPresent: Record<string, boolean>;
  brokenImages: string[]; // src URLs with naturalWidth === 0
  mixedContent: boolean;
  firstPaintMs: number;
};

export async function sweepRoute(
  page: Page,
  route: RouteEntry,
): Promise<BrowserSweepResult>;
```

`app/lib/app-audit/lighthouse.server.ts` (Phase 4):

```typescript
export type LighthouseScores = {
  performance: number;   // 0-1
  accessibility: number; // 0-1 (duplicates a11y-adapter coverage; informational)
  bestPractices: number; // 0-1
  seo: number;           // 0-1
};

export async function runLighthouse(url: string): Promise<LighthouseScores>;
```

`tests/e2e/audit-fingerprint.ts` (Phase 4, shared by both reporters):

```typescript
export type AuditType = "content" | "app";

export function formatFingerprint(
  type: AuditType,
  counts: { blocker: number; major: number },
): string {
  return `<!-- audit-fingerprint:${type}:blocker=${counts.blocker} major=${counts.major} -->`;
}

export const FINGERPRINT_GREP_LITERAL = "<!-- audit-fingerprint:";
```

### Data Models

No new persistent database tables. PGLite uses the existing `app/db/schema.ts` + `app/db/auth-schema.ts` via `drizzle-kit push` (programmatic API). Static metadata maps for `RouteEntry` live as a const exported from `site-model.server.ts`.

**`docs/audits/SUMMARY.md` row format (committed) — Phase 4 adds `Type` column:**

```markdown
| Date       | Type    | Run trigger      | Blocker | Major | Minor | Top finding                                  |
| ---------- | ------- | ---------------- | ------- | ----- | ----- | -------------------------------------------- |
| 2026-05-18 | content | PR #42 (push)    | 0       | 3     | 1     | translation-gap: en/foo missing pt-br twin   |
| 2026-05-19 | app     | manual           | 1       | 4     | 7     | console-error: TypeError on /admin/preview/foo |
```

**`Type` column migration**: Phase 4's first `app-audit` reporter run detects whether SUMMARY.md already has the column (regex match on header line). If absent, the reporter's `initSummary()` step rewrites the file once: parses existing rows, inserts `content` value in the new column, writes back. Idempotent: subsequent calls detect the column and skip migration. Migration logic lives in `app/lib/app-audit/reporter.server.ts`; covered by Vitest test with a fixture pre-Phase-4 SUMMARY file.

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
- `bun audit:fe` → `bun run scripts/audit-fe.ts` (Phase 4)
- `bun audit` → composite; runs both `audit:content` and `audit:fe` sequentially (Phase 4)
- `/e2e-coverage` → invokes `.agents/skills/e2e-coverage/SKILL.md`
- `/content-audit` → invokes `.agents/skills/content-audit/SKILL.md`
- `/app-audit` → invokes `.agents/skills/app-audit/SKILL.md` (Phase 4)

CLI flag conventions:

- `audit:content` — `--trigger=<label>` (default "manual"), `--content-dir=<path>` (default `app/content/posts`).
- `audit:fe` (Phase 4) — `--trigger=<label>` (default "manual"), `--routes=<csv>` (default: all inventoried routes), `--lighthouse` / `--no-lighthouse` (default ON locally / OFF in CI per ADR-006).
- Both audit scripts emit a `[audit-counts] blockers=N majors=N minors=N` machine-readable line for workflow parsing (mirrors round 2 issue 003 fix from content-audit).

GitHub Actions workflows are the CI surface:

- `.github/workflows/ci.yml` — existing; `e2e` added as 5th matrix entry. Unchanged in Phase 4.
- `.github/workflows/content-audit.yml` — `workflow_dispatch` + `pull_request` (paths-filtered on `app/content/posts/**` + `app/db/schema.ts`).
- `.github/workflows/app-audit.yml` — Phase 4; `workflow_dispatch` (with `lighthouse: choice ["false","true"]` input, default `"false"`) + `pull_request` (paths-filtered on `app/routes/**`, `app/components/**`, `app/lib/**`, `app/db/schema.ts`).

Makefile targets:

- `make test-e2e` / `make e2e` (alias) — Playwright suite.
- `make lint-tests` — annotation 48h SLA linter.
- `make audit-content` — content-audit only.
- `make audit-fe` / `make app-audit` (alias) — app-audit only (Phase 4).
- `make audit` — composite running both audit-content + audit-fe (Phase 4).

## Integration Points

- **`a11y-testing` skill** — separate skill in `.agents/skills/a11y-testing/`. e2e specs MAY invoke it for page-level axe checks on critical routes. `content-audit` does NOT invoke `a11y-testing` (different surface — content vs runtime DOM). `app-audit` (Phase 4) calls `@axe-core/playwright` DIRECTLY (not via skill invocation) for per-route a11y checks; `a11y-testing` remains canonical for component-level deep-dive audits invoked by the developer conversationally.
- **Better Auth (`app/lib/auth.ts`)** — e2e setup imports `auth` to call `auth.api.signUpEmail` for seeding the test user. Login round-trip in `auth.setup.ts` uses the same `/login` form path as production. App-audit (Phase 4) reuses the seeded user via the same auth fixture for admin-session route walks.
- **Drizzle ORM** — `drizzle-kit push` (programmatic API from `drizzle-kit/api`) called by `tests/e2e/db.ts:createTestDb()` to apply schema to PGLite. Both `app/db/schema.ts` and `app/db/auth-schema.ts` are passed as inputs. App-audit (Phase 4) reuses the same PGLite test DB unchanged.
- **TanStack Router** — `site-model.server.ts` walks `app/routes/**/*.tsx` matching against route file conventions (excludes `__root.tsx`, `routeTree.gen.ts`, `*.server.ts`). Inventory entries are statically declared; a Vitest drift test enforces parity. App-audit (Phase 4) iterates `getRouteInventory()` directly; `RouteEntry` shape unchanged.
- **Playwright Chromium binary** (Phase 4) — `@lhci/cli` is configured to share Playwright's bundled Chromium via `chromium.executablePath()` from `@playwright/test`. Single binary cache on CI; no second Chrome download. ADR-006 documents the fallback path if Playwright's Chromium version ages out of Lighthouse's supported range.
- **`@axe-core/playwright`** (Phase 4) — direct integration in `app/lib/app-audit/a11y-adapter.server.ts`. WCAG 2.0 / 2.2 AA tag set. Per-route invocation against the same Playwright `Page` used by the browser sweep; no separate page lifecycle.
- **`@lhci/cli` Lighthouse runner** (Phase 4) — optional integration in `app/lib/app-audit/lighthouse.server.ts`. Default ON locally / OFF in CI per ADR-006. Outputs `categories.{performance,accessibility,bestPractices,seo}.score` (0-1) mapped to severity per ADR-005 thresholds (perf<0.8=minor, seo<0.9=minor, best-practices<0.9=minor).
- **`peter-evans/create-or-update-comment@v4`** — shared by content-audit and app-audit workflows. Both use `body-includes` literal-string matching on the fingerprint marker (per ADR-006's literal-grep guidance) to find and update the rolling comment. Fingerprint markers differentiated by audit type (`audit-fingerprint:content:...` vs `audit-fingerprint:app:...`).

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
| `app/lib/app-audit/` directory       | new         | App-audit core logic (5 modules); Phase 4                                         | Land in Phase 4 PR (same branch as Phases 1-3 per ADR-005)            |
| `scripts/audit-fe.ts`                | new         | Entry point invoked by CLI + GH Action; Phase 4                                   | Land in Phase 4                                                       |
| `tests/e2e/audit-fingerprint.ts`     | new         | Shared `AuditType` union + fingerprint helper for both audit reporters; Phase 4   | Land in Phase 4; content-audit reporter refactored to import          |
| `.agents/skills/app-audit/`          | new         | SKILL.md + symlink at `.claude/skills/app-audit`; Phase 4                          | Land in Phase 4                                                       |
| `.agents/rules/fe-audit.md`          | new         | Severity scheme, category definitions, abort condition (3-run), triage workflow; Phase 4 | Land in Phase 4                                                |
| `.github/workflows/app-audit.yml`    | new         | `workflow_dispatch` (lighthouse choice input) + paths-filtered PR trigger; Phase 4 | Land in Phase 4                                                       |
| `docs/audits/SUMMARY.md`             | modified    | Add `Type` column; migrate existing content-audit rows to `content` value; Phase 4 | Migration via `reporter.server.ts:initSummary()`; Vitest test covers idempotency |
| `app/lib/content-audit/reporter.server.ts` | modified | Refactor fingerprint logic to import from `tests/e2e/audit-fingerprint.ts` (no behavior change); Phase 4 | Co-located change with Phase 4 fingerprint module landing  |
| `.github/workflows/content-audit.yml` | modified   | Update workflow fingerprint detection to use shared helper; Phase 4               | Co-located with reporter refactor                                     |
| `package.json`                       | modified    | Add devDeps (`@axe-core/playwright`, `@lhci/cli`); scripts (`audit:fe`, `audit`); Phase 4 | Phase 4                                                       |
| `.gitignore`                         | modified    | Add `docs/_reports/app-audit-*.md`; Phase 4                                       | Phase 4                                                               |
| `vite.config.ts`                     | modified    | Add 5 `app/lib/app-audit/*.server` modules to `serverOnlyStubPlugin`; Phase 4     | Phase 4                                                               |
| `Makefile`                           | modified    | Add `audit-fe`, `app-audit` alias, composite `audit`; Phase 4                     | Phase 4                                                               |
| `AGENTS.md`                          | modified    | Skill Map adds `app-audit` row; Rules list adds `fe-audit` pointer; Phase 4       | Phase 4                                                               |
| `.agents/rules/cicd.md`              | modified    | Document app-audit workflow + Lighthouse input + GH Secrets unchanged; Phase 4   | Phase 4                                                               |

## Testing Approach

### Unit Tests

- **`site-model.server.ts` walker functions** — Vitest tests verify `getRouteInventory()` returns expected entries for the current `app/routes/` shape, and that adding/removing a fixture route triggers drift. Mocks `fs/promises` for fixture isolation.
- **`scripts/lint-test-annotations.ts`** — Vitest tests verify the regex correctly identifies `@flaky`, `.skip`, `.todo` with ISO-date comments, computes age, returns exit code 1 for >48 h, exit 0 otherwise. Edge cases: annotation without date, multi-line comments, commented-out annotations.
- **`app/lib/content-audit/link-parser.server.ts`** — Vitest tests with fixture MDX files covering: markdown `[text](url)`, JSX `<Link href="">`, JSX `<a href="">`, fragment-only links, absolute external URLs, relative paths.
- **`app/lib/content-audit/checks.server.ts`** — Vitest per-check tests with handcrafted `PostEntry[]` arrays: translation-gap detection, series-gap detection, frontmatter validation, alt-text presence.
- **`app/lib/app-audit/browser-sweep.server.ts`** (Phase 4) — Vitest tests for individual listeners: console-error filter (rejects info/warning, accepts error), network-fail classifier (5xx → blocker, 4xx → major), meta presence checker (title/description/og:title/og:image/canonical/viewport), broken-image detector (`naturalWidth === 0` heuristic), mixed-content detector. Mock `page.on(...)` and `page.locator(...)` for fixture isolation. Cover `sweep-error` finding emission when a probe throws.
- **`app/lib/app-audit/checks.server.ts`** (Phase 4) — Vitest orchestrator tests with handcrafted `BrowserSweepResult[]` arrays + mocked `a11y-adapter` and `lighthouse` modules. Assert severity mapping (`blocker` console-error / `blocker` 5xx network-fail / `major` 4xx network-fail / etc.). Cover Lighthouse-disabled path (flag false) skips lighthouse adapter invocation.
- **`scripts/audit-fe.ts` flag parsing** (Phase 4) — Vitest tests for all 4 input combinations: `--lighthouse`, `--no-lighthouse`, `CI=true` env, `CI` unset env. Assert correct default per ADR-006 (ON locally, OFF in CI).
- **`tests/e2e/audit-fingerprint.ts`** (Phase 4) — Vitest tests for `formatFingerprint("content", { blocker: 1, major: 2 })` and `formatFingerprint("app", { blocker: 0, major: 5 })`. Assert literal-string output matches expected marker format.
- **`app/lib/app-audit/reporter.server.ts:initSummary()` migration** (Phase 4) — Vitest tests with fixture SUMMARY.md files: (a) pre-Phase-4 format (no Type column) → migration writes header + backfills `content` value; (b) post-migration format → no-op; (c) empty file → header-only initialization.

### Integration Tests

- **`app/tests/site-model.test.ts` (drift test)** — Vitest test that walks `app/routes/**/*.tsx` and asserts every file appears in `getRouteInventory()`'s static map. Fails CI if a route is added without an inventory entry. Excludes `__root.tsx` and `routeTree.gen.ts`.
- **`tests/e2e/auth.setup.ts`** — performs the UI login round-trip against the running preview server; saves `tests/e2e/.auth/admin.json`. Acts as both setup and integration test for the auth flow.
- **`tests/e2e/auth-flow.spec.ts`** — full login + session lifecycle + logout against the seeded user.
- **`tests/e2e/admin-write.spec.ts`** — admin dashboard guard, publish/unpublish toggle round-trip, preview unpublished post.
- **`tests/e2e/public-read.spec.ts`** — post render in en + pt-br, locale switcher, 404 path.
- **Content-audit pipeline test** (Phase 3) — Vitest integration test seeds a fixtures directory with sample MDX (including a known broken link and a known translation gap), runs `runContentAudit()`, asserts findings array shape and severities.
- **App-audit pipeline test** (Phase 4) — Vitest integration test spawns PGLite + preview server, runs `runAppAudit({ lighthouse: false })` against a fixture site-model with 2 routes, asserts findings array contains `console-error` and `missing-meta` findings injected via deliberately-broken fixture HTML. Lighthouse-enabled path covered as a separate skipped-by-default test (slow, requires `@lhci/cli` cold start).
- **App-audit reporter + SUMMARY migration end-to-end** (Phase 4) — runs `reporter.writeReport([...])` on a fresh SUMMARY.md and on a pre-Phase-4 SUMMARY.md; asserts (a) Type column exists; (b) existing rows backfilled with `content`; (c) new row appended with `app` type; (d) idempotency (second call doesn't duplicate header or re-migrate).
- **Workflow YAML linting** (Phase 4) — Vitest test parses `.github/workflows/app-audit.yml` via `yaml` package; asserts `workflow_dispatch.inputs.lighthouse` schema, `pull_request.paths` filter list, fingerprint marker string in PR-comment step.
- **Composite `make audit` test** (Phase 4) — shell-level test (or Vitest spawn child) runs `make audit` against fixture site, asserts both `audit-content` and `audit-fe` complete and exit 0, both SUMMARY rows appended.

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

#### Phase 4 — App-audit (same branch `TASK-0007/e2e-audit-skills`; single PR delivers all four phases per ADR-005 user choice)

40. **Install Phase 4 dev dependencies** — `bun add -D @axe-core/playwright @lhci/cli`. Lighthouse transitive via `@lhci/cli`. (depends on 1 from Phase 1 — Chromium binary already installed via Playwright)
41. **`tests/e2e/audit-fingerprint.ts`** — shared `AuditType` union (`"content" | "app"`) + `formatFingerprint(type, counts): string` helper + `FINGERPRINT_GREP_LITERAL` constant. Single source of truth for both audit reporters' fingerprint markers. (depends on 1)
42. **Refactor `app/lib/content-audit/reporter.server.ts`** to import fingerprint helper from step 41 (no behavior change). Verify content-audit Vitest suite still passes. (depends on 41, Phase 3 step 30)
43. **Update `.github/workflows/content-audit.yml`** to use the shared `FINGERPRINT_GREP_LITERAL` constant in the `body-includes` grep call (literal-string match; no regex). (depends on 42)
44. **`app/lib/app-audit/browser-sweep.server.ts`** — Playwright probe module: `sweepRoute(page, route)` opens the route, attaches `page.on("console")` + `page.on("requestfailed")` listeners, asserts meta tags via `page.locator("meta")`, evaluates `<img>` for `naturalWidth === 0`, detects mixed-content via console warning filter, captures `performance.timing` for slow-response heuristic. Per-route try/catch wraps the probe and emits a `sweep-error` finding on throw per ADR-006. (depends on 40, 2 from Phase 1)
45. **`app/lib/app-audit/a11y-adapter.server.ts`** — wraps `new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze()` per route; maps axe-core results to `AppAuditFinding[]` with `category: "a11y-violation"`, `severity: "major"`. (depends on 40, 44)
46. **`app/lib/app-audit/lighthouse.server.ts`** — wraps `@lhci/cli` invocation with `chromePath = chromium.executablePath()` from `@playwright/test` (per ADR-006); returns `LighthouseScores` object; emits findings per ADR-005 thresholds (perf < 0.8 → `perf-budget-breach` minor; seo < 0.9 → `seo-score-drop` minor; bestPractices < 0.9 → `best-practices-fail` minor). (depends on 40, 1)
47. **`app/lib/app-audit/checks.server.ts`** — `runAppAudit({ lighthouse })` orchestrator: iterates `getRouteInventory()` × locales × auth-state (28 inspections), invokes `browser-sweep` + `a11y-adapter` per route, conditionally invokes `lighthouse` adapter, aggregates all findings into `AppAuditFinding[]`. (depends on 44, 45, 46, 2)
48. **`app/lib/app-audit/reporter.server.ts`** — writes per-run markdown report to `docs/_reports/app-audit-YYYY-MM-DD.md`; appends row to `docs/audits/SUMMARY.md` with `Type: app` column. Includes `initSummary()` migration logic per ADR-006 — detects pre-Phase-4 SUMMARY format, backfills existing content-audit rows with `Type: content`, writes header with new column. Idempotent. Imports `escapeMarkdownCell` from `content-audit/reporter.server.ts`. (depends on 47, 30 from Phase 3, 41)
49. **Add 5 new `app/lib/app-audit/*.server.ts` paths to `vite.config.ts:serverOnlyStubPlugin`** — prevents accidental client bundle inclusion. (depends on 44, 45, 46, 47, 48)
50. **`scripts/audit-fe.ts`** — Bun TypeScript entry; argv parsing for `--trigger`, `--routes`, `--lighthouse` / `--no-lighthouse` per ADR-006 (default ON locally / OFF in CI); spawns preview server (or assumes one running), invokes `runAppAudit({ lighthouse })`, calls `writeReport()`, emits `[audit-counts]` machine-readable line, exits 1 if any `blocker` finding. (depends on 47, 48)
51. **Update `package.json` + `Makefile`** — add scripts `audit:fe`, `audit` (composite). Add Makefile targets `audit-fe`, `app-audit` (alias), `audit` (composite invoking `audit-content` then `audit-fe`). (depends on 50)
52. **Update `.gitignore`** — add `docs/_reports/app-audit-*.md`. (depends on 48)
53. **`.github/workflows/app-audit.yml`** — `workflow_dispatch` (with `lighthouse: choice ["false","true"]` input, default `"false"`) + `pull_request` with `paths: ['app/routes/**', 'app/components/**', 'app/lib/**', 'app/db/schema.ts']`. Steps: checkout → setup-bun → `bun install --frozen-lockfile` → `bun run build` → start preview server in background → `bun run audit:fe --trigger=ci-pr-${PR_NUM:-manual} ${{ inputs.lighthouse == 'true' && '--lighthouse' || '--no-lighthouse' }}` → upload report + optional Lighthouse HTML as artifacts → post PR comment via `peter-evans/create-or-update-comment@v4` with `body-includes: ${FINGERPRINT_GREP_LITERAL}app:` (literal-string match). (depends on 50, 43)
54. **`.agents/skills/app-audit/SKILL.md` + symlink** — canonical SKILL.md describing scope (fuzzer pattern), 11+1 categories, severities, output paths, abort condition (3-run), Lighthouse default behavior. Symlink `.claude/skills/app-audit -> ../../.agents/skills/app-audit`. (depends on 50)
55. **Slash-command alias** `/app-audit` — thin wrapper at `.claude/commands/app-audit.md`. (depends on 54)
56. **`.agents/rules/fe-audit.md`** — output location, severity scheme, category definitions (incl. `sweep-error` per ADR-006), abort condition (3 consecutive zero-actionable runs), triage workflow (every blocker fixed within 7 days, escalated, or retire-or-suppress decision), Lighthouse variance management notes. (depends on 50)
57. **Update `.agents/rules/cicd.md`** — document app-audit workflow + `lighthouse` input + reuse of existing E2E secrets (no new secrets required). (depends on 53)
58. **Update `AGENTS.md`** — Skill Map adds `app-audit` row; Rules list adds `fe-audit` pointer; File Structure unchanged (`docs/_reports/` + `docs/audits/` already listed from Phase 3). (depends on 54, 56)
59. **End-Phase 4 checkpoint** — run `make audit` locally; verify (a) `audit-content` runs cleanly; (b) `audit-fe` produces valid `docs/_reports/app-audit-YYYY-MM-DD.md`; (c) `docs/audits/SUMMARY.md` has `Type` column with existing rows backfilled to `content` and new row appended with `app`; (d) all 11+1 categories represented in report shape (even if zero findings per category). Open final PR to main.

### Technical Dependencies

- **Bun 1.3.13+** (already pinned in CI).
- **GitHub Secrets** `E2E_ADMIN_EMAIL` + `E2E_ADMIN_PASSWORD` set in repo settings before Phase 1 PR can pass CI. No new secrets for Phase 4 (`app-audit` reuses the same admin credentials for admin-session route walks).
- **PGLite version compatibility** — confirm `@electric-sql/pglite` ≥ 0.2 supports `drizzle-orm/pglite` driver version pinned in package.json.
- **Chromium binary cache** — GHA caches `~/.cache/ms-playwright` keyed on lockfile hash to avoid re-downloading Chromium on every CI run. Reused by Phase 4 (`@lhci/cli` resolves the same binary via `chromium.executablePath()` per ADR-006).
- **`@axe-core/playwright`** (Phase 4) — direct dependency for app-audit's a11y category. Pinned in `package.json`. Compatible with the Playwright version pinned in Phase 1.
- **`@lhci/cli`** (Phase 4) — optional Lighthouse runner. Pinned in `package.json`. Compatibility check at runtime: `lighthouse.server.ts:runLighthouse()` verifies the Playwright Chromium version is within `@lhci/cli`'s supported range; falls back to lhci's bundled Chrome download if mismatch detected.
- **No upstream blockers**: Better Auth Drizzle adapter issue #4305 is the only known external risk; mitigation is the fallback `drizzle-kit push` against the static `app/db/auth-schema.ts` (which is the default path anyway).

## Monitoring and Observability

- **Playwright HTML report** uploaded as GHA artifact (`name: playwright-report`, retention: 30 days) on every e2e CI run, regardless of pass/fail.
- **Playwright JSON report** uploaded alongside HTML; consumed by future flake-rate scripts if needed.
- **`docs/audits/SUMMARY.md`** — committed paper trail; one row per audit run (per skill) with date + `Type` column (`content` / `app`) + trigger + severity counts + top finding.
- **Per-run content-audit report** at `docs/_reports/content-audit-YYYY-MM-DD.md` uploaded as GHA artifact when CI-triggered (`name: content-audit-report-${{ github.run_id }}`).
- **Per-run app-audit report** at `docs/_reports/app-audit-YYYY-MM-DD.md` uploaded as GHA artifact when CI-triggered (Phase 4; `name: app-audit-report-${{ github.run_id }}`).
- **Lighthouse HTML report** (Phase 4, optional) — when `workflow_dispatch.inputs.lighthouse == "true"`, uploaded as GHA artifact (`name: lighthouse-report-${{ github.run_id }}`, retention: 30 days).
- **PR comment per audit type** posted by `peter-evans/create-or-update-comment@v4` action with severity counts + top blockers + artifact link; delta-only suppression based on a hidden HTML comment fingerprint embedded in the comment body. Content-audit and app-audit comments coexist on the same PR with distinct fingerprints (`audit-fingerprint:content:...` vs `audit-fingerprint:app:...`).
- **Lint-test-annotations script output** — fails the build with a clear "annotation at <file:line> is <hours>h old, exceeds 48h SLA" message; emits one line per offense.
- **`[audit-counts]` machine-readable line** emitted by both `audit-content` and `audit-fe` CLI runs for workflow-level severity-count parsing (avoids brittle stdout regex of free-text summary lines).
- **No external telemetry** — no Datadog, Honeycomb, etc. Solo dev consumes GHA UI + committed SUMMARY.md directly.

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

- **Decision** (Phase 4): Lighthouse default ON locally, OFF in CI.
  - **Rationale**: signal at dev time (matches headline pre-publish audit user story), no variance noise on every PR. ADR-006 documents.
  - **Trade-offs**: `--lighthouse` / `--no-lighthouse` flags + `workflow_dispatch` `lighthouse` input add CLI/workflow surface complexity.
  - **Alternatives rejected**: default ON everywhere (CI variance fatigue), default OFF everywhere (loses headline value), inverted hybrid (signal in wrong direction).

- **Decision** (Phase 4): Lighthouse shares Playwright's bundled Chromium binary.
  - **Rationale**: single binary cache on CI; faster cold start; one dependency lifecycle.
  - **Trade-offs**: tight coupling between Playwright + Lighthouse Chromium version compatibility windows.
  - **Alternatives rejected**: lhci's default Chrome download (~300 MB CI cache; longer install), system Chrome (CI reproducibility risk).

- **Decision** (Phase 4): Per-route try/catch + `sweep-error` finding emission.
  - **Rationale**: V1's 28-inspection matrix must not abort on transient probe failure; partial failures stay observable as findings.
  - **Trade-offs**: adds a 12th category (`sweep-error`) beyond ADR-005's 11; excluded from abort-condition count (probe-infra, not site quality).
  - **Alternatives rejected**: fail-fast (too brittle), silent stderr log (hides failures), sliding-window threshold (premature optimization).

- **Decision** (Phase 4): Counts-only fingerprint for PR-comment delta suppression.
  - **Rationale**: matches content-audit's existing pattern exactly; simplest delta logic; round 2 + round 4 fixes apply unchanged.
  - **Trade-offs**: category-churn (same counts, different categories) doesn't trigger re-post.
  - **Alternatives rejected**: counts + category hash (complexity drift), counts + top-finding hash (single-finding fidelity loses lower-severity changes), counts + Lighthouse buckets (Lighthouse-specific complexity in shared helper).

### Known Risks

- **PGLite/Drizzle adapter version skew** — likelihood: medium. `@electric-sql/pglite` evolves quickly; a breaking change could surface mid-development. *Mitigation*: pin exact versions; upgrade through dedicated PR.
- **Vite stub plugin omission** — likelihood: medium. If `site-model.server.ts` isn't added to `serverOnlyStubPlugin` in `vite.config.ts`, the client bundle attempts to import filesystem APIs and SSR breaks. *Mitigation*: build step in step 3 of Phase 1 is explicit; covered by build CI matrix entry.
- **Lint script regex false positives** — likelihood: low-medium. The `@flaky` / `.skip` / `.todo` regex must distinguish real test annotations from string literals or comments referencing them. *Mitigation*: TypeScript AST-based scan via Bun's built-in parser instead of regex (Step 13); Vitest unit tests cover edge cases.
- **Better Auth CLI generator issue #4305** — likelihood: low. The existing `app/db/auth-schema.ts` is static and complete; we never invoke the CLI generator in our flow. *Mitigation*: no action needed unless we adopt CLI-based regeneration later.
- **PR-comment delta suppression edge cases** — likelihood: medium. Multiple pushes to same PR may double-post or miss updates. *Mitigation*: use `comment-id` from previous run (stored in workflow artifact or via `body-includes` fingerprint match); Phase 3 acceptance test must exercise the multi-push case.
- **Drift test false positive on deliberate exclusions** — likelihood: low. A dev-only diagnostic route would trigger drift. *Mitigation*: opt-out entry in the static map (`expectedStatus: null` semantics) documented in `testing.md`.
- **storageState leak** — likelihood: low but high-impact. Accidental commit of `.auth/admin.json` leaks the e2e session token. *Mitigation*: explicit `.gitignore` entry from Phase 1 step 15; Biome or pre-commit hook adds a glob rule to reject `**/.auth/**` files.
- **Lighthouse perf score variance on shared CI runners** (Phase 4) — likelihood: high (±10 perf-points documented baseline). *Mitigation*: ADR-006 defaults Lighthouse OFF in CI; counts-only fingerprint suppresses re-posts when blocker/major unchanged; `--no-lighthouse` opt-out flag preserves category-level kill switch without removing the skill; follow-up PRD will introduce variance-baseline gate before perf scores become hard signal.
- **Playwright + Lighthouse Chromium version drift** (Phase 4) — likelihood: medium. If Playwright's Chromium bumps past `@lhci/cli`'s supported range, Lighthouse fails to launch. *Mitigation*: ADR-006 documents fallback to lhci's bundled Chrome download; `lighthouse.server.ts:runLighthouse()` runtime version-compat check.
- **`sweep-error` masking root-cause findings** (Phase 4) — likelihood: low-medium. A probe that consistently times out emits `sweep-error` and hides the real underlying issue (e.g., hydration mismatch causing the timeout). *Mitigation*: `.agents/rules/fe-audit.md` triage workflow directs developer to investigate `sweep-error` findings locally with `bunx playwright test --headed --debug` before treating them as transient.
- **SUMMARY.md `Type` column migration failure** (Phase 4) — likelihood: low. The one-time migration on first Phase 4 run could corrupt the file if interrupted mid-write. *Mitigation*: `initSummary()` writes to a temp file and renames atomically; Vitest test covers fixture pre-Phase-4 SUMMARY + interrupt simulation.
- **Three audit-shaped skills atrophy together** (Phase 4 cross-cutting) — likelihood: medium per ADR-005 Devil's Advocate carry-over. *Mitigation*: composite `make audit` makes co-atrophy visible at the command level; abort conditions tracked per skill in respective rules files (`audit.md` for content-audit, `fe-audit.md` for app-audit); ADR-005 documents the reversibility safety net (each skill independently disable-able).

## Architecture Decision Records

- [ADR-001: V1 scope and architecture for e2e-coverage + app-audit skill pair](adrs/adr-001.md) — Council-validated decision establishing shared site-model + 2 renderers + 3 capability specs + owned auth fixture + PGLite + PR-blocking CI.
- [ADR-002: Pivot audit skill from browser-sweep to content-audit](adrs/adr-002.md) — Opportunity-scan supersession of ADR-001's app-audit scope; audit targets MDX/frontmatter/translation/link/alt/series instead of browser runtime.
- [ADR-003: PRD scope and phased delivery model](adrs/adr-003.md) — Single PRD covering 3 phases delivered as 3 PRs; CI failure handling combines strict-block + `@flaky` 48 h SLA + auto-retry-once.
- [ADR-004: TechSpec implementation primitives](adrs/adr-004.md) — TypeScript runtime walker for site-model, PGLite singleton + `workers: 1`, Playwright canonical auth setup + storageState, mdast (remark) full parse for MDX links.
- [ADR-005: Revive app-audit as Phase 4 — supersedes ADR-002 deferral](adrs/adr-005.md) — User-elected unconditional reversal of ADR-002 deferral; ships app-audit as fuzzer pattern in Phase 4 with all 11 categories including Lighthouse; council's hybrid recommendation considered and rejected.
- [ADR-006: TechSpec implementation primitives for Phase 4 (app-audit)](adrs/adr-006.md) — Lighthouse default ON locally / OFF in CI; Lighthouse shares Playwright's bundled Chromium; per-route try/catch + `sweep-error` finding emission; counts-only PR-comment fingerprint.
