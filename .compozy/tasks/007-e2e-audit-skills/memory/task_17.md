---
name: task-17-memory
description: Task 17 execution memory — browser-sweep, a11y-adapter, lighthouse modules
metadata:
  type: task
---

# Task Memory: task_17.md

## Objective Snapshot

Create three Playwright probe modules for app-audit:
- `app/lib/app-audit/browser-sweep.server.ts` — `sweepRoute(page, route): Promise<AppAuditFinding[]>`
- `app/lib/app-audit/a11y-adapter.server.ts` — `analyzeA11y(page): Promise<AppAuditFinding[]>`
- `app/lib/app-audit/lighthouse.server.ts` — `runLighthouse(url): Promise<LighthouseScores>` + `lighthouseToFindings()`
- Unit tests for all three (vitest)

## Important Decisions

- `sweepRoute` returns `AppAuditFinding[]` directly (not `BrowserSweepResult`). AC-3 requires it to return a sweep-error finding on throw — incompatible with raw BrowserSweepResult return. BrowserSweepResult is used internally + exported as type.
- `AppAuditCategory` and `AppAuditFinding` types defined in `browser-sweep.server.ts`. checks.server.ts (task_18) will import/re-export them. This avoids circular deps since checks.server.ts depends on browser-sweep.
- `Severity` type imported from `#/lib/content-audit/checks.server` (already exported there).
- @lhci/cli LighthouseRunner consumed via `createRequire` (CJS module). Options use `chromePath` at top level (not inside `settings`). CHROME_PATH env var alternative.
- Mixed-content, hydration-mismatch messages arrive via `page.on("console")` for `type === "error"`. Classification: mixed-content first, then hydration, then plain console-error.
- network-fail: `requestfailed` → status=0 (blocker), `response` with status >= 400 (5xx=blocker, 4xx=major).
- Helpers exported for unit testing: `classifyNetworkStatus`, `isHydrationMismatch`, `isMixedContent`.
- Integration tests for Lighthouse (AC-5) are skipped by default (require running preview server). Unit tests mock LighthouseRunner.

## Learnings

- @lhci/cli node-runner.js: `runner.run(url, { chromePath, settings: { chromeFlags } })` — `chromePath` at top level, `env.CHROME_PATH` set in runner. Returns JSON string.
- LHR categories key: `"best-practices"` (hyphenated), not `"bestPractices"`.
- @axe-core/playwright AxeBuilder API: `new AxeBuilder({ page }).withTags([...]).analyze()` → `results.violations[]` each with `id`, `impact`, `description`, `helpUrl`, `nodes`, `tags`.
- `chromium.executablePath()` from `@playwright/test` is synchronous.
- vite.config.ts SERVER_ONLY_IDS needs 3 new entries for the app-audit modules (task_18 adds them per TechSpec step 49).

## Files / Surfaces

- Created: `app/lib/app-audit/browser-sweep.server.ts`
- Created: `app/lib/app-audit/a11y-adapter.server.ts`
- Created: `app/lib/app-audit/lighthouse.server.ts`
- Created: `app/tests/browser-sweep.test.ts`
- Created: `app/tests/a11y-adapter.test.ts`
- Created: `app/tests/lighthouse.test.ts`
- NOT modified: `vite.config.ts` (serverOnlyStub for app-audit modules is task_18 step 49)

## Errors / Corrections

(none yet)

## Ready for Next Run

task_18 can start. It needs to:
1. Import AppAuditFinding from browser-sweep.server.ts (or define its own — the type is compatible)
2. Add 5 app-audit module IDs to vite.config.ts SERVER_ONLY_IDS (step 49)
3. Create checks.server.ts orchestrator
4. Create reporter.server.ts
