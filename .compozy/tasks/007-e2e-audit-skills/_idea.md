# E2E + Content Audit + App Audit Skill Trio

## Overview

Three paired agent skills for the personal blog repo (TanStack Start + Better Auth + Drizzle PG + Bun) that establish the project's first browser end-to-end coverage, a content-quality sweep, and a general FE-runtime audit — all built on a shared site-model module so they share one producer of route/post knowledge.

- **Problem solved**: zero current e2e coverage means login, admin publish flow, and locale-prefixed public reads have no executable contract; content drift (missing translations, broken internal links, frontmatter typos) accumulates silently after the PRD-006 i18n restructure; FE runtime issues (console errors, hydration warnings, missing meta tags, perf score drops, a11y violations) escape every existing test surface.
- **Audience**: the sole developer of the blog (also the primary content author).
- **Value**: PR-blocking regression net for protected surface + change-triggered content audit + ad-hoc / paths-filtered FE runtime audit. Three non-overlapping skills covering distinct surfaces.
- **V1 ambition**: sequential delivery — `e2e-coverage` (Phases 1-2) → `content-audit` (Phase 3) → `app-audit` (Phase 4, original ADR-001 scope reactivated per ADR-005). All three ship in the same merge to `main`.

## Summary / Differentiator

Generic Playwright spec-generation and audit skills (e.g. `lackeyjb/playwright-skill`, Stagehand, off-the-shelf Pa11y/Lighthouse) are framework-agnostic and have to discover stack conventions each run. This skill trio is opinionated for this repo:

- Codifies TanStack Start's hydration convention (`useHydrated()` marker + console-error listener) into every generated spec.
- Ships a Better Auth login fixture that preserves the `reactStartCookies` plugin ordering.
- Orchestrates PGLite + `drizzle-kit push` + Better Auth seed as a one-liner.
- Single shared route/post inventory at `app/lib/site-model.server.ts` — all three skills are renderers/consumers of the same producer (executable specs + narrative content report + browser-runtime fuzzer). No duplicated route knowledge.
- Replaces generic Lighthouse/Pa11y reports with a composite markdown audit that combines console + network + meta + image + mixed-content + hydration + slow-response + a11y + perf/SEO/best-practices into one report file per run.
- Three audit categories ship together, sharing infrastructure (~40% line-counted reuse): PGLite proxy, auth fixture, reporter helpers (`escapeMarkdownCell`), PR-comment delta workflow.

## Problem

The blog ships ~15 routes across two locales (en, pt-br), an admin surface gated by Better Auth, an MDX-driven content pipeline indexed into Postgres, and zero browser end-to-end coverage. The Vitest suite (31 files under `app/tests/`) covers units and route handlers but not the live browser contract: hydration, session cookies under `reactStartCookies`, locale switcher behavior, admin publish toggle round-trip. Every PR is merged on the assumption that "if it builds and unit tests pass, it works in the browser" — that assumption is unverified.

After PRD-006 (site restructure i18n) landed, a second failure surface opened: content drift. A new English post can be merged with no Portuguese counterpart and silently exist in only one locale. Internal markdown links can reference slugs that no longer exist. Frontmatter typos slip past indexer warnings. Image alt text is unchecked. Series with missing parts publish anyway. None of these are code regressions — Vitest is the wrong substrate; e2e is the wrong substrate too. They need a content-shaped audit.

A third surface emerged during Phase 1-3 execution: **general FE runtime issues** that neither e2e specs nor content-audit catch. Console errors on a route not exercised by a spec, hydration warnings introduced by a TanStack Start version bump, missing OG meta tags on a new layout component, a11y violations from a UI refactor, perf score drops after adding a heavy component, broken images in MDX rendering paths, mixed-content warnings from an upgraded CDN. None of these need a Playwright spec written per concern — they need a sweep.

### Market Data

- **Solo-dev e2e ROI rule**: 3-5 specs maximum for personal projects; >5 and maintenance cost dominates. (Source: getautonoma.com, tryzerocheck.com guides 2025-2026.)
- **Playwright flake budget**: healthy suites target <2%; >5% causes developers to stop trusting results. Google reports ~16% industry-wide. (Source: testdino.com flaky-test benchmark.)
- **TanStack Start has a documented e2e doc gap**: official testing docs page is marked "temporarily unavailable"; GitHub discussion #5727 explicitly requests it. Community pattern (`useHydrated()` + `data-hydrated` marker) fills the void. (Sources: tanstack.com/router/latest/docs/how-to/setup-testing, github.com/TanStack/router/discussions/5727, alexop.dev/posts/catch-hydration-errors-playwright-tests/.)
- **PGLite vs testcontainers**: ~2.8s vs ~4.8s suite cold start; 19MB vs 150MB; no Docker; official Drizzle adapter (`@drizzle-adapter/pglite`) and Better Auth Drizzle adapter (`provider: "pg"`) work natively. (Sources: orm.drizzle.team/docs/connect-pglite, dennisokeeffe.com 2025-06-09.)
- **Lighthouse CI variance on shared GHA runners**: ±10 perf-points between identical runs is the documented norm; baseline averaging over 3+ runs recommended. (Source: GoogleChrome/lighthouse-ci issues + community reports.)
- **Skills 2.0 chaining is canonical**: SKILL.md to SKILL.md delegation is the documented pattern, not a workaround. (Source: mindstudio.ai Claude Code skill collaboration docs.)
- **Prior art for Claude-generated Playwright specs is shallow**: `lackeyjb/playwright-skill` is generic; no public skill targets TanStack Start + Better Auth + Drizzle specifically. No prior art for a 3-skill audit trio sharing a site-model producer.

## Core Features

| #   | Feature                                  | Priority   | Description                                                                                                                                            |
| --- | ---------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F1  | Shared site-model module                 | Critical   | `app/lib/site-model.server.ts` exports typed route inventory (path, locale, auth, expected status, intent) + posts inventory. Single producer for all 3 skills. |
| F2  | `e2e-coverage` SKILL.md                  | Critical   | Bootstraps Playwright (install + config + auth fixture), generates and runs 3 capability specs, gates PRs.                                             |
| F3  | 3 capability-targeted Playwright specs   | Critical   | `auth-flow.spec.ts` (login + session lifecycle), `admin-write.spec.ts` (publish toggle), `public-read.spec.ts` (post render + locale switch).         |
| F4  | Owned auth fixture contract              | Critical   | `tests/e2e/fixtures/auth.ts` exports typed `authenticatedPage()` with explicit cleanup. Consumed by all specs and app-audit walks.                     |
| F5  | PGLite ephemeral DB orchestration        | High       | `drizzle-kit push` against in-process PGLite + Better Auth seed. Per-run lifecycle; no Docker. Reused by all 3 skills.                                 |
| F6  | `content-audit` SKILL.md                 | High       | MDX walker validating frontmatter, en↔pt-br translation gaps, internal link integrity, image alt text, series consistency.                            |
| F7  | Committed audit summary                  | High       | `docs/audits/SUMMARY.md` append-only with `Type` column (`content` / `app`). Per-run reports stay gitignored under `docs/_reports/`.                  |
| F8  | Slash-command aliases                    | Medium     | `/e2e-coverage`, `/content-audit`, `/app-audit` as thin wrappers invoking the SKILL.md. Canonical surface stays SKILL.md.                              |
| F9  | New rule files + AGENTS.md updates       | Medium     | `.agents/rules/testing.md` + `audit.md` + `fe-audit.md`; AGENTS.md File Structure + Skill Map + Rules list updates; `.agents/rules/cicd.md` extensions.|
| F10 | `app-audit` SKILL.md                     | High       | Browser-sweep fuzzer walking `routes × locales × auth-state` (28 inspections at current scale). 11 finding categories incl. Lighthouse perf/SEO.       |
| F11 | App-audit browser sweep core             | High       | `app/lib/app-audit/browser-sweep.server.ts` with Playwright probes for console errors, network failures, missing meta, image health, mixed-content, hydration warnings, slow responses. |
| F12 | App-audit a11y + Lighthouse adapters     | High       | `a11y-adapter.server.ts` invoking `@axe-core/playwright` directly + `lighthouse.server.ts` running `@lhci/cli` for perf/SEO/best-practices scores.    |
| F13 | App-audit reporter + delta PR comment    | High       | `app/lib/app-audit/reporter.server.ts` reusing `escapeMarkdownCell` from content-audit; separate fingerprint marker (`audit-fingerprint:app:...`).    |
| F14 | App-audit CLI + workflow                 | Medium     | `scripts/audit-fe.ts` (CLI flags `--trigger`, `--routes`, `--lighthouse`) + `.github/workflows/app-audit.yml` (workflow_dispatch + paths-filtered PR). |

## KPIs

| KPI                                       | Target                          | How to Measure                                                                       |
| ----------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------ |
| Pre-merge bugs caught by e2e              | ≥3 in first 3 months post-ship  | Count PRs where e2e went red and a fix landed before merge.                          |
| PR cycle time with e2e gate               | <8 min total (e2e step ≤5 min)  | GitHub Actions duration on representative PRs (median over 30 days).                 |
| e2e flake rate                            | <2%                             | Failed reruns ÷ total runs from Playwright JSON report.                              |
| Content-audit findings actioned           | ≥80% within 7 days              | Manual tracking via `Status:` line in `docs/_reports/content-audit-*.md`.            |
| App-audit actionable-finding rate         | ≥1 actionable finding per 50% of runs over first 90 days | Count app-audit runs with ≥1 blocker/major finding that resulted in a code or content fix.       |
| Critical-path spec coverage               | 100% of 3 capability specs green | All three of auth-flow / admin-write / public-read passing on every main-branch CI.  |

## Feature Assessment

| Criteria            | Question                                            | Score    |
| ------------------- | --------------------------------------------------- | -------- |
| **Impact**          | How much more valuable does this make the product?  | Strong   |
| **Reach**           | What % of users would this affect?                  | Maybe    |
| **Frequency**       | How often would users encounter this value?         | Strong   |
| **Differentiation** | Does this set us apart or just match competitors?   | Strong   |
| **Defensibility**   | Is this easy to copy or does it compound over time? | Maybe    |
| **Feasibility**     | Can we actually build this?                         | Must do  |

Leverage type: **Strategic Bet (Compounding Feature)** — every new route added inherits all three skills' coverage automatically (via site-model entry → e2e spec template + content-audit walk + app-audit fuzzer pass).

## Council Insights

- **Recommended approach (Phases 1-3)**: One shared site-model module feeding two renderers (executable e2e + narrative content audit). Sequential delivery — e2e-coverage with 3 capability-targeted specs first; content-audit consumes the same inventory once e2e is green. PR-blocking CI from day one; no warm-up window. PGLite for ephemeral DB; nightly real-Postgres job deferred until first PG-only feature lands. Owned auth fixture as an exported typed contract.
- **Recommended approach (Phase 4 — ADR-005 reversal)**: Add `app-audit` as a third consumer of the shared site-model. The Thinker reframed app-audit as a **fuzzer** (uses site-model as classifier, not oracle), distinguishing it from the two renderers. Council's hybrid recommendation included probe-first sequence + Lighthouse deferral + shared-surface hardening. User overruled the hybrid and chose original scope (all 11 categories incl. Lighthouse, 5 tasks, no probe gate). Reversibility is the safety net — disabling the skill is one PR if Lighthouse variance proves intolerable.
- **Key trade-offs**:
  - Aggressive 4-spec V1 vs minimal 1-spec V1 — landed at 3 capability specs (Architect won naming; Pragmatic won cadence).
  - URL-cluster naming (`blog-locale.spec.ts`) vs capability naming (`public-read.spec.ts`) — capability won because PRD-006 just restructured the site.
  - Two skills vs one combined `site-quality` skill — two won; Skills 2.0 favors one-skill-one-thing.
  - PR-blocking vs non-blocking-for-2-weeks — PR-blocking won outright; non-blocking creates wrong selection pressure (flakes rationalized, gate never flips).
  - Browser-sweep audit vs content-audit — content-audit won at the opportunity-scan phase (ADR-002) because content drift is the dominant post-i18n failure mode.
  - Phase 4 unconditional reversal vs probe-gated hybrid — user chose unconditional (ADR-005); accepts Lighthouse variance + atrophy risk in exchange for shared-infra cost amortization and context-freshness.
- **Risks identified**:
  - PGLite drift from prod Postgres if a future migration uses pgvector / RLS / partial indexes (mitigation: documented nightly playbook; trigger = first PG-only feature).
  - Spec atrophy if `@flaky` SLA gets ignored (mitigation: CI rejects `.skip`/`.todo` older than 48 h).
  - Audit-as-theater if summary is never read (mitigation: change-triggered execution + abort condition — retire if 2 (content-audit) or 3 (app-audit) consecutive runs produce zero actionable findings).
  - Site-model module falling out of sync with `app/routes/` (mitigation: Vitest drift-detection test).
  - Fixture-contract creep over time (mitigation: narrow typed export surface; ADR required for changes).
  - **Lighthouse variance** on shared CI runners (±10 perf-points) may cause PR-comment fatigue. *Mitigation*: delta-only PR comment suppresses re-posting unless signal changes; `--lighthouse` flag allows disabling that category set without touching the rest of the skill if variance becomes intolerable.
  - **3-skill atrophy risk**: Devil's Advocate flagged "alert fatigue" specific to fuzzer-shaped skills. *Mitigation*: composite `make audit` runs all three sequentially so co-atrophy is visible at the command level; abort condition (3 zero-finding runs) is the formal retirement gate; reversibility is cheap.
- **Stretch goal (V2+)**:
  - **Lighthouse variance baseline**: if Lighthouse PR-comment noise exceeds tolerance, open a follow-up PRD with explicit entry criteria ("10-run baseline shows perf score standard deviation ≤3 points") before re-enabling perf assertions as gates.
  - **Open-source as `tanstack-start-e2e-kit`** if the route-inventory + skill pattern proves valuable internally and the TanStack Start community testing-doc gap remains open.

## Integration with Existing Features

| Integration Point                                 | How                                                                                                       |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `a11y-testing` skill (`.agents/skills/a11y-testing/`) | Remains independent and canonical for component-level a11y work. NOT invoked by content-audit (different surface). App-audit invokes `@axe-core/playwright` directly per route for in-suite checks; the skill remains available for ad-hoc deep-dive a11y audits. |
| Vitest suite (`app/tests/**`)                     | Stays as the unit/integration boundary. Playwright lives under `tests/e2e/` — separate substrate, separate runner, no cross-imports.                                          |
| Better Auth (`app/lib/auth.ts`, `app/lib/session.ts`) | Auth fixture wraps the same login form used in production (`/login` → `signInEmail`). `requireSession()` is exercised end-to-end by the admin-write spec; app-audit walks admin routes using the same fixture for auth state. |
| Drizzle indexer (`app/db/indexer.ts`)             | Content-audit reads the indexer's published-posts state to cross-check against the filesystem MDX walk.                                                                       |
| TanStack Router file-based routing (`app/routes/`) | Site-model mirrors the route structure; a drift-detection Vitest test asserts every route under `app/routes/**/*.tsx` has a matching inventory entry. App-audit walks all inventory routes per run. |
| Better Auth Drizzle adapter                       | PGLite uses the same `drizzleAdapter(db, { provider: "pg" })` shape; Better Auth tables (`user`, `session`, `account`, `verification`) seed cleanly for all 3 skills.         |
| CI/CD (`.github/workflows/ci.yml`)                | e2e job added to the existing quality matrix (PR-blocking). Content-audit + app-audit live as separate workflows on `workflow_dispatch` + paths-filtered change-trigger.      |
| Content-audit reporter (`reporter.server.ts`)     | `escapeMarkdownCell` helper exported and reused by app-audit's reporter. Single source of truth for markdown-cell escaping. |
| Composite `make audit` target                     | New Makefile target runs `audit-content` + `audit-fe` sequentially; co-atrophy of either skill becomes visible in the same command output. |

## Out of Scope (V1)

- **Nightly real-Postgres CI job** — PGLite is sufficient until a migration uses a Postgres-only feature (extensions, RLS, partial indexes, JSONB-specific operators). Trigger documented in `.agents/rules/testing.md`; build is a 5-line YAML when the trigger fires.
- **Open-source productization (`tanstack-start-e2e-kit`)** — 15-20 day expansion with maintenance commitment. Discussed in opportunity scan; held as V2+ stretch.
- **CDN / cache-layer regression detection** — explicit blind spot. Devil's Advocate flagged this as a real failure mode neither e2e nor content-audit catches. App-audit's `missing-meta` + `network-fail` categories partially address OG image regressions but not CDN cache invalidation issues.
- **Lighthouse variance management** — V1 accepts ±10 perf-point variance as a known risk. A future follow-up PRD will introduce a variance-baseline gate (10-run rolling stddev ≤3) before treating perf scores as hard signal.
- **Visual regression testing** — pixel diffs, snapshot suites. Out of scope; would explode flake budget for low marginal value on a content site.
- **Cross-browser coverage (Firefox, WebKit)** — Chromium only in V1. Cross-browser adds ~3x CI time for low-value coverage on a content site; revisit only if a user-reported regression is browser-specific.
- **Mobile viewport / device emulation** — desktop Chromium only. Mobile audit deferred to follow-up.
- **Skill auto-trigger on conversational hints** — all three SKILL.md files require explicit invocation (slash command or direct skill name in prompt). No "fires when user mentions test" trigger lexicon.
- **Test report dashboard / external integrations** — no Allure, no TestRail, no Currents. Playwright HTML report + GHA artifact upload only.
- **`app-audit` probe-first gate** — Council's hybrid recommendation included a probe step before renderer commitment. User overruled this; documented in ADR-005 Alternative 1.
- **`app-audit` sibling `expectations.ts` table** — Council's hybrid included a per-pattern expected-presence table. Out of V1 scope; `RouteEntry` boundary stays unchanged; any audit-specific metadata grows in a future ADR if needed.

## Architecture Decision Records

- [ADR-001: V1 scope and architecture for e2e-coverage + app-audit skill pair](adrs/adr-001.md) — Council-validated decision establishing the shared site-model pattern, 3 capability specs, owned auth fixture, PGLite, PR-blocking CI.
- [ADR-002: Pivot audit skill from browser-sweep to content-audit](adrs/adr-002.md) — Opportunity-scan supersession of ADR-001's `app-audit` scope. Replaces browser-sweep with MDX/frontmatter/translation/link audit aligned to the post-i18n failure mode. App-audit deferred to V2.
- [ADR-003: PRD scope and phased delivery model](adrs/adr-003.md) — Phased delivery framework; 3 phases originally, Phase 4 added per ADR-005.
- [ADR-004: TechSpec implementation primitives](adrs/adr-004.md) — TS runtime walker for site-model, PGLite singleton + `workers: 1`, Playwright canonical auth setup + storageState, mdast/remark MDX parsing.
- [ADR-005: Revive app-audit as Phase 4 — supersedes ADR-002 deferral](adrs/adr-005.md) — User-elected unconditional reversal of ADR-002's deferral. Adds 3rd skill `app-audit` as a fuzzer pattern (Thinker's reframe) using site-model as classifier. Original 11-category scope including Lighthouse CI; council's hybrid (probe gate + Lighthouse deferred + hardening first) considered and rejected. SUMMARY.md gains `Type` column; fingerprint markers separated by audit type.

## Open Questions

- **E2E seed-user provisioning**: via a `tests/e2e/setup.ts` global setup that creates the user once before the suite, or per-spec fixture that creates and tears down? Trade-off: global is faster but couples spec ordering; per-spec is isolated but slower.
- **Audit summary file schema**: `docs/audits/SUMMARY.md` Type-column refactor needs migration step for existing content-audit rows (backfill `Type: content`). TechSpec to lock the migration ordering.
- **Content-audit abort threshold**: ADR-002 inherits the "2 consecutive zero-finding runs ⇒ retire" rule from ADR-001's app-audit. Content-audit will likely surface translation-gap findings for months as the pt-br catalog ramps — is this the right threshold or should it count only `blocker`-severity findings?
- **App-audit abort threshold**: 3 consecutive zero-actionable runs per ADR-005. Lighthouse variance may push false-positive findings indefinitely; need an "actionable" definition that excludes variance-driven score drops.
- **Lighthouse perf score variance tolerance**: at what stddev do we add a baseline gate? V1 accepts ±10; threshold for follow-up PRD entry is TechSpec decision.
- **Build sequence (Phase 4)**: parallel-build `browser-sweep.server.ts` + `checks.server.ts`, or strictly serial (sweep → orchestrator → reporter → CLI → workflow → skill docs)?
- **Slash-command vs SKILL.md trigger lexicon**: `/app-audit` triggers should be narrow ("audit FE", "browser sweep", "find runtime bugs") to avoid mid-conversation noise. Anti-trigger phrases like "general review", "audit code", "audit security" must NOT activate.
- **Playwright project shape**: V1 stays single project (Chromium only). App-audit may want a separate "smoke" project for fastest critical-path subset; defer to TechSpec.
- **PGLite single-client serialization**: forces serial spec runs. Acceptable for 3 specs + 28 app-audit inspections sequentially; revisit if app-audit walls grow past 5 min.
- **Test seed data location**: SQL file, TypeScript helper, or Drizzle-seed plugin? Repo already has `app/db/seed` patterns referenced in `package.json` scripts; reuse those?
- **A11y delegation depth**: app-audit invokes `@axe-core/playwright` directly per route; `a11y-testing` skill remains canonical for component-level deep-dives. TechSpec decides if any cross-invocation is justified.
- **App-audit CI integration**: workflow trigger paths (`app/routes/**`, `app/components/**`, `app/lib/**`, `app/db/schema.ts`) may be too broad. TechSpec to tune for false-positive reduction.

## Cost Estimate

| Type                                        | Volume                                     | Estimated Cost                                       |
| ------------------------------------------- | ------------------------------------------ | ---------------------------------------------------- |
| GitHub Actions e2e job (PR-blocking)        | ~20-40 PRs / month × ~4 min                | ~80-160 min/mo (well within 2000-min free tier)      |
| GitHub Actions content-audit job (change-triggered) | ~5-10 runs / month × ~30 s         | ~3-5 min/mo                                          |
| GitHub Actions app-audit job (change-triggered) | ~10-20 runs / month × ~3-5 min (Lighthouse adds 1-2 min)         | ~50-100 min/mo                                       |
| Dev-time investment (V1 build, all phases)  | ~9-11 days end-to-end                      | One-time; Phase 1+2 (~5-7d) + Phase 3 (~2-3d) + Phase 4 (~3d) sequential                  |
| Maintenance burden                          | ~2-3 hr / month                            | Spec hot-swaps on route restructure; flake triage; audit finding triage |
| Runtime infrastructure (PGLite)             | In-process WASM                            | $0 (no Docker, no external DB)                       |
| Lighthouse CI infrastructure                | Chromium reused from Playwright; `@lhci/cli` devDep    | $0 (no hosted Lighthouse service; local-only)        |
