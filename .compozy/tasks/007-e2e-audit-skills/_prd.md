# PRD-007: E2E Coverage + Content Audit Skill Pair

## Overview

Two paired agent skills for the blog repo — `e2e-coverage` and `content-audit` — that together establish the project's first end-to-end browser regression net and its first automated content-quality sweep. Both skills consume a single shared site-model module so that route and post knowledge has exactly one canonical source.

- **Problem solved**: the blog currently has zero browser end-to-end coverage (Vitest exercises units and route handlers but not real browser behavior — hydration, sessions, locale switching), and after PRD-006's i18n restructure, content drift (missing translations, broken internal links, frontmatter typos) accumulates silently between manual reviews.
- **Target user**: the sole developer of the blog, who is also the primary content author. There is no commercial user persona; readers benefit indirectly from higher quality merges.
- **Why valuable**: a regression net on the protected surface (login, admin publish, public locale-prefixed reads) plus a content sweep aligned to the blog's actual failure mode after i18n. Reduces "did I break something?" anxiety on every merge.

## Goals

- Establish a working PR-blocking browser e2e gate for three critical capability paths (auth, admin write, public read) within Phase 1's first merge.
- Catch ≥3 pre-merge regressions in the first three months post-ship.
- Surface ≥80 % of content-audit `blocker`-severity findings within 7 days of the run that produced them.
- Maintain e2e flake rate below 2 % measured over rolling 30-day windows.
- Keep total PR cycle time under 8 minutes including the e2e gate.
- Ship Phase 1 within 2-3 working days of branch creation; Phase 2 within 2 more; Phase 3 within 2-3 more — full V1 in ≤8 working days.

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
- **As the developer**, I want `docs/audits/SUMMARY.md` to grow one row per audit run, so that I have a committed paper trail of the audit's history without per-run diff noise.
- **As the developer**, I want the e2e auth fixture exported as a typed helper that the content-audit skill (and future browser-using skills) can import, so that admin-session boilerplate lives in exactly one place.
- **As the developer**, I want a single shared route/post inventory module that both skills read, so that I update route knowledge in one file when I add a route, not in two skill prompts.

### Indirect beneficiary: Blog readers

- **As a reader (en or pt-br)**, I land on a post that has the expected title, description, and content rendered without console errors or hydration mismatches, because the e2e gate caught the regression that would have broken my page.
- **As a reader**, I follow an internal link in a post and reach the target instead of a 404, because content-audit caught the broken reference before merge.
- **As a reader who prefers pt-br**, I find every English post translated (or explicitly marked as not-translated), because content-audit flags translation gaps.

## Core Features

### F1 — Shared site-model module (Phase 1)

The single producer of route and post knowledge in the repo. Exports a typed inventory consumed by both skills.

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
- Consumed by `admin-write.spec.ts` and any future admin specs; also imported by `content-audit` if a browser session is ever needed (currently no).

### F4 — `auth-flow.spec.ts` (Phase 1)

Capability spec for the auth surface. Covers login round-trip, session presence in protected routes, logout. PR-blocking from Phase 1's first merge.

### F5 — PGLite ephemeral DB orchestration (Phase 1)

Per-run in-process Postgres-compatible DB for the e2e suite. `drizzle-kit push` brings the schema up; Better Auth tables seed via the existing schema definitions. No Docker, no external DB.

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
- Appends one row per run to `docs/audits/SUMMARY.md` (committed) with date, severity counts, top finding.

### F10 — Content-audit GH Action workflow with PR comment (Phase 3)

New workflow file `.github/workflows/content-audit.yml`:

- Trigger: `workflow_dispatch` (manual) + `pull_request` with `paths` filter on `app/content/posts/**` and `app/db/schema.ts`.
- Runs `content-audit`, uploads per-run report as artifact, appends to `docs/audits/SUMMARY.md`, and posts a PR comment with severity counts + top blockers + artifact link.
- Comment suppression rule: if `blocker` count is 0 and `major` count is unchanged from the previous run on the same PR, no new comment is posted (delta-only).

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

### Accessibility considerations

- e2e specs that test a11y-relevant flows (focus management, keyboard navigation, ARIA roles) compose with the existing `a11y-testing` skill (`@axe-core/playwright`); this PRD does not duplicate accessibility logic — it inherits it.
- Content-audit explicitly checks image alt text presence as an accessibility floor.

## High-Level Technical Constraints

- **Bun runtime only** — every script must work with Bun 1.3.13+. No Node-specific dependencies.
- **TanStack Start hydration** — every e2e spec MUST wait for the hydration marker before assertion; specs that rely on `waitForTimeout` are rejected at review.
- **Better Auth `reactStartCookies` plugin order** — the auth fixture must preserve the plugin ordering invariant (last in the array); test seed must use a dedicated test user, never a real admin credential.
- **Locale prefix invariant** — `en` is the default with no prefix (`/`, `/post`); `pt-br` is prefixed (`/pt-br/`, `/pt-br/post`). Specs and content-audit must respect both shapes.
- **Free-tier GitHub Actions** — total CI minutes for e2e + content-audit must stay well within the 2000-minute monthly free tier. Budget: ~250-300 min/month combined.
- **No secret leakage** — e2e test user credentials live in GitHub Secrets (`E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`). The `tests/e2e/.auth/` directory and `storageState.json` are gitignored.
- **CI ordering** — e2e runs in parallel with existing quality checks; content-audit runs in its own workflow on path-filtered triggers.

## Non-Goals (Out of Scope)

- **Browser-sweep app-audit** — pivoted to content-audit per ADR-002. Console errors, hydration mismatches, network failures, slow responses, missing OG meta tags remain uncovered by automated tooling in V1.
- **Cross-browser coverage** — Chromium only. Firefox and WebKit specs add ~3x CI time for low marginal value on a content site.
- **Visual regression testing** — pixel diffs and snapshot suites would explode flake budget without proportional value.
- **Performance budgets (Lighthouse CI)** — separate concern; tracked outside this PRD.
- **CDN / cache-layer regression detection** — explicit blind spot; no current candidate.
- **Open-source productization** — `tanstack-start-e2e-kit` was discussed in the opportunity scan and explicitly deferred to V2+.
- **Skill auto-trigger on conversational hints** — both skills require explicit invocation (slash command or direct skill name). No "fires when user mentions test" lexicon.
- **Test report dashboards or external integrations** — no Allure, no TestRail, no Currents. Playwright HTML report + GHA artifact upload only.
- **Nightly real-Postgres CI job** — PGLite sufficient until a migration uses a Postgres-only feature (extensions, RLS, partial indexes). Trigger documented; build is ~5 lines of YAML when needed.
- **Mobile / responsive testing** — viewport tests deferred until reader-base growth justifies.
- **`bypass-e2e` manual override label** — strict block + retry + SLA provides the right escape valve; manual bypass is rejected.

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

## Success Metrics

### Quality

- **Pre-merge regressions caught by e2e**: ≥3 in first 3 months. Tracked by counting PRs where e2e turned red and a fix landed before merge.
- **e2e flake rate**: <2 % over rolling 30-day windows. Measured from Playwright JSON reports (failed-then-passed-on-retry counts).
- **Content-audit blocker resolution**: ≥80 % within 7 days. Tracked via the `Status:` line in `docs/_reports/content-audit-*.md` (manual annotation).

### Performance

- **PR cycle time (median, 30-day rolling)**: <8 minutes total, with the e2e step ≤5 minutes.
- **Bootstrap time (fresh clone)**: <3 minutes from `bun install` to first `bun test:e2e` green.
- **Content-audit run time**: <30 seconds for a content commit; <90 seconds for a full-site audit.

### Coverage

- **Critical-path spec coverage**: 100 % of the 3 capability specs (`auth-flow`, `admin-write`, `public-read`) green on every main-branch CI run.
- **Site-model drift**: 0 instances of an `app/routes/**/*.tsx` route missing a site-model entry (enforced by drift-detection test).

### Engagement (developer)

- **Skill invocations per month**: ≥5 invocations of `/e2e-coverage` (generation or run), ≥3 invocations of `/content-audit`. Below these floors signals the skills aren't earning their keep.

## Risks and Mitigations

### Adoption risks

- **Risk**: developer (sole user) bypasses the gate during pressure (urgent hotfix, unrelated PR with stale `@flaky` annotation). *Mitigation*: 48 h SLA enforced by CI lint script; no manual bypass label; hotfix branches go through the same gate.
- **Risk**: content-audit findings become noise after 1-2 months and get glanced past. *Mitigation*: delta-only PR comments (no new comment if blocker count is 0 and major count unchanged); abort condition (two consecutive zero-finding runs ⇒ evaluate retirement).

### Competitive risks

- **Risk**: Anthropic or third party ships a generic Claude Code skill that subsumes these. *Mitigation*: the repo-opinionated parts (TanStack Start hydration markers, Better Auth fixture ordering, PGLite + Drizzle seed) are differentiators that generic tools cannot match; if a generic tool ships, this PRD's skills compose alongside.

### Timeline risks

- **Risk**: Phase 1 takes >3 days due to PGLite + Better Auth integration friction. *Mitigation*: PGLite has an official Drizzle adapter and Better Auth uses standard `pgTable` definitions; if friction is severe, fall back to `drizzle-kit push` against a local docker-compose Postgres (existing in `docker-compose.yml`) until PGLite cooperates — documented as a Phase 1 contingency.
- **Risk**: Phase 3 (content-audit) reveals so many existing translation gaps that the report is unactionable. *Mitigation*: first run is treated as a baseline; only NEW findings (delta against `docs/audits/SUMMARY.md` prior row) count toward the 80 %-resolution metric.

### Dependency risks

- **Risk**: TanStack Router's testing docs gap means there is no canonical guidance to defer to. *Mitigation*: the skill codifies the community-pattern hydration marker; ADR-001 documents the convention.
- **Risk**: Playwright API breaks between minor versions, invalidating generated specs. *Mitigation*: Playwright is pinned in `package.json`; skill updates require `bun update` + a re-generation pass.
- **Risk**: GHA free-tier quota exceeded if PRs accelerate. *Mitigation*: e2e runs only on PRs targeting `main` (already enforced by the matrix) and on direct pushes to `main`; not on every push to feature branches. Current PR cadence (~20-40/month) leaves substantial headroom.

## Architecture Decision Records

- [ADR-001: V1 scope and architecture for e2e-coverage + app-audit skill pair](adrs/adr-001.md) — Council-validated decision establishing shared site-model + 2 renderers + 3 capability specs + owned auth fixture + PGLite + PR-blocking CI.
- [ADR-002: Pivot audit skill from browser-sweep to content-audit](adrs/adr-002.md) — Opportunity-scan supersession of ADR-001's app-audit scope; audit becomes MDX/frontmatter/translation/link/alt/series check aligned to post-i18n failure mode.
- [ADR-003: PRD scope and phased delivery model](adrs/adr-003.md) — Single PRD covering 3 phases delivered as 3 PRs; CI failure handling combines strict-block + `@flaky` SLA + auto-retry-once.

## Open Questions

- **Seed-user provisioning location**: the e2e test user (whose credentials live in `E2E_ADMIN_EMAIL`/`E2E_ADMIN_PASSWORD`) needs to be created when PGLite spins up. Resolved by TechSpec — likely via a `tests/e2e/setup.ts` global setup that uses Better Auth's signUpEmail API against the ephemeral DB.
- **Audit summary file schema**: pure markdown table in `docs/audits/SUMMARY.md` vs markdown with embedded JSON code-blocks per row. Currently planned as pure markdown for human readability; TechSpec will lock the schema.
- **Content-audit abort threshold counting**: ADR-002 inherits "2 consecutive zero-finding runs ⇒ retire" from ADR-001. Open: should the count include only `blocker` severity, or any severity? Defer to first 60 days of operation; revisit in a follow-up if signal is noisy.
- **PR comment delta logic edge cases**: how does the suppression rule behave when a PR has multiple content-audit runs (push → re-push)? Defer to TechSpec.
- **Playwright project shape**: single project (Chromium only) vs separate projects for `smoke` (auth-flow only) and `full` (all 3 specs). Currently leaning single project; TechSpec to decide.
- **PGLite single-client serialization**: forces serial spec execution. Acceptable for 3 specs. Open: when V1.5 grows to 5+ specs, switch to parallel projects with separate PGLite instances? Defer until evidence accumulates.
- **Test seed data location**: SQL file vs TypeScript helper vs Drizzle-seed plugin. Repo already has `scripts/seed.ts`; TechSpec to decide on reuse vs e2e-specific seed.
- **Better Auth Drizzle CLI quirk**: tracked upstream issue (better-auth/better-auth#4305) about schema generation. Mitigation if hit: fall back to manual `drizzle-kit push` of the static `app/db/auth-schema.ts`.
