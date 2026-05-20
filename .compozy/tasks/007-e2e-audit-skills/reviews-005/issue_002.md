---
provider: manual
pr:
round: 5
round_created_at: 2026-05-20T04:06:44Z
status: resolved
file: app/lib/app-audit/a11y-adapter.server.ts
line: 8
severity: medium
author: claude-code
provider_ref:
---

# Issue 002: analyzeA11y throws unhandled, aborts entire audit run

## Review Comment

`app/lib/app-audit/a11y-adapter.server.ts:8-24` invokes `new AxeBuilder({ page }).withTags([...A11Y_TAGS]).analyze()` with no `try/catch`. If `AxeBuilder.analyze()` throws (page crash mid-analysis, axe-core script injection failure, page navigation during analysis, page closed prematurely), the rejection propagates to the orchestrator at `checks.server.ts:85-92`:

```ts
try {
  const sweep = await sweepRoute(page, routeWithLocale);
  findings.push(...sweep);
  const a11y = await analyzeA11y(page);  // <-- unhandled if throws
  findings.push(...a11y);
} finally {
  await page.close();
}
```

The block has no `catch` clause. An a11y exception aborts the entire 28-inspection run, killing all subsequent route walks. The `try/finally` only ensures the current page closes, not error containment. Compare this with `sweepRoute()` (browser-sweep.server.ts:259-275) which is wrapped per-route in try/catch and emits a `sweep-error` finding on throw per ADR-006. The a11y adapter is missing the equivalent safety net.

Real-world impact: a single page with a malformed `<iframe>` that axe-core chokes on kills the audit for all other routes. Developer sees an unhandled rejection trace, no report, no SUMMARY row, no useful diagnostic.

**Suggested fix:** wrap the `analyze()` call in a `try/catch` inside `analyzeA11y()`. On catch, return an `AppAuditFinding[]` containing a single synthetic finding with `category: "sweep-error"` (or a new `a11y-error` category if you want to differentiate), `severity: "major"`, `filePath: page.url()`, and `message: \`Axe analysis failed: ${err.message}\``. Mirrors the ADR-006 pattern for browser sweep. Add a Vitest test that injects a forced `AxeBuilder` throw (via mock) and asserts the orchestrator still produces findings for the next route in the iteration.

## Triage

- Decision: `valid`
- Notes: Confirmed. `a11y-adapter.server.ts:9-11` has bare `await analyze()` with no try/catch. `checks.server.ts:85-92` wraps with `try/finally` (page close) not `try/catch` (error containment). An axe throw kills the whole 28-inspection run. Fix: wrap `analyze()` in try/catch inside `analyzeA11y`, return `sweep-error` finding on catch.
