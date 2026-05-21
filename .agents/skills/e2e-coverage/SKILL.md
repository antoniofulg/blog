---
name: e2e-coverage
description: >
  Playwright E2E coverage for this blog. Handles bootstrap detection, route
  inventory diff, spec generation, and run modes. Use when asked to "generate
  e2e spec", "add playwright test", "write browser regression test", "bootstrap
  playwright", or "run e2e tests". Do NOT activate on general mentions of
  "testing" or "unit test".
context: fork
version: 1.0.0
tags: [e2e, playwright, testing, browser, regression, spec-generation, coverage]
allowed-tools: [Read, Write, Edit, Bash, Grep, Glob]
user-invocable: true
---

# e2e-coverage

Playwright E2E skill for `blog`. Canonical entrypoint for bootstrap, spec
generation, and run operations. Canonical pattern: `tests/e2e/auth-flow.spec.ts`.

## Bootstrap Detection

Before generating specs, check if Playwright is already installed:

```bash
# Check Playwright binary
bunx playwright --version 2>/dev/null || echo "not installed"

# Check for existing config
ls playwright.config.ts 2>/dev/null
```

If missing: `bunx playwright install chromium` and ensure
`playwright.config.ts` exists at project root.

## Route Inventory Diff

Use `app/lib/site-model.server.ts` as source of truth for all routes:

```bash
# List all routes registered in site-model
grep -n "path:" app/lib/site-model.server.ts

# Compare against existing specs
ls tests/e2e/**/*.spec.ts 2>/dev/null
```

A route with no matching spec in `tests/e2e/` is a coverage gap. Generate a
spec for each gap — one spec file per route cluster (auth, admin, public).

## Spec Generation

New specs go in `tests/e2e/`. Naming: `<cluster>-<surface>.spec.ts`.

```typescript
// Canonical import pattern
import { test, expect } from "./fixtures/auth";

// Tag every describe block — at minimum @smoke
test.describe("route name", { tag: ["@smoke", "@<cluster>"] }, () => {
  // ...
});
```

Fixture: `tests/e2e/fixtures/auth.ts` — use `authedPage` for authenticated
tests, `page` with `test.use({ storageState: { cookies: [], origins: [] } })`
for anonymous tests.

Credentials: read from `process.env.E2E_ADMIN_EMAIL` and
`process.env.E2E_ADMIN_PASSWORD`. Never hardcode.

## Hydration Marker Convention

TanStack Start completes SSR hydration on `load` event. Use:

```typescript
await page.waitForLoadState("load");
// then assert with expect(element).toBeVisible()
```

For navigation assertions use `page.waitForURL()` before checking content.
Never use `page.waitForTimeout()`.

## Run Modes

| Mode | Command | Use |
|------|---------|-----|
| Full suite | `make test-e2e` | CI + pre-PR |
| UI mode | `bun run test:e2e:ui` | Debug locally |
| Debug mode | `bun run test:e2e:debug` | Single test step-through |
| Single spec | `bunx playwright test tests/e2e/<file>.spec.ts` | Focused run |

All modes require the preview server (`bun run build && bun run preview`) or
the webServer defined in `playwright.config.ts`.

## Tag Taxonomy

| Tag | Meaning |
|-----|---------|
| `@smoke` | Required on every spec — gates CI |
| `@auth` | Touches login, session, or logout |
| `@admin` | Accesses `/admin` routes |
| `@public` | Anonymous/reader flows |
| `@flaky` | Quarantined — requires ISO-date comment; 48 h SLA |

```typescript
// @flaky quarantine format (48 h SLA — enforced by lint-tests CI step)
// @flaky 2025-11-01 reason: race on slow CI runner
test.skip("...", async () => { ... });
```

## Selector Hierarchy

Follow `.agents/rules/testing.md` selector order. Summary:

1. `getByRole` — prefer always
2. `getByLabel` — for form inputs
3. `getByText` — when no role/label
4. `data-testid` — last resort for non-semantic elements

CSS selectors (`.class`, `#id`, `input[type=...]`) are banned.

## Fixture Usage

```typescript
// Authenticated test
test("admin can see dashboard", async ({ authedPage }) => {
  await authedPage.goto("/admin");
  await authedPage.waitForLoadState("load");
  await expect(authedPage.getByRole("heading", { name: /Admin/i })).toBeVisible();
});

// Anonymous test
test.use({ storageState: { cookies: [], origins: [] } });
test("login page renders", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading")).toBeVisible();
});
```

## Related

- `tests/e2e/auth-flow.spec.ts` — canonical pattern (login + session + logout)
- `.agents/rules/testing.md` — selector, wait, naming, tag rules
- `.agents/rules/auth.md` — seeded user requirement, storageState hygiene
- `.agents/rules/cicd.md` — e2e CI gate, required GitHub Secrets
