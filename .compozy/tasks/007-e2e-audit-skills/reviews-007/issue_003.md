---
provider: manual
pr:
round: 7
round_created_at: 2026-05-20T04:43:24Z
status: resolved
file: app/lib/app-audit/checks.server.ts
line: 85
severity: medium
author: claude-code
provider_ref:
---

# Issue 003: Axe analysis runs on destroyed page context after sweep failure (duplicate sweep-errors)

## Review Comment

The first real `make audit` execution (`docs/_reports/app-audit-2026-05-20.md`) shows 24 `sweep-error` findings with:

```
Axe analysis failed: evaluate: Execution context was destroyed,
most likely because of a navigation
```

— with `filePath: about:blank`. These pair 1-to-1 with the 24 `goto: net::ERR_CONNECTION_REFUSED` findings: every failed `sweepRoute` leaves the page in `about:blank` state, then the orchestrator unconditionally invokes `analyzeA11y(page)` on the destroyed context, producing a second cascading `sweep-error`.

The orchestrator at `app/lib/app-audit/checks.server.ts:85-92` (approximate):

```ts
try {
  const sweep = await sweepRoute(page, routeWithLocale);
  findings.push(...sweep);
  const a11y = await analyzeA11y(page);    // runs even if sweep returned sweep-error
  findings.push(...a11y);
} finally {
  await page.close();
}
```

The `try/finally` ensures the page closes but `analyzeA11y` runs unconditionally — including when `sweepRoute` returned a `sweep-error` finding (page navigation failed; page is `about:blank`). Three downstream problems:

1. **Duplicate findings per route**: each failed route emits a `sweep-error` from `sweepRoute` AND a `sweep-error` from `analyzeA11y` — finding count doubles for failed routes, inflating the report (60 findings for 12 routes is exactly 12 × 5 = 60; without doubling it would be ~36).
2. **Misleading filePath**: the second sweep-error has `filePath: about:blank` instead of the actual route path (since `safePageUrl` from round 6 issue 002 fix returns the current page URL, which is now `about:blank` after the failed goto).
3. **Wasted Playwright operations**: axe-core injection + evaluate against a destroyed context throws immediately, but the round-trip still costs ~50-200ms per failed route. At 24 failed routes, that's 1-5s of wasted overhead.

The architecture flaw: `sweepRoute` returning a sweep-error should signal "page is not in a usable state; skip downstream analysis on this page." Currently the contract is implicit.

**Suggested fix:** detect sweep-error in the orchestrator and short-circuit:

```ts
try {
  const sweep = await sweepRoute(page, routeWithLocale);
  findings.push(...sweep);
  const hasSweepError = sweep.some((f) => f.category === "sweep-error");
  if (!hasSweepError) {
    const a11y = await analyzeA11y(page);
    findings.push(...a11y);
  }
} finally {
  await page.close();
}
```

Cleaner alternative: have `sweepRoute` return a structured result (`{ result: BrowserSweepResult } | { error: AppAuditFinding }`) so the orchestrator branches on a typed signal instead of pattern-matching on category strings. Trade-off: more code, stronger types.

Add a Vitest test: mock `sweepRoute` to return a sweep-error; assert `analyzeA11y` is NOT called and the route produces exactly one finding (not two).

## Triage

- Decision: `valid`
- Root cause: `analyzeA11y(page)` called unconditionally after `sweepRoute`. When sweep fails with `sweep-error`, page is `about:blank` → axe throws "Execution context was destroyed" → second sweep-error per failed route.
- Fix: check `sweep.some((f) => f.category === "sweep-error")` and skip `analyzeA11y` when true. Add test asserting analyzeA11y not called when sweep returns sweep-error.
