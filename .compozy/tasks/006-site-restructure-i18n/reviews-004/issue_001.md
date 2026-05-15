---
provider: manual
pr:
round: 4
round_created_at: 2026-05-15T13:36:45Z
status: resolved
file: app/tests/ssr-redirect.test.ts
line: 22
severity: medium
author: claude-code
provider_ref:
---

# Issue 001: PRD critical-path integration tests skipped in CI

## Review Comment

The PRD ships six test files containing `describe.skipIf(port3000Free)` blocks — these blocks contain the only assertions that exercise ADR-005's cookie-first SSR redirect, the About route fallback rendering, hreflang pair generation on locale-aware pages, and the `/robots.txt` response shape end-to-end:

- `app/tests/ssr-redirect.test.ts:22` — cookie precedence, Accept-Language fallback, Vary header on 200 AND 302 (the round-003 fix)
- `app/tests/about.test.ts:183` — About hreflang, `lang` attribute, fallback rendering
- `app/tests/lang-slug-route.test.ts:298` — post-detail hreflang, fallback `<article lang="en">` (round-002 fix)
- `app/tests/lang-blog-route.test.ts`, `public-routes.test.ts`, `robots-txt.test.ts` — same pattern

`describe.skipIf(port3000Free)` skips when port 3000 is free. The CI `quality` job in `.github/workflows/ci.yml` runs `make test` directly against a fresh checkout with no dev server running, so every integration block in the list above is **skipped on every CI run**. The job reports green by skipping, not by passing the assertions.

Consequence: every fix landed in rounds 001-003 has an accompanying integration test that **does not actually run in CI**. The protection those tests advertise (e.g., "the 302 redirect carries Vary header") is real only when the author manually runs `bun run dev` + `bun test ssr-redirect`. The next person to refactor `{-$locale}/index.tsx` and accidentally drop the Vary headers will see a green PR, deploy, and watch the CDN poison itself.

The pattern is **pre-existing** — `auth-integ.test.ts`, `indexer-integ.test.ts`, `seed.test.ts`, `docker-compose.test.ts` all use the same skip-when-port-free convention, dating back to TASK-0005. This PRD did not introduce the convention, but it added a meaningful volume of new integration tests for V1 critical paths (locale routing, About migration, redirect logic) that share the gap. The PRD's success metrics ("CI green on every phase merge") and ADR-005 ("Unit tests must cover... five cookie/Accept-Language combinations") are partially fulfilled — the tests **exist** but do not **execute** under CI conditions.

ADR-005 implementation notes explicitly state: "Unit tests must cover: (a) cookie=en → no redirect, (b) cookie=pt-br → 302 to /pt-br/, (c) no cookie + Accept-Language: pt → 302, (d) no cookie + Accept-Language: en → no redirect, (e) no cookie + no Accept-Language → no redirect." These are all written as integration tests (require a live HTTP fetch against port 3000) rather than unit tests on `detectLocaleFromRequest` directly. The unit-level coverage on `detectLocaleFromRequest` (`locale.test.ts:65-127`) already covers most cases, but the *integration path through `beforeLoad`* — including the `setResponseHeader` + redirect-headers interaction — is only exercised when the live server is up.

**Suggested fix** (any combination of the three):

1. **Add a CI integration job** that starts the runner image plus a Postgres sidecar, then runs `bun test integration` against `BASE_URL=http://localhost:3000`. The existing `docker-build` job already builds the runner image and runs `db:migrate`; extend it to also `docker compose up -d` and execute the integration tests. Most expensive option; highest fidelity.

2. **Convert critical-path integration tests into unit tests** that mock the SSR fetch path. For example, refactor `beforeLoad` into a pure function `computeRootBeforeLoad(req: Request): RedirectResponse | OkResponse` that returns a description of the response; unit-test that function with synthetic Request objects. This loses the live HTTP round-trip but covers the redirect/header logic in CI.

3. **Fail fast when an integration test is skipped** in CI mode. Replace `describe.skipIf` with `describe` that throws an error when `process.env.CI === "true"` and port 3000 is unavailable. CI would then surface "integration tests cannot run in this environment — fix the harness" instead of silently passing.

Option 2 has the best near-term cost/benefit for this PRD's surface — most of the critical paths are reasonably mockable. Option 1 is the right long-term answer but is project-scope work. Option 3 is a stopgap that at least makes the gap visible.

Marking severity medium rather than high because the pattern predates this PRD and the project has clearly chosen to live with it; the V1 author still validated each fix locally before merging. Flagging it because the volume of new skip-in-CI tests has crossed a threshold where the green CI signal is materially misleading.

## Triage

- Decision: `valid`
- Root cause: `describe.skipIf(port3000Free)` skips every test block when CI runs `make test` against a fresh checkout with no dev server. All 6 integration tests in `ssr-redirect.test.ts` (and the corresponding blocks in the other five test files) are silently skipped on every CI run. ADR-005 requires unit coverage of five cookie/Accept-Language combinations; those cases exist only as integration tests and never execute in CI.
- Fix approach (Option 2, within `ssr-redirect.test.ts` scope only): Add a `"unit: beforeLoad redirect decision (ADR-005)"` describe block that imports `detectLocaleFromRequest` and `DEFAULT_LOCALE` from `#/lib/locale` and tests the redirect-decision logic (the same function `beforeLoad` calls) with synthetic `Request` objects. Covers all five ADR-005 cases without a live server. The Vary-header assertions (`setResponseHeader` + redirect `headers`) require the live SSR context and remain integration-only; a comment documents this gap. Existing integration tests are left unchanged. No source files outside `ssr-redirect.test.ts` are touched.
- Notes: Option 1 (CI integration job) is the long-term correct fix but is project-scope work outside this PRD. Option 3 (fail-fast on CI=true) would break CI immediately since port 3000 is never available in the quality job. Option 2 gives CI coverage for the redirect-decision path at reasonable cost.
