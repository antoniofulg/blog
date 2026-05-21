---
provider: manual
pr:
round: 13
round_created_at: 2026-05-20T22:39:05Z
status: resolved
file: tests/e2e/public-read.spec.ts
line: 1
severity: medium
author: claude-code
provider_ref:
---

# Issue 002: New `/pt-br/` and `/en/` shim routes have no regression test

## Review Comment

Commit `ac8ffb1` added two literal locale-index routes (`app/routes/pt-br.index.tsx`, `app/routes/en.index.tsx`) to fix the `/pt-br/` and `/en/` 404 documented in `reviews-012/issue_002.md`. Verification was an interactive `curl` session — no automated test was added in the same commit.

The round-012 issue 002 fix notes explicitly deferred this:

> Criterion 4 (e2e spec covering pt-br) … tracked as follow-ups — the routing fix is the substantive remediation, the spec coverage is a separate concern.

This is that follow-up. Without an automated regression test:

1. A future TanStack Router upgrade that "fixes" the underlying optional-param matcher could silently remove the need for the shim, but no test would tell us when to delete the shim files.
2. A future contributor renaming or restructuring `app/routes/{-$locale}/index.tsx` could break the `getLocalePosts` import path in the shims (`from "./{-$locale}/index.server"`) without immediate signal — the build would catch a path break, but a behavioral regression (wrong loader, wrong canonical) would slip past `make test` / `make e2e`.
3. The audit walker no longer surfaces `/pt-br/` as a blocker (issue resolved), so the audit gate cannot serve as an indirect regression test for this route.

## Suggested fix

Add a Playwright spec at `tests/e2e/public-read.spec.ts` (or extend the existing one) covering both shim routes. Suggested test shape — one test per route:

```ts
import { test, expect } from "@playwright/test";

test.describe("locale-index routes", { tag: ["@public", "@smoke"] }, () => {
    for (const { route, expectedLang, expectedCanonical } of [
        { route: "/pt-br/", expectedLang: "pt-BR", expectedCanonical: "/pt-br/" },
        { route: "/en/", expectedLang: "en", expectedCanonical: "/" },
        { route: "/", expectedLang: "en", expectedCanonical: "/" },
    ]) {
        test(`${route} renders 200, sets <html lang>, and emits expected canonical`, async ({ page }) => {
            const response = await page.goto(route);
            expect(response?.status()).toBe(200);
            await expect(page.locator("html")).toHaveAttribute("lang", expectedLang);
            const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
            expect(canonical).toContain(expectedCanonical);
        });
    }

    test("/pt-br (no trailing slash) redirects to /pt-br/", async ({ page }) => {
        const response = await page.goto("/pt-br");
        expect(response?.url()).toMatch(/\/pt-br\/$/);
        expect(response?.status()).toBe(200);
    });
});
```

Both PRD acceptance criterion 4 (round-012 issue 002) and the post-fix verification matrix from `reviews-012/issue_002.md` ("### Fix landed" section) are satisfied by this spec.

If a third locale is added later, the iteration array picks it up automatically — keeping the test in lock-step with the locale catalogue.

## Acceptance criteria

1. `tests/e2e/public-read.spec.ts` (or new `tests/e2e/locale-routing.spec.ts`) contains tests asserting 200 + correct `<html lang>` + correct canonical for `/`, `/pt-br/`, and `/en/`.
2. The trailing-slash redirect (`/pt-br → /pt-br/`) is exercised at least once.
3. The spec is tagged `@public @smoke` per `.agents/rules/testing.md` taxonomy.
4. `make e2e` passes with the new spec on a clean tree.
5. Deleting `app/routes/pt-br.index.tsx` (e.g., via `git stash`) causes the new test to fail with a non-404 expectation mismatch — proves the spec actually exercises the shim path.

## Triage

- Decision: `valid`
- Notes: No E2E spec covers the `/pt-br/` and `/en/` shim routes added in commit `ac8ffb1`. The existing `public-read.spec.ts` only tests individual post pages and locale switcher, not the locale-index routes themselves. Fix: extend `tests/e2e/public-read.spec.ts` with a new `locale-index routes` describe block tagged `@public @smoke`. Tests assert 200 status, correct `<html lang>`, and expected canonical URL for `/`, `/pt-br/`, and `/en/`. Canonical check uses `.last()` to get the child-route canonical (most specific), since TanStack Router concatenates all matched route `head()` links and the child's canonical should win semantically. Trailing-slash redirect test (`/pt-br → /pt-br/`) added as well; relies on TanStack Start/Nitro default trailing-slash normalization — if Nitro does not redirect, this assertion may need revisiting in CI.
