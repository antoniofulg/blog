# PRD-007: E2E Coverage + Content Audit + App Audit Skill Trio

## Overview

Three paired agent skills for the blog repo — `e2e-coverage`, `content-audit`, and `app-audit` — that together establish the project's first end-to-end browser regression net, its first automated content-quality sweep, and its first general FE-runtime audit. All three skills consume a single shared site-model module so that route and post knowledge has exactly one canonical source.

- **Problem solved**: the blog currently has zero browser end-to-end coverage (Vitest exercises units and route handlers but not real browser behavior — hydration, sessions, locale switching); after PRD-006's i18n restructure, content drift (missing translations, broken internal links, frontmatter typos) accumulates silently between manual reviews; FE runtime issues (console errors, hydration warnings, missing meta tags, perf score drops, a11y violations) escape every existing test surface.
- **Target user**: the sole developer of the blog, who is also the primary content author. There is no commercial user persona; readers benefit indirectly from higher quality merges.
- **Why valuable**: a regression net on the protected surface (login, admin publish, public locale-prefixed reads) + a content sweep aligned to the blog's actual failure mode after i18n + an ad-hoc / change-triggered FE runtime audit that the user explicitly identified as a recurring need ("find general FE bugs, SEO issues, a11y issues without writing a spec per concern"). Reduces "did I break something?" anxiety on every merge AND before every draft promotion.

## Goals

- Establish a working PR-blocking browser e2e gate for three critical capability paths (auth, admin write, public read) within Phase 1's first merge.
- Catch ≥3 pre-merge regressions in the first three months post-ship.
- Surface ≥80 % of content-audit `blocker`-severity findings within 7 days of the run that produced them.
- Produce ≥1 actionable app-audit finding in 50 % of runs over the first 90 days post-ship (Phase 4 KPI).
- Maintain e2e flake rate below 2 % measured over rolling 30-day windows.
- Keep total PR cycle time under 8 minutes including the e2e gate.
- Ship Phase 1 within 2-3 working days of branch creation; Phase 2 within 2 more; Phase 3 within 2-3 more; Phase 4 within 3 more — full V1 in ≤11 working days.

## User Stories

### Primary persona: Solo developer (also content author)

- **As the developer**, I want to invoke `/e2e-coverage` to bootstrap Playwright in this repo from scratch, so that I don't have to remember the install command, the recommended browser, or the auth fixture wiring.
- **As the developer**, I want the e2e skill to generate specs for the routes I haven't covered yet, so that I add coverage as I add features without writing boilerplate by hand.
- **As the developer**, I want every PR to run e2e on Chromium and block merge on red, so that I cannot accidentally ship a broken login or publish flow.
- **As the developer**, I want a `@flaky` annotation to mark a spec I'm tracking, so that a transient flake doesn't block urgent merges, but the annotation expires after 48 hours so it can't become permanent quarantine.
- **As the developer**, I want auto-retry once on CI failures, so that single-run transients (cold-start contention, network blips) don't manifest as merge-blockers.
- **As the developer**, I want to invoke `/content-audit` ad-hoc before promoting a draft post, so that I catch missing translations, broken internal links, and frontmatter typos before they ship.
- **As the developer**, I want content-audit to run automatically when I touch `app/content/posts/**` or `app/db/schema.ts`, so that drift gets surfaced without me remembering to run it.
- **As the developer**, I want audit findings posted as a PR comment with severity counts and a link to the full report artifact, so that I see them at review time without opening another tab.
- **As the developer**, I want `docs/audits/SUMMARY.md` to grow one row per audit run with a `Type` column distinguishing `content` and `app`, so that I have a committed paper trail of both audit histories in one file without per-run diff noise.
- **As the developer**, I want the e2e auth fixture exported as a typed helper that the content-audit skill (and future browser-using skills, including app-audit) can import, so that admin-session boilerplate lives in exactly one place.
- **As the developer**, I want a single shared route/post inventory module that all three skills read, so that I update route knowledge in one file when I add a route, not in three skill prompts.
- **As the developer**, before promoting any draft post or merging a UI change, I want to invoke `/app-audit` and see all routes' runtime health (console errors, network failures, meta tags, image health, mixed-content warnings, hydration mismatches, slow responses) + a11y + perf/SEO/best-practices in one composite markdown report, so that I catch FE bugs no spec or content check would surface (Phase 4 headline story).
- **As the developer**, I want app-audit to run automatically on PRs touching `app/routes/**`, `app/components/**`, `app/lib/**`, or `app/db/schema.ts`, posting a delta-only PR comment with severity counts and a link to the artifact, so that runtime drift is caught at review time without my having to remember to run it locally.
- **As the developer**, I want `make audit` to compose both `audit-content` and `audit-fe` into one command, so that I can verify the full content + runtime quality picture before pushing.
- **As the developer**, when an app-audit category produces sustained false-positive noise (e.g., Lighthouse perf variance), I want a `--lighthouse` opt-out flag in the CLI, so that I can disable the noisy category without ripping out the whole skill.

### Indirect beneficiary: Blog readers

- **As a reader (en or pt-br)**, I land on a post that has the expected title, description, and content rendered without console errors or hydration mismatches, because the e2e gate caught the regression that would have broken my page.
- **As a reader**, I follow an internal link in a post and reach the target instead of a 404, because content-audit caught the broken reference before merge.
- **As a reader who prefers pt-br**, I find every English post translated (or explicitly marked as not-translated), because content-audit flags translation gaps.
- **As a reader**, I land on a post whose OG image renders correctly in social previews, because app-audit's `missing-meta` check verified the og:image tag is present and the asset is reachable.
- **As a reader using assistive tech**, I encounter fewer a11y violations on shipped pages, because app-audit runs axe-core on every route in every locale and surfaces violations before merge.

## Core Features

### F1 — Shared site-model module (Phase 1)

The single producer of route and post knowledge in the repo. Exports a typed inventory consumed by all three skills.

- Routes inventory: every route under `app/routes/**/*.tsx` mapped to `{ path, locale, auth: 'public' | 'admin', expectedStatus, intent }`.
- Posts inventory: every MDX file under `app/content/posts/**/*.mdx` mapped to `{ slug, lang, title, hasPublishedTwin, frontmatter }` (built from filesystem + indexer DB cross-reference).
- Drift-detection test (Vitest): asserts every route file has a matching inventory entry; fails CI on mismatch.

### F2 — `e2e-coverage` SKILL.md (Phase 1)

Agent skill that bootstraps Playwright and generates/runs specs. Invoked via the `/e2e-coverage` slash-command alias or by name in conversation.

- Detects missing `@playwright/test`, missing `playwright.config.ts`, missing `tests/e2e/` and offers to scaffold them with the developer's confirmation.
- Reads the shared site-model to know which routes exist, then reads `tests/e2e/**/*.spec.ts` to know which are covered, and surfaces the gap.
- Generates specs that encode the TanStack Start hydration convention (wait for `data-hydrated` marker; listen for "hydration failed" console errors).
- Runs `bunx playwright test` with optional filtering by tag (`@smoke`, `@admin`, `@auth`).

### F3 — Owned auth fixture (Phase 1)

A typed exported helper in `tests/e2e/fixtures/auth.ts` that provides an authenticated Playwright `page` for admin-session specs.

- Single contract: `type AuthedFixture = { page: Page; userId: string; cleanup: () => Promise<void> }`.
- Internally handles login round-trip against the seeded e2e test user, storageState caching, and Better Auth's `reactStartCookies` plugin ordering.
- Consumed by `admin-write.spec.ts` and any future admin specs; also imported by `content-audit` if a browser session is ever needed (currently no) and by `app-audit` for admin-session walks (Phase 4).

### F4 — `auth-flow.spec.ts` (Phase 1)

Capability spec for the auth surface. Covers login round-trip, session presence in protected routes, logout. PR-blocking from Phase 1's first merge.

### F5 — PGLite ephemeral DB orchestration (Phase 1)

Per-run in-process Postgres-compatible DB for the e2e suite. `drizzle-kit push` brings the schema up; Better Auth tables seed via the existing schema definitions. No Docker, no external DB. Reused by app-audit in Phase 4 for admin-session walks.

### F6 — CI gate with auto-retry + `@flaky` SLA (Phase 1)

e2e job added to `.github/workflows/ci.yml` as a 5th matrix entry (or sibling job). Playwright config sets `retries: 1` on CI. A lint script scans for `@flaky`, `.skip`, and `.todo` annotations and fails the build if any annotation's recorded ISO date is older than 48 hours.

### F7 — `admin-write.spec.ts` (Phase 2)

Capability spec for the editorial surface. Covers the admin dashboard guard (unauthed → redirect to `/login`), the publish/unpublish toggle round-trip, and the preview route for an unpublished post.

### F8 — `public-read.spec.ts` (Phase 2)

Capability spec for the public surface. Covers a published post rendering in both locales (`/<slug>` and `/pt-br/<slug>`), the locale switcher behavior, and the 404 path for a non-existent slug.

### F9 — `content-audit` SKILL.md (Phase 3)

Agent skill that walks MDX content and the indexed posts table to surface content drift. Invoked via `/content-audit` slash-command alias or by name.

- Validates every post's frontmatter against the schema in `app/db/schema.ts` ($inferInsert) and `app/lib/mdx/parser.server.ts` parsing rules.
- Detects translation gaps (en post without pt-br twin or vice versa); honors an opt-out frontmatter field (`noTranslation: true`).
- Verifies internal markdown links resolve against the inventoried slug set (`blocker` if link is in published post, `minor` if in draft).
- Checks every `![alt](src)` has non-empty `alt` (severity `major`, accessibility impact).
- Validates series consistency: `seriesPart` values must be contiguous starting at 1 within published posts; drafts excluded.
- Outputs per-run report at `docs/_reports/content-audit-YYYY-MM-DD.md` (gitignored, uploaded as GHA artifact when CI-triggered).
- Appends one row per run to `docs/audits/SUMMARY.md` (committed) with `Type: content`, date, severity counts, top finding.

### F10 — Content-audit GH Action workflow with PR comment (Phase 3)

New workflow file `.github/workflows/content-audit.yml`:

- Trigger: `workflow_dispatch` (manual) + `pull_request` with `paths` filter on `app/content/posts/**` and `app/db/schema.ts`.
- Runs `content-audit`, uploads per-run report as artifact, appends to `docs/audits/SUMMARY.md`, and posts a PR comment with severity counts + top blockers + artifact link.
- Comment suppression rule: if `blocker` count is 0 and `major` count is unchanged from the previous run on the same PR, no new comment is posted (delta-only).

### F11 — `app-audit` SKILL.md (Phase 4)

Agent skill that walks every `routes × locales × auth-state` combination from the shared site-model and reports findings in 11 categories. Invoked via `/app-audit` slash-command alias, by name in conversation, or via `make audit-fe`. Headline story: pre-publish content sanity check across the entire site.

- Coverage matrix: ~7 routes × 2 locales × 2 auth-states = ~28 inspections per run at current scale.
- Categories (11 total): `console-error` (blocker), `hydration-mismatch` (blocker), `network-fail` (blocker 5xx / major 4xx), `broken-image` (major), `missing-meta` (major), `mixed-content` (major), `slow-response` (minor; first-paint > 1.5s heuristic), `a11y-violation` (major; via `@axe-core/playwright` direct call with WCAG 2/2.2 AA tags), `seo-score-drop` (minor; Lighthouse `categories.seo.score < 0.9`), `perf-budget-breach` (minor; Lighthouse perf < 0.8), `best-practices-fail` (minor; Lighthouse best-practices < 0.9).
- Per-run report at `docs/_reports/app-audit-YYYY-MM-DD.md` (gitignored, uploaded as GHA artifact).
- Appends one row per run to `docs/audits/SUMMARY.md` with `Type: app`.
- Reuses `escapeMarkdownCell` helper from content-audit's reporter to prevent markdown injection from trigger labels.

### F12 — App-audit browser sweep core (Phase 4)

`app/lib/app-audit/browser-sweep.server.ts` — Playwright probe driving the coverage matrix.

- Per-route inspection: opens the page in Chromium with the seeded session (admin or anonymous), waits for hydration marker, attaches `page.on("console")` + `page.on("requestfailed")` listeners, asserts meta tags via `page.locator("meta")`, evaluates `<img>` elements for `naturalWidth === 0` to detect broken images, captures `performance.timing` for slow-response heuristic.
- Reuses PGLite ephemeral DB (`tests/e2e/db.ts`) and auth fixture (`tests/e2e/fixtures/auth.ts`) from Phase 1.
- Outputs raw `BrowserSweepResult[]` to the checks orchestrator.

### F13 — App-audit a11y + Lighthouse adapters (Phase 4)

- `app/lib/app-audit/a11y-adapter.server.ts` — wraps `new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze()` for each route in the matrix. Direct integration (not delegated to the `a11y-testing` skill) keeps the audit deterministic per route.
- `app/lib/app-audit/lighthouse.server.ts` — wraps `@lhci/cli` invocation against the same Playwright-bundled Chromium binary; emits `LighthouseScores = { perf, seo, bestPractices, accessibility }` per route. The `--lighthouse` CLI flag opt-out is honored here.

### F14 — App-audit CLI + workflow (Phase 4)

- `scripts/audit-fe.ts` — Bun CLI entry; flags `--trigger=<label>`, `--routes=<csv>`, `--lighthouse` (off-by-default-toggle or on-by-default depending on user preference; TechSpec to decide). Emits a machine-readable `[audit-counts]` line (`blockers=N majors=N minors=N`) for the workflow to parse (mirrors round 2 issue 003 fix). Exit code 1 if any blocker finding; 0 otherwise.
- `.github/workflows/app-audit.yml` — `workflow_dispatch` (manual with `routes` + `lighthouse` inputs) + `pull_request` with `paths` filter on `app/routes/**`, `app/components/**`, `app/lib/**`, `app/db/schema.ts`. Uploads per-run report + Lighthouse HTML as artifacts; posts delta-only PR comment via `peter-evans/create-or-update-comment@v4` with fingerprint marker `<!-- audit-fingerprint:app:blocker=X major=Y -->`.
- Makefile targets: `make audit-fe` (alias `make app-audit`) + composite `make audit` running `audit-content` + `audit-fe` sequentially.

### F15 — App-audit skill docs + rules (Phase 4)

- `.agents/skills/app-audit/SKILL.md` (canonical) + `.claude/skills/app-audit` symlink + `.claude/commands/app-audit.md` slash alias.
- `.agents/rules/fe-audit.md` — severity scheme, category definitions, abort condition (3 consecutive zero-actionable runs), finding row format, triage workflow.
- `AGENTS.md` updates: Skill Map adds `app-audit` row; Rules list adds fe-audit pointer.

## User Experience

### Onboarding (fresh clone)

1. Developer clones the repo.
2. Runs `bun install` (Lefthook hooks install automatically).
3. Invokes `/e2e-coverage` in Claude Code; the skill detects no Playwright present and offers to install dependencies + scaffold config + create the auth fixture.
4. Developer confirms; skill runs `bun add -D @playwright/test`, `bunx playwright install chromium`, writes `playwright.config.ts` and `tests/e2e/fixtures/auth.ts`, generates `auth-flow.spec.ts`.
5. Developer runs `bun test:e2e` and sees green within 3 minutes of first invocation.

### Daily merge flow (after Phase 1)

1. Developer opens a PR with a code change.
2. CI runs the existing quality matrix + e2e job in parallel; e2e takes ~3-5 minutes.
3. If green, PR merges as normal.
4. If red, developer reads the Playwright report in the GHA artifact, fixes the code or adds a `@flaky` annotation with an ISO-date comment, pushes the fix.
5. Auto-retry catches transient flakes; persistent failures keep the PR blocked.

### Content-author flow (after Phase 3)

1. Developer drafts a new post in `app/content/posts/<lang>/<slug>.mdx`.
2. Optionally invokes `/content-audit` locally before pushing; the skill walks the content, emits the report, prints findings inline.
3. Developer fixes findings; pushes branch with the post commit.
4. Content-audit GH Action fires on the PR (paths filter matched); PR comment appears with severity counts and a link to the artifact.
5. If `blocker` findings exist, the developer addresses them; if not, the PR proceeds through normal review.

### Pre-publish audit flow (after Phase 4)

1. Developer prepares to promote a draft post or finishes a UI change.
2. Locally runs `make audit` (composite) — `audit-content` validates MDX state, then `audit-fe` walks every route × locale × auth-state in the live preview server.
3. Reads two per-run reports: `docs/_reports/content-audit-YYYY-MM-DD.md` and `docs/_reports/app-audit-YYYY-MM-DD.md`. Both follow the same severity scheme (blocker / major / minor).
4. Optionally invokes `/app-audit` interactively for a targeted route subset via the `--routes` flag (e.g. `make audit-fe ROUTES=/login,/admin`).
5. Pushes branch. If the PR touches `app/routes/**` / `app/components/**` / `app/lib/**` / `app/db/schema.ts`, the app-audit GH Action fires automatically and posts a delta-only PR comment.
6. If Lighthouse-driven false positives accumulate, the developer disables the `--lighthouse` flag (workflow input or local CLI) without removing the rest of the skill.

### Accessibility considerations

- e2e specs that test a11y-relevant flows (focus management, keyboard navigation, ARIA roles) compose with the existing `a11y-testing` skill (`@axe-core/playwright`); this PRD does not duplicate accessibility logic — it inherits it for component-level checks.
- Content-audit explicitly checks image alt text presence as an accessibility floor for MDX content.
- App-audit runs `AxeBuilder` against every route in every locale + auth-state combination (~28 inspections per run), surfacing runtime a11y violations that neither specs nor content-audit catch.

## High-Level Technical Constraints

- **Bun runtime only** — every script must work with Bun 1.3.13+. No Node-specific dependencies.
- **TanStack Start hydration** — every e2e spec and app-audit probe MUST wait for the hydration marker before assertion; constructs that rely on `waitForTimeout` are rejected at review.
- **Better Auth `reactStartCookies` plugin order** — the auth fixture must preserve the plugin ordering invariant (last in the array); test seed must use a dedicated test user, never a real admin credential.
- **Locale prefix invariant** — `en` is the default with no prefix (`/`, `/post`); `pt-br` is prefixed (`/pt-br/`, `/pt-br/post`). Specs, content-audit, and app-audit must respect both shapes.
- **Free-tier GitHub Actions** — total CI minutes for e2e + content-audit + app-audit must stay well within the 2000-minute monthly free tier. Budget: ~330-410 min/month combined (Phase 4 adds ~50-100 min/mo with Lighthouse enabled).
- **No secret leakage** — e2e test user credentials live in GitHub Secrets (`E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`). The `tests/e2e/.auth/` directory and `storageState.json` are gitignored.
- **CI ordering** — e2e runs in parallel with existing quality checks; content-audit and app-audit run in their own workflows on path-filtered triggers.
- **Site-model boundary stability** — `RouteEntry` shape must NOT widen with audit-specific fields. Per-route audit metadata, if needed, grows as a sibling module in a future ADR.
- **Reporter helper reuse** — `escapeMarkdownCell` from content-audit's reporter is the single source of truth for markdown-cell escaping; app-audit's reporter imports and reuses it (no duplication).
- **Fingerprint marker uniqueness** — content-audit uses `<!-- audit-fingerprint:content:... -->`; app-audit uses `<!-- audit-fingerprint:app:... -->`. Workflow grep MUST use literal-string matching (`grep -F`) not regex with backreferences to prevent collision.

## Non-Goals (Out of Scope)

- **Lighthouse variance management with hard gates** — V1 accepts Lighthouse score variance (±10 perf-points on shared CI runners) as a known risk. A future follow-up PRD will introduce a variance-baseline gate (10-run rolling stddev ≤3) before treating perf/SEO/best-practices scores as hard merge signals. App-audit's V1 surfaces these as `minor` findings only.
- **Cross-browser coverage** — Chromium only. Firefox and WebKit specs add ~3x CI time for low marginal value on a content site.
- **Visual regression testing** — pixel diffs and snapshot suites would explode flake budget without proportional value.
- **CDN / cache-layer regression detection** — explicit blind spot; no current candidate.
- **Open-source productization** — `tanstack-start-e2e-kit` was discussed in the opportunity scan and explicitly deferred to V2+.
- **Skill auto-trigger on conversational hints** — all three skills require explicit invocation (slash command or direct skill name). No "fires when user mentions test" lexicon.
- **Test report dashboards or external integrations** — no Allure, no TestRail, no Currents. Playwright HTML report + GHA artifact upload only.
- **Nightly real-Postgres CI job** — PGLite sufficient until a migration uses a Postgres-only feature (extensions, RLS, partial indexes). Trigger documented; build is ~5 lines of YAML when needed.
- **Mobile / responsive testing** — viewport tests deferred until reader-base growth justifies. App-audit walks desktop Chromium only.
- **`bypass-e2e` manual override label** — strict block + retry + SLA provides the right escape valve; manual bypass is rejected.
- **App-audit probe-first gate** — Council's hybrid recommendation (run a manual probe to validate site-model coverage before committing renderer code) considered and rejected by user judgment in ADR-005 Alternative 1. Documented for the record.
- **App-audit sibling `expectations.ts` table** — Council's hybrid included a per-pattern expected-presence table to grow the site-model without widening RouteEntry. Out of V1 scope; any per-route audit metadata grows in a future ADR if needed.
- **App-audit synthetic user journeys** — covered by e2e-coverage specs; app-audit walks routes only, not multi-step user flows.
- **App-audit cross-browser parallel runs** — Chromium only V1; cross-browser audit deferred.

## Phased Rollout Plan

### Phase 1 (MVP) — Foundation + smoke gate

**Branch**: `TASK-0007/e2e-foundation`. **Estimated effort**: 2-3 working days.

**Included**:
- F1 — Shared site-model module + drift-detection test.
- F2 — `e2e-coverage` SKILL.md (canonical at `.agents/skills/e2e-coverage/`, symlinked at `.claude/skills/e2e-coverage`).
- F3 — Owned auth fixture (`tests/e2e/fixtures/auth.ts`).
- F4 — `auth-flow.spec.ts` (login + session lifecycle + logout).
- F5 — PGLite + `drizzle-kit push` + Better Auth seed orchestration.
- F6 — CI gate (e2e job in `.github/workflows/ci.yml`) + lint script enforcing `@flaky`/`.skip`/`.todo` 48 h SLA + `playwright.config.ts` with `retries: 1` on CI.
- New rule files: `.agents/rules/testing.md`.
- `AGENTS.md` updates: File Structure (add `tests/e2e/`), Skill Map (add e2e row), Rules list (add testing pointer).
- `.gitignore` updates: `tests/e2e/.auth/`, `tests/e2e/storageState.json`, `test-results/`, `playwright-report/`.
- `package.json` scripts: `test:e2e`, `test:e2e:ui`, `test:e2e:debug`.
- GitHub Secrets: `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD` (one-time setup, documented in cicd.md updates).
- Slash-command alias: `/e2e-coverage`.

**Success criteria to proceed to Phase 2**:
- `auth-flow.spec.ts` green on three consecutive PRs in real use.
- e2e CI step completes in <5 min wall-clock on the GHA runner.
- Zero flake reports against `auth-flow.spec.ts` in Phase 1's first week.
- Drift-detection test catches a deliberately introduced route-without-inventory case (verified in PR-internal sanity check).

### Phase 2 — Cluster specs

**Branch**: `TASK-0007/e2e-specs`. **Estimated effort**: 2 working days.

**Included**:
- F7 — `admin-write.spec.ts`.
- F8 — `public-read.spec.ts`.
- Site-model and auth fixture extended only if Phase 1 surfaced gaps; otherwise no foundation changes.

**Success criteria to proceed to Phase 3**:
- All 3 specs green on three consecutive PRs.
- Rolling 30-day flake rate <2 % across the full suite.
- PR cycle time (median over 10 PRs) <8 min including e2e.

### Phase 3 — Content-audit

**Branch**: `TASK-0007/content-audit`. **Estimated effort**: 2-3 working days.

**Included**:
- F9 — `content-audit` SKILL.md (canonical + symlink).
- F10 — `.github/workflows/content-audit.yml` (manual + path-filtered triggers, PR comment, artifact upload).
- New rule file: `.agents/rules/audit.md`.
- `AGENTS.md` updates: File Structure (add `docs/_reports/`, `docs/audits/`), Skill Map (add content-audit row), Rules list (add audit pointer).
- `.gitignore` update: `docs/_reports/content-audit-*.md`.
- `package.json` script: `audit:content`.
- Slash-command alias: `/content-audit`.

**Long-term success criteria**:
- Content-audit produces ≥1 actionable finding in 60 % of runs over the first 3 months.
- ≥80 % of `blocker`-severity findings resolved within 7 days of the run.
- If two consecutive runs produce zero actionable findings, evaluate retirement of the skill per the abort condition in ADR-002.

### Phase 4 — App-audit (browser sweep, ADR-005 reactivation)

**Branch**: `TASK-0007/e2e-audit-skills` (same branch as Phases 1-3 per user choice; single PR delivers all four phases). **Estimated effort**: 3 working days.

**Included**:
- F11 — `app-audit` SKILL.md (canonical at `.agents/skills/app-audit/`, symlinked at `.claude/skills/app-audit`).
- F12 — Browser sweep core (`app/lib/app-audit/browser-sweep.server.ts`, `checks.server.ts`).
- F13 — A11y adapter + Lighthouse adapter (`a11y-adapter.server.ts`, `lighthouse.server.ts`); devDeps `@axe-core/playwright`, `@lhci/cli`.
- F14 — CLI (`scripts/audit-fe.ts`) + workflow (`.github/workflows/app-audit.yml`) + Makefile targets (`audit-fe`, `app-audit` alias, composite `audit`).
- F15 — Slash-command alias `/app-audit` + new rule file `.agents/rules/fe-audit.md` + AGENTS.md updates (Skill Map add app-audit row, Rules list add fe-audit pointer).
- `docs/audits/SUMMARY.md` refactored to add `Type` column; existing content-audit rows backfilled with `Type: content`.
- New reporter at `app/lib/app-audit/reporter.server.ts` importing `escapeMarkdownCell` from content-audit's reporter (no duplication).
- `vite.config.ts:serverOnlyStubPlugin` extended with 5 new server-only module paths.
- `.gitignore` update: `docs/_reports/app-audit-*.md`.
- `package.json` scripts: `audit:fe` and `audit` (composite).

**Acceptance criteria for Phase 4 done**:
- `make audit-fe` runs locally on current `main` against the preview server, produces a valid `docs/_reports/app-audit-YYYY-MM-DD.md` with all 11 categories represented in the report shape.
- `make audit` composite runs both `audit-content` + `audit-fe` cleanly in a single invocation.
- One row appended to `docs/audits/SUMMARY.md` with `Type: app` reflecting the baseline run.
- Existing content-audit rows backfilled with `Type: content` (migration verified via Vitest test).
- App-audit GH Action workflow file present and triggers on `workflow_dispatch`; PR-trigger paths filter documented and tested on a fixture branch.
- Findings on the baseline run are expected but NOT required to be zero (real findings reveal real issues; baseline is a successful surface emission, not a clean bill of health).

**Long-term success criteria**:
- App-audit produces ≥1 actionable finding in 50 % of runs over the first 90 days.
- ≥70 % of `blocker`-severity app-audit findings resolved within 7 days of the run.
- Rolling 90-day Lighthouse perf stddev tracked but not gated; serves as the entry criterion for a follow-up PRD that promotes Lighthouse to hard signal.
- If three consecutive runs produce zero actionable findings, evaluate retirement of the skill per the abort condition in ADR-005.

## Success Metrics

### Quality

- **Pre-merge regressions caught by e2e**: ≥3 in first 3 months. Tracked by counting PRs where e2e turned red and a fix landed before merge.
- **e2e flake rate**: <2 % over rolling 30-day windows. Measured from Playwright JSON reports (failed-then-passed-on-retry counts).
- **Content-audit blocker resolution**: ≥80 % within 7 days. Tracked via the `Status:` line in `docs/_reports/content-audit-*.md` (manual annotation).
- **App-audit blocker resolution**: ≥70 % within 7 days. Tracked via the `Status:` line in `docs/_reports/app-audit-*.md` (manual annotation).
- **Composite audit (`make audit`) hit rate**: developer runs `make audit` before ≥50 % of PRs touching `app/routes/**` or `app/content/posts/**` (self-reported; tracked qualitatively).

### Performance

- **PR cycle time (median, 30-day rolling)**: <8 minutes total, with the e2e step ≤5 minutes.
- **Bootstrap time (fresh clone)**: <3 minutes from `bun install` to first `bun test:e2e` green.
- **Content-audit run time**: <30 seconds for a content commit; <90 seconds for a full-site audit.
- **App-audit run time**: <5 minutes wall-clock at current scale (~7 routes × 2 locales × 2 auth-states with Lighthouse enabled); <2 minutes with `--lighthouse` opt-out.

### Coverage

- **Critical-path spec coverage**: 100 % of the 3 capability specs (`auth-flow`, `admin-write`, `public-read`) green on every main-branch CI run.
- **Site-model drift**: 0 instances of an `app/routes/**/*.tsx` route missing a site-model entry (enforced by drift-detection test).
- **App-audit route coverage**: 100 % of inventoried routes walked per run (all 28 inspections execute; partial runs flagged).

### Engagement (developer)

- **Skill invocations per month**: ≥5 invocations of `/e2e-coverage` (generation or run), ≥3 invocations of `/content-audit`, ≥3 invocations of `/app-audit`. Below these floors signals the skills aren't earning their keep.

## Risks and Mitigations

### Adoption risks

- **Risk**: developer (sole user) bypasses the gate during pressure (urgent hotfix, unrelated PR with stale `@flaky` annotation). *Mitigation*: 48 h SLA enforced by CI lint script; no manual bypass label; hotfix branches go through the same gate.
- **Risk**: content-audit findings become noise after 1-2 months and get glanced past. *Mitigation*: delta-only PR comments (no new comment if blocker count is 0 and major count unchanged); abort condition (two consecutive zero-finding runs ⇒ evaluate retirement).
- **Risk**: app-audit's 11 categories produce noise that overwhelms signal, especially Lighthouse score-drop false positives. *Mitigation*: delta-only PR comment uses fingerprint marker (`<!-- audit-fingerprint:app:blocker=X major=Y -->`) to suppress re-posting unless signal changes; `--lighthouse` opt-out flag lets the developer disable that category set without removing the skill; abort condition (3 consecutive zero-actionable runs) triggers retirement evaluation.
- **Risk**: three audit-shaped skills (e2e + content + app) collectively atrophy because the developer ignores PR comments. *Mitigation*: composite `make audit` runs all three sequentially in one local command, making co-atrophy visible at the command level; ADR-005 inherits Devil's Advocate's atrophy warning explicitly and documents the abort thresholds (2-run for content, 3-run for app).

### Competitive risks

- **Risk**: Anthropic or third party ships a generic Claude Code skill that subsumes these. *Mitigation*: the repo-opinionated parts (TanStack Start hydration markers, Better Auth fixture ordering, PGLite + Drizzle seed, shared site-model producer) are differentiators that generic tools cannot match; if a generic tool ships, this PRD's skills compose alongside.

### Timeline risks

- **Risk**: Phase 1 takes >3 days due to PGLite + Better Auth integration friction. *Mitigation*: PGLite has an official Drizzle adapter and Better Auth uses standard `pgTable` definitions; if friction is severe, fall back to `drizzle-kit push` against a local docker-compose Postgres (existing in `docker-compose.yml`) until PGLite cooperates — documented as a Phase 1 contingency.
- **Risk**: Phase 3 (content-audit) reveals so many existing translation gaps that the report is unactionable. *Mitigation*: first run is treated as a baseline; only NEW findings (delta against `docs/audits/SUMMARY.md` prior row) count toward the 80 %-resolution metric.
- **Risk**: Phase 4 (app-audit) takes >3 days because Lighthouse integration introduces unexpected variance or `@lhci/cli` setup conflicts. *Mitigation*: `--lighthouse` flag is opt-out from day one; if Lighthouse blocks Phase 4 progress, ship Phase 4 with that flag default-off and treat Lighthouse as a Phase 4.5 follow-up within the same branch.

### Dependency risks

- **Risk**: TanStack Router's testing docs gap means there is no canonical guidance to defer to. *Mitigation*: the skill codifies the community-pattern hydration marker; ADR-001 documents the convention.
- **Risk**: Playwright API breaks between minor versions, invalidating generated specs. *Mitigation*: Playwright is pinned in `package.json`; skill updates require `bun update` + a re-generation pass.
- **Risk**: GHA free-tier quota exceeded if PRs accelerate. *Mitigation*: e2e runs only on PRs targeting `main` (already enforced by the matrix) and on direct pushes to `main`; not on every push to feature branches. Current PR cadence (~20-40/month) leaves substantial headroom even with Phase 4 added (~50-100 min/mo).
- **Risk**: `@lhci/cli` or `@axe-core/playwright` introduces a breaking change. *Mitigation*: both pinned in `package.json`; Phase 4 verification step checks compatibility with the pinned Chromium build before merge.

### Variance risks (Phase 4 specific)

- **Risk**: Lighthouse perf scores swing ±10 points between identical runs on shared CI runners, producing PR-comment fatigue. *Mitigation*: delta-only PR comment suppresses re-posting when blocker count is 0 and major count unchanged; `--lighthouse` CLI flag allows disabling without removing skill; follow-up PRD will introduce baseline-variance gate before perf scores become hard signal.
- **Risk**: A11y violations on third-party rendered widgets (e.g. social embeds) produce non-actionable findings. *Mitigation*: `@axe-core/playwright` invocation can scope to selectors via `AxeBuilder.include(...)`; per-route configuration documented in `.agents/rules/fe-audit.md` as escape hatch.

## Architecture Decision Records

- [ADR-001: V1 scope and architecture for e2e-coverage + app-audit skill pair](adrs/adr-001.md) — Council-validated decision establishing shared site-model + 2 renderers + 3 capability specs + owned auth fixture + PGLite + PR-blocking CI.
- [ADR-002: Pivot audit skill from browser-sweep to content-audit](adrs/adr-002.md) — Opportunity-scan supersession of ADR-001's app-audit scope; audit becomes MDX/frontmatter/translation/link/alt/series check aligned to post-i18n failure mode.
- [ADR-003: PRD scope and phased delivery model](adrs/adr-003.md) — Single PRD covering 3 phases delivered as 3 PRs; CI failure handling combines strict-block + `@flaky` SLA + auto-retry-once.
- [ADR-004: TechSpec implementation primitives](adrs/adr-004.md) — TS runtime walker for site-model, PGLite singleton + `workers: 1`, Playwright canonical auth setup + storageState, mdast/remark MDX parsing.
- [ADR-005: Revive app-audit as Phase 4 — supersedes ADR-002 deferral](adrs/adr-005.md) — User-elected unconditional reversal of ADR-002's deferral. Adds 3rd skill `app-audit` as a fuzzer pattern (Thinker's reframe) using site-model as classifier. Original 11-category scope including Lighthouse CI; council's hybrid recommendation (probe gate + Lighthouse deferred + hardening first) considered and rejected. SUMMARY.md gains `Type` column; fingerprint markers separated by audit type.

## Open Questions

- **Seed-user provisioning location**: the e2e test user (whose credentials live in `E2E_ADMIN_EMAIL`/`E2E_ADMIN_PASSWORD`) needs to be created when PGLite spins up. Resolved by TechSpec — likely via a `tests/e2e/setup.ts` global setup that uses Better Auth's signUpEmail API against the ephemeral DB.
- **Audit summary file schema**: `Type` column added in Phase 4. TechSpec to lock the migration ordering for existing content-audit rows (backfill `Type: content` before app-audit's first append).
- **Content-audit abort threshold counting**: ADR-002 inherits "2 consecutive zero-finding runs ⇒ retire" from ADR-001. Open: should the count include only `blocker` severity, or any severity? Defer to first 60 days of operation; revisit in a follow-up if signal is noisy.
- **App-audit abort threshold counting**: ADR-005 sets 3-run threshold. Same open question — count only blockers, or any severity? Defer to first 90 days.
- **PR comment delta logic edge cases**: how does the suppression rule behave when a PR has multiple audit runs (push → re-push)? Defer to TechSpec.
- **Playwright project shape**: single project (Chromium only) vs separate projects for `smoke` (auth-flow only) and `full` (all 3 specs). Currently leaning single project; TechSpec to decide.
- **PGLite single-client serialization**: forces serial spec execution. Acceptable for 3 specs + 28 app-audit inspections sequentially. Open: when app-audit grows past 5 min wall-clock, switch to parallel PGLite instances? Defer until evidence accumulates.
- **Test seed data location**: SQL file vs TypeScript helper vs Drizzle-seed plugin. Repo already has `scripts/seed.ts`; TechSpec to decide on reuse vs e2e-specific seed.
- **Better Auth Drizzle CLI quirk**: tracked upstream issue (better-auth/better-auth#4305) about schema generation. Mitigation if hit: fall back to manual `drizzle-kit push` of the static `app/db/auth-schema.ts`.
- **Lighthouse default in CI**: should `app-audit.yml` enable Lighthouse by default or require explicit `lighthouse: true` workflow input? Trade-off: default-on catches more signal but increases noise from variance; default-off requires explicit opt-in per PR. TechSpec to decide based on expected CI cadence.
- **App-audit fingerprint scope**: should the fingerprint encode only counts (`blocker=X major=Y`) or also include a category-hash so suppression respects category-level changes? V1 leans count-only; TechSpec evaluates whether category-hash is worth the complexity.
- **App-audit Lighthouse runner**: Playwright-bundled Chromium vs `@lhci/cli`'s default Chrome download. TechSpec to confirm whether `@lhci/cli` can be pointed at the existing Playwright Chromium binary to avoid double-download.
