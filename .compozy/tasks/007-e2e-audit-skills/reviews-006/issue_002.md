---
provider: manual
pr:
round: 6
round_created_at: 2026-05-20T04:22:01Z
status: resolved
file: app/lib/app-audit/a11y-adapter.server.ts
line: 30
severity: medium
author: claude-code
provider_ref:
---

# Issue 002: analyzeA11y catch block calls page.url() which may also throw

## Review Comment

Round 5 issue 002 wrapped `AxeBuilder.analyze()` in `try/catch` to prevent unhandled rejection. The catch block at `app/lib/app-audit/a11y-adapter.server.ts:26-33` (approximate) constructs the `sweep-error` finding using `page.url()`. If `AxeBuilder.analyze()` failed *because the page is already closed or crashed* (which is the most common real-world failure path for `analyze()`), then `page.url()` in the catch handler also throws — Playwright's `Page` methods reject when the page is closed.

The result: an inner exception in the catch handler bypasses the recovery path. The orchestrator's outer `try/finally` at `checks.server.ts:85-92` has no `catch`, so the second exception propagates and aborts the entire audit run — exactly the regression round 5 issue 002 was meant to prevent.

This is a narrow but real fail-safe gap. The fix from round 5 stops the *normal* error path (axe-core's own throw, page navigation during analyze) but leaves the *page-already-closed* path open.

**Suggested fix:** capture the URL BEFORE invoking `analyze()`, so the catch handler has a stable string to reference:

```ts
export async function analyzeA11y(page: Page): Promise<AppAuditFinding[]> {
  const filePath = await safePageUrl(page); // captures or falls back to "unknown"
  try {
    const results = await new AxeBuilder({ page }).withTags([...A11Y_TAGS]).analyze();
    return results.violations.map((violation) => ({ ..., filePath }));
  } catch (err) {
    return [{ category: "sweep-error", severity: "major", filePath, message: `Axe analysis failed: ${err.message}` }];
  }
}

async function safePageUrl(page: Page): Promise<string> {
  try { return page.url(); } catch { return "unknown"; }
}
```

Add a Vitest test that mocks `page.url()` to throw and asserts the catch path still returns a `sweep-error` finding (not an unhandled exception).

## Triage

- Decision: `VALID`
- Notes: Confirmed at `a11y-adapter.server.ts:30` — the catch block calls `page.url()` directly. If the page is already closed (the most common real-world cause of `AxeBuilder.analyze()` failure), this second call also throws, bypassing the recovery path entirely. Fix: capture the URL via a `safePageUrl()` helper before calling `analyze()`, and use that captured string in both the success and failure paths. Test needed: mock `page.url()` to throw and assert the catch path still returns a `sweep-error` finding.
