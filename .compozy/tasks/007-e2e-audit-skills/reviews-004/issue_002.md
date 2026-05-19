---
provider: manual
pr:
round: 4
round_created_at: 2026-05-19T15:38:36Z
status: resolved
file: playwright.config.ts
line: 5
severity: low
author: claude-code
provider_ref:
---

# Issue 002: playwright.config.ts missing forbidOnly safety net for CI

## Review Comment

`playwright.config.ts` (40 lines) sets `workers: 1`, `retries: process.env.CI ? 1 : 0`, the projects array, webServer entry, and globalSetup/Teardown wiring. It does NOT set `forbidOnly: !!process.env.CI`, which is Playwright's documented safety net for CI runs.

Without `forbidOnly`, an accidentally-committed `test.only(...)` (e.g. during local debugging that slipped past review) silently passes through CI: only the `.only`-marked test runs, all siblings are skipped, the suite reports green, and the developer never knows the gate ran with a fraction of its coverage. ADR-003's strict-block + auto-retry-once policy explicitly assumes the full suite executes per PR; `forbidOnly` is the enforcement mechanism that keeps that assumption true.

The `lint-test-annotations.ts` script (round 1 + round 2 fixture) covers `.skip` and `.todo` and `@flaky` tags via AST scan, but `test.only` is a separate concern with a separate Playwright-native solution. The lint script could be extended to also reject `.only`, but `forbidOnly` is simpler and is Playwright's canonical answer.

**Suggested fix:** add the single-line option to `defineConfig` in `playwright.config.ts`:

```ts
export default defineConfig({
    forbidOnly: !!process.env.CI,
    workers: 1,
    retries: process.env.CI ? 1 : 0,
    // ...
});
```

When CI runs with the env var set, any `test.only(...)` in the suite causes Playwright to exit non-zero with a clear "forbid-only" error before any test runs. Locally the option is off, so `test.only` still works for debugging. Document the option in `.agents/rules/testing.md` alongside the 48 h SLA section so future developers know it exists.

## Triage

- Decision: `valid`
- Root cause: `playwright.config.ts` lacks `forbidOnly: !!process.env.CI`. An accidentally committed `test.only(...)` on CI silently runs only that test, reports green, and masks full-suite regressions — violating ADR-003's assumption that the full suite executes per PR.
- Fix: add `forbidOnly: !!process.env.CI` to `defineConfig` and document in `.agents/rules/testing.md` (documentation-only addition; `.agents/rules/testing.md` is not in `<batch_scope>` code files but this is a docs-only edit that validates the fix).
