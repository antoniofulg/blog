# E2E + Content Audit Skill Pair

## Overview

Two paired agent skills for the personal blog repo (TanStack Start + Better Auth + Drizzle PG + Bun) that establish the project's first browser end-to-end coverage and a content-quality sweep — both built on a shared site-model module so they share one producer of route/post knowledge.

- **Problem solved**: zero current e2e coverage means login, admin publish flow, and locale-prefixed public reads have no executable contract; meanwhile content drift (missing translations, broken internal links, frontmatter typos) accumulates silently after the PRD-006 i18n restructure.
- **Audience**: the sole developer of the blog (also the primary content author).
- **Value**: PR-blocking regression net for protected surface plus change-triggered audit that catches the failure modes a content-driven solo blog actually hits.
- **V1 ambition**: sequential delivery — `e2e-coverage` with 3 capability specs first, then `content-audit` consuming the same shared inventory. No browser-sweep audit in V1; no open-source productization.

## Summary / Differentiator

Generic Playwright spec-generation skills (e.g. `lackeyjb/playwright-skill`, Stagehand) are framework-agnostic and have to discover stack conventions each run. This skill pair is opinionated for this repo:

- Codifies TanStack Start's hydration convention (`useHydrated()` marker + console-error listener) into every generated spec.
- Ships a Better Auth login fixture that preserves the `reactStartCookies` plugin ordering.
- Orchestrates PGLite + `drizzle-kit push` + Better Auth seed as a one-liner.
- Single shared route/post inventory at `app/lib/site-model.server.ts` — both skills are renderers of the same producer (executable specs + narrative report). No duplicated route knowledge.
- Replaces a generic browser-sweep audit with a content-audit aligned to the blog's actual failure mode after PRD-006.

## Problem

The blog ships ~15 routes across two locales (en, pt-br), an admin surface gated by Better Auth, an MDX-driven content pipeline indexed into Postgres, and zero browser end-to-end coverage. The Vitest suite (31 files under `app/tests/`) covers units and route handlers but not the live browser contract: hydration, session cookies under `reactStartCookies`, locale switcher behavior, admin publish toggle round-trip. Every PR is merged on the assumption that "if it builds and unit tests pass, it works in the browser" — that assumption is unverified.

After PRD-006 (site restructure i18n) landed, a second failure surface opened: content drift. A new English post can be merged with no Portuguese counterpart and silently exist in only one locale. Internal markdown links can reference slugs that no longer exist. Frontmatter typos slip past indexer warnings. Image alt text is unchecked. Series with missing parts publish anyway. None of these are code regressions — Vitest is the wrong substrate; e2e is the wrong substrate too. They need a content-shaped audit.

Existing browser audit tools (Lighthouse CI, Pa11y, generic Playwright sweeps) target browser-runtime issues — console errors, hydration mismatches, slow responses — which are real but lower-frequency on this stack. Devil's Advocate noted in the council session: "the last 4 prod issues were CDN cache + OG image regressions that neither tool would've caught." Content drift dominates the actual failure surface for a content site; app-audit was misaligned.

### Market Data

- **Solo-dev e2e ROI rule**: 3-5 specs maximum for personal projects; >5 and maintenance cost dominates. (Source: getautonoma.com, tryzerocheck.com guides 2025-2026.)
- **Playwright flake budget**: healthy suites target <2%; >5% causes developers to stop trusting results. Google reports ~16% industry-wide. (Source: testdino.com flaky-test benchmark.)
- **TanStack Start has a documented e2e doc gap**: official testing docs page is marked "temporarily unavailable"; GitHub discussion #5727 explicitly requests it. Community pattern (`useHydrated()` + `data-hydrated` marker) fills the void. (Sources: tanstack.com/router/latest/docs/how-to/setup-testing, github.com/TanStack/router/discussions/5727, alexop.dev/posts/catch-hydration-errors-playwright-tests/.)
- **PGLite vs testcontainers**: ~2.8s vs ~4.8s suite cold start; 19MB vs 150MB; no Docker; official Drizzle adapter (`@drizzle-adapter/pglite`) and Better Auth Drizzle adapter (`provider: "pg"`) work natively. (Sources: orm.drizzle.team/docs/connect-pglite, dennisokeeffe.com 2025-06-09.)
- **Skills 2.0 chaining is canonical**: SKILL.md to SKILL.md delegation is the documented pattern, not a workaround. (Source: mindstudio.ai Claude Code skill collaboration docs.)
- **Prior art for Claude-generated Playwright specs is shallow**: `lackeyjb/playwright-skill` is generic; no public skill targets TanStack Start + Better Auth + Drizzle specifically.

## Core Features

| #   | Feature                            | Priority   | Description                                                                                                                                          |
| --- | ---------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | Shared site-model module           | Critical   | `app/lib/site-model.server.ts` exports typed route inventory (path, locale, auth, expected status, intent) + posts inventory. Single producer.       |
| F2  | `e2e-coverage` SKILL.md            | Critical   | Bootstraps Playwright (install + config + auth fixture), generates and runs 3 capability specs, gates PRs.                                           |
| F3  | 3 capability-targeted Playwright specs | Critical | `auth-flow.spec.ts` (login + session lifecycle), `admin-write.spec.ts` (publish toggle), `public-read.spec.ts` (post render + locale switch). |
| F4  | Owned auth fixture contract        | Critical   | `tests/e2e/fixtures/auth.ts` exports typed `authenticatedPage()` with explicit cleanup. Consumed by all specs.                                       |
| F5  | PGLite ephemeral DB orchestration  | High       | `drizzle-kit push` against in-process PGLite + Better Auth seed. Per-run lifecycle; no Docker.                                                       |
| F6  | `content-audit` SKILL.md           | High       | MDX walker validating frontmatter, en↔pt-br translation gaps, internal link integrity, image alt text, series consistency.                          |
| F7  | Committed audit summary            | High       | `docs/audits/SUMMARY.md` append-only row per audit run. Per-run reports stay gitignored under `docs/_reports/`.                                      |
| F8  | Slash-command aliases              | Medium     | `/e2e-coverage` and `/content-audit` as thin wrappers invoking the SKILL.md. Canonical surface stays SKILL.md.                                       |
| F9  | New rule files + AGENTS.md updates | Medium     | `.agents/rules/testing.md` + `.agents/rules/audit.md`; AGENTS.md File Structure + Skill Map + Rules list updates; `.agents/rules/cicd.md` extensions. |

## KPIs

| KPI                                       | Target                          | How to Measure                                                                       |
| ----------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------ |
| Pre-merge bugs caught by e2e              | ≥3 in first 3 months post-ship  | Count PRs where e2e went red and a fix landed before merge.                          |
| PR cycle time with e2e gate               | <8 min total (e2e step ≤5 min)  | GitHub Actions duration on representative PRs (median over 30 days).                 |
| e2e flake rate                            | <2%                             | Failed reruns ÷ total runs from Playwright JSON report.                              |
| Content-audit findings actioned           | ≥80% within 7 days              | Manual tracking via `Status:` line in `docs/_reports/content-audit-*.md`.            |
| Critical-path spec coverage               | 100% of 3 capability specs green | All three of auth-flow / admin-write / public-read passing on every main-branch CI.  |
| Bootstrap time on fresh clone             | <3 min                          | `time` from `bun install` to first `bunx playwright test` green.                     |

## Feature Assessment

| Criteria            | Question                                            | Score    |
| ------------------- | --------------------------------------------------- | -------- |
| **Impact**          | How much more valuable does this make the product?  | Strong   |
| **Reach**           | What % of users would this affect?                  | Maybe    |
| **Frequency**       | How often would users encounter this value?         | Strong   |
| **Differentiation** | Does this set us apart or just match competitors?   | Strong   |
| **Defensibility**   | Is this easy to copy or does it compound over time? | Maybe    |
| **Feasibility**     | Can we actually build this?                         | Must do  |

Leverage type: **Strategic Bet (Compounding Feature)** — every new route added inherits both the e2e harness (via inventory entry → spec template) and the content-audit checks (if it serves MDX content).

## Council Insights

- **Recommended approach**: One shared site-model module feeding two renderers (executable e2e + narrative audit). Sequential delivery — e2e-coverage with 3 capability-targeted specs first; content-audit consumes the same inventory once e2e is green. PR-blocking CI from day one; no warm-up window. PGLite for ephemeral DB; nightly real-Postgres job deferred until first PG-only feature lands. Owned auth fixture as an exported typed contract.
- **Key trade-offs**:
  - Aggressive 4-spec V1 vs minimal 1-spec V1 — landed at 3 capability specs (Architect won naming; Pragmatic won cadence).
  - URL-cluster naming (`blog-locale.spec.ts`) vs capability naming (`public-read.spec.ts`) — capability won because PRD-006 just restructured the site.
  - Two skills vs one combined `site-quality` skill — two won; Skills 2.0 favors one-skill-one-thing.
  - PR-blocking vs non-blocking-for-2-weeks — PR-blocking won outright; non-blocking creates wrong selection pressure (flakes rationalized, gate never flips).
  - Browser-sweep audit vs content-audit — content-audit won at the opportunity-scan phase (ADR-002) because content drift is the dominant post-i18n failure mode.
- **Risks identified**:
  - PGLite drift from prod Postgres if a future migration uses pgvector / RLS / partial indexes (mitigation: documented nightly playbook; trigger = first PG-only feature).
  - Spec atrophy if `@flaky` SLA gets ignored (mitigation: CI rejects `.skip`/`.todo` older than 48 h).
  - Audit-as-theater if summary is never read (mitigation: change-triggered execution + abort condition — retire if two consecutive runs produce zero actionable findings).
  - Site-model module falling out of sync with `app/routes/` (mitigation: Vitest drift-detection test).
  - Fixture-contract creep over time (mitigation: narrow typed export surface; ADR required for changes).
- **Stretch goal (V2+)**:
  - **Pivot or expand audit**: if content-audit hits abort condition (two zero-finding runs), pivot to browser-sweep app-audit (the original ADR-001 scope). If content-audit produces sustained signal AND a browser-class regression escapes prod, ship app-audit as a sibling skill.
  - **Open-source as `tanstack-start-e2e-kit`** if the route-inventory + skill pattern proves valuable internally and the TanStack Start community testing-doc gap remains open.

## Integration with Existing Features

| Integration Point                                 | How                                                                                                       |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `a11y-testing` skill (`.agents/skills/a11y-testing/`) | Remains independent and canonical for accessibility. Not invoked by content-audit (different surface). e2e specs may invoke it for page-level axe checks on critical routes. |
| Vitest suite (`app/tests/**`)                     | Stays as the unit/integration boundary. Playwright lives under `tests/e2e/` — separate substrate, separate runner, no cross-imports.                                          |
| Better Auth (`app/lib/auth.ts`, `app/lib/session.ts`) | Auth fixture wraps the same login form used in production (`/login` → `signInEmail`). `requireSession()` is exercised end-to-end by the admin-write spec.                |
| Drizzle indexer (`app/db/indexer.ts`)             | Content-audit reads the indexer's published-posts state to cross-check against the filesystem MDX walk.                                                                       |
| TanStack Router file-based routing (`app/routes/`) | Site-model mirrors the route structure; a drift-detection Vitest test asserts every route under `app/routes/**/*.tsx` has a matching inventory entry.                        |
| Better Auth Drizzle adapter                       | PGLite uses the same `drizzleAdapter(db, { provider: "pg" })` shape; Better Auth tables (`user`, `session`, `account`, `verification`) seed cleanly.                          |
| CI/CD (`.github/workflows/ci.yml`)                | e2e job added as a fourth quality gate (parallel with test/lint/check). Audit lives as a separate workflow on `workflow_dispatch` + paths-filtered change-trigger.            |

## Out of Scope (V1)

- **Browser-sweep `app-audit`** — pivoted to `content-audit` per ADR-002. Browser-runtime audit (console errors, hydration mismatches, network failures, slow responses, missing meta) remains uncovered; tracked as V2 abort-condition pivot.
- **Nightly real-Postgres CI job** — PGLite is sufficient until a migration uses a Postgres-only feature (extensions, RLS, partial indexes, JSONB-specific operators). Trigger documented in `.agents/rules/testing.md`; build is a 5-line YAML when the trigger fires.
- **Open-source productization (`tanstack-start-e2e-kit`)** — 15-20 day expansion with maintenance commitment. Discussed in opportunity scan; held as V2+ stretch.
- **CDN / cache-layer regression detection** — explicit blind spot. Devil's Advocate flagged this as a real failure mode neither e2e nor audit catches. Out of scope; no current candidate solution.
- **Performance budgets (Lighthouse CI)** — separate concern; tracked outside this scope.
- **Visual regression testing** — pixel diffs, snapshot suites. Out of scope; would explode flake budget for low marginal value on a content site.
- **Cross-browser coverage (Firefox, WebKit)** — Chromium only in V1. Cross-browser adds ~3x CI time for low-value coverage on a content site; revisit only if a user-reported regression is browser-specific.
- **Skill auto-trigger on conversational hints** — both SKILL.md files require explicit invocation (slash command or direct skill name in prompt). No "fires when user mentions test" trigger lexicon.
- **Test report dashboard / external integrations** — no Allure, no TestRail, no Currents. Playwright HTML report + GHA artifact upload only.

## Architecture Decision Records

- [ADR-001: V1 scope and architecture for e2e-coverage + app-audit skill pair](adrs/adr-001.md) — Council-validated decision establishing the shared site-model pattern, 3 capability specs, owned auth fixture, PGLite, PR-blocking CI.
- [ADR-002: Pivot audit skill from browser-sweep to content-audit](adrs/adr-002.md) — Opportunity-scan supersession of ADR-001's `app-audit` scope. Replaces browser-sweep with MDX/frontmatter/translation/link audit aligned to the post-i18n failure mode.

## Open Questions

- **E2E seed-user provisioning**: via a `tests/e2e/setup.ts` global setup that creates the user once before the suite, or per-spec fixture that creates and tears down? Trade-off: global is faster but couples spec ordering; per-spec is isolated but slower.
- **Audit summary file schema**: pure markdown table in `docs/audits/SUMMARY.md`, or markdown with a JSON code-block per row for programmatic consumption? Currently leaning pure markdown for human-readability.
- **Content-audit abort threshold**: ADR-002 inherits the "2 consecutive zero-finding runs ⇒ retire" rule from ADR-001's app-audit. Content-audit will likely surface translation-gap findings for months as the pt-br catalog ramps — is this the right threshold or should it count only `blocker`-severity findings?
- **Build sequence**: site-model module first (foundation), then in parallel build auth fixture and write `auth-flow.spec.ts`? Or strictly serial (model → fixture → spec → next spec)?
- **Slash-command vs SKILL.md trigger lexicon**: which phrases auto-trigger the SKILL.md? Leaning narrow ("generate e2e spec", "audit content") to avoid mid-conversation noise.
- **Playwright project shape**: single project (Chromium only V1), or two projects (chromium + a "smoke" project for fastest critical-path subset)?
- **PGLite single-client serialization**: forces serial spec runs. Acceptable for 3 specs; revisit if V1.5 grows to 5+. Mitigation path = parallel projects against separate PGLite instances.
- **Test seed data location**: SQL file, TypeScript helper, or Drizzle-seed plugin? Repo already has `app/db/seed` patterns referenced in `package.json` scripts; reuse those?

## Cost Estimate

| Type                                        | Volume                                     | Estimated Cost                                       |
| ------------------------------------------- | ------------------------------------------ | ---------------------------------------------------- |
| GitHub Actions e2e job (PR-blocking)        | ~20-40 PRs / month × ~4 min                | ~80-160 min/mo (well within 2000-min free tier)      |
| GitHub Actions content-audit job (change-triggered) | ~5-10 runs / month × ~30 s         | ~3-5 min/mo                                          |
| Dev-time investment (V1 build)              | ~6-8 days end-to-end                       | One-time; sequential delivery (e2e first, audit second) |
| Maintenance burden                          | ~1-2 hr / month                            | Spec hot-swaps on route restructure; flake triage    |
| Runtime infrastructure (PGLite)             | In-process WASM                            | $0 (no Docker, no external DB)                       |
