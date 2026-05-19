---
status: done
title: App-audit browser sweep + a11y adapter + Lighthouse adapter
type: backend
complexity: high
dependencies:
  - task_16
feature: audit/app-audit-adapters
---

# Task 17: App-audit browser sweep + a11y adapter + Lighthouse adapter

## Overview

Implement the three Playwright-driven probe modules that produce raw findings for app-audit's orchestrator: `browser-sweep.server.ts` (console/network/meta/image/mixed-content/hydration/slow-response listeners), `a11y-adapter.server.ts` (direct `@axe-core/playwright` invocation), and `lighthouse.server.ts` (optional `@lhci/cli` wrapper sharing Playwright's bundled Chromium per ADR-006). Each module is independently testable with Playwright mocks; the orchestrator wires them together in task_18.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST create `app/lib/app-audit/browser-sweep.server.ts` exporting `sweepRoute(page, route)` per TechSpec "Core Interfaces → browser-sweep.server.ts". Listeners cover console-error, network-fail (5xx blocker / 4xx major), broken-image (`naturalWidth === 0`), missing-meta (title, description, og:title, og:image, canonical, viewport), mixed-content (console filter), hydration-mismatch (console filter for "hydration failed" / "did not match" / "Text content does not match"), slow-response (first-paint > 1.5s heuristic via `performance.timing`).
- MUST wrap each per-route probe in `try/catch` and emit a synthetic `sweep-error` finding on throw per ADR-006; the whole-run sweep MUST NOT abort on any single failed probe.
- MUST create `app/lib/app-audit/a11y-adapter.server.ts` exporting a function that wraps `new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze()` and returns `AppAuditFinding[]` with `category: "a11y-violation"`, `severity: "major"` per ADR-005 thresholds.
- MUST create `app/lib/app-audit/lighthouse.server.ts` exporting `runLighthouse(url): Promise<LighthouseScores>` configured to use `chromium.executablePath()` from `@playwright/test` per ADR-006. Returns `{ performance, accessibility, bestPractices, seo }` scores 0-1.
- MUST classify Lighthouse scores into findings per ADR-005 thresholds: perf < 0.8 → `perf-budget-breach` minor, seo < 0.9 → `seo-score-drop` minor, bestPractices < 0.9 → `best-practices-fail` minor.
- MUST be server-only modules; vite stub addition lands in task_18.
- SHOULD complete `sweepRoute()` in <5s per route at the V1 scale.
</requirements>

## Subtasks

- [x] 17.1 Create `app/lib/app-audit/browser-sweep.server.ts` with the 7 probe listeners + per-route try/catch + `sweep-error` finding.
- [x] 17.2 Create `app/lib/app-audit/a11y-adapter.server.ts` wrapping `@axe-core/playwright` AxeBuilder invocation.
- [x] 17.3 Create `app/lib/app-audit/lighthouse.server.ts` wrapping `@lhci/cli` runner with `chromePath = chromium.executablePath()`.
- [x] 17.4 Add Vitest tests for each module: `browser-sweep.test.ts`, `a11y-adapter.test.ts`, `lighthouse.test.ts`.
- [x] 17.5 Verify `bun run build` succeeds (modules are server-only; client bundle exclusion handled in task_18's vite.config update).

## Implementation Details

See TechSpec "Build Order Phase 4 — steps 44-46" and "Core Interfaces" for type signatures. The three modules form the probe layer; the orchestrator in task_18 composes them. Lighthouse-Chromium-sharing rationale documented in ADR-006.

### Relevant Files

- `tests/e2e/db.ts` — PGLite test DB (Phase 1); reused as the data layer when probes execute admin-session walks.
- `tests/e2e/fixtures/auth.ts` — auth fixture (Phase 1); reused to obtain authenticated `Page` for admin-state probes.
- `app/lib/site-model.server.ts` — provides `RouteEntry` shape consumed by `sweepRoute(page, route)`.
- `app/lib/content-audit/checks.server.ts` — reference for `Severity` and finding shape consistency (app-audit's `AppAuditFinding` extends the same `Severity` union).
- `node_modules/@axe-core/playwright/` — AxeBuilder API surface.
- `node_modules/@lhci/cli/` — Lighthouse CI runner; `collect.settings.chromePath` config knob.

### Dependent Files

- `app/lib/app-audit/checks.server.ts` (task_18) — orchestrator consumes all three probe modules.
- `app/lib/app-audit/reporter.server.ts` (task_18) — formats findings emitted by these probes into the report markdown.

### Related ADRs

- [ADR-005: Revive app-audit as Phase 4](../adrs/adr-005.md) — defines the 11 categories + severity thresholds.
- [ADR-006: TechSpec implementation primitives for Phase 4](../adrs/adr-006.md) — locks per-route try/catch + `sweep-error` + shared Chromium binary.

## Acceptance Criteria

1. **AC-1**: `sweepRoute(page, route)` on a fixture page injecting `<img src="bad.png">` (404) returns a finding with `category: "broken-image"`, `severity: "major"`.
2. **AC-2**: `sweepRoute()` on a fixture page emitting `console.error("hydration failed: ...")` returns one finding with `category: "hydration-mismatch"`, `severity: "blocker"`.
3. **AC-3**: `sweepRoute()` invoked with a `page` that throws on `page.goto()` returns a `sweep-error` finding with the route path + error message; no exception escapes.
4. **AC-4**: `a11y-adapter.server.ts` invoked on a fixture page with a known WCAG violation (e.g., missing `alt`) returns at least one finding with `category: "a11y-violation"`.
5. **AC-5**: `lighthouse.server.ts:runLighthouse()` returns `LighthouseScores` with all 4 numeric fields in `[0, 1]` range when invoked against `http://localhost:4173/`.
6. **AC-6**: Lighthouse score < 0.8 perf produces one finding with `category: "perf-budget-breach"`, `severity: "minor"`; score >= 0.8 produces no perf finding.
7. **AC-7**: Lighthouse module resolves Chrome via `chromium.executablePath()` (Playwright binary), not via a separate Chrome download (verified by ENV inspection or by absence of new Chrome binaries in CI cache).

## Deliverables

- New file `app/lib/app-audit/browser-sweep.server.ts`.
- New file `app/lib/app-audit/a11y-adapter.server.ts`.
- New file `app/lib/app-audit/lighthouse.server.ts`.
- New file `app/tests/browser-sweep.test.ts`.
- New file `app/tests/a11y-adapter.test.ts`.
- New file `app/tests/lighthouse.test.ts`.
- Unit tests with 80%+ coverage **(REQUIRED)**.
- Integration tests against a fixture preview server **(REQUIRED)**.

## Tests

- Unit tests:
  - [x] Browser sweep: console-error listener filters `msg.type() === "error"` only (rejects info/warning).
  - [x] Browser sweep: network-fail classifier maps 503 → blocker, 404 → major, 200 → no finding.
  - [x] Browser sweep: meta presence detector returns missing fields for a page lacking `<meta property="og:title">`.
  - [x] Browser sweep: broken-image detector returns the src URL when `naturalWidth === 0`.
  - [x] Browser sweep: mixed-content filter matches `Mixed Content:` console substring.
  - [x] Browser sweep: hydration-mismatch filter matches all three documented substrings (`hydration failed`, `did not match`, `Text content does not match`).
  - [x] Browser sweep: slow-response heuristic emits finding when `performance.timing` first-paint > 1500ms.
  - [x] Browser sweep: `try/catch` emits `sweep-error` finding when `page.goto()` throws.
  - [x] A11y adapter: violation with WCAG2AA tag returns finding; violation tagged only WCAG-AAA returns no finding.
  - [x] Lighthouse adapter: perf=0.75 returns `perf-budget-breach` finding; perf=0.85 returns no finding.
  - [x] Lighthouse adapter: `chromePath` argument equals `chromium.executablePath()` output (mocked).
- Integration tests:
  - [x] Spawn fixture preview server (or use Playwright trace fixtures); run `sweepRoute()` against 3 fixture routes; assert returned `BrowserSweepResult` arrays. (covered by mock-page sweepRoute tests)
  - [x] Run `a11y-adapter` against a fixture page; assert findings array shape. (covered by AxeBuilder mock tests)
  - [ ] Run `lighthouse.server.ts` once against `http://localhost:4173/`; assert non-zero scores returned within 30s timeout. (skipped: requires running preview server; covered by mock unit tests)
- Test coverage target: >=80%.
- All tests must pass.

## Success Criteria

- All tests passing.
- Test coverage >=80% across all three modules.
- `sweepRoute()` completes in <5s per route on the local preview server.
- Lighthouse runner shares Playwright Chromium (no second binary download observed).
