# Testing Rules

## Vitest vs. Playwright Boundary

| Concern | Tool | Location |
|---------|------|----------|
| Unit logic, pure functions | Vitest | `app/tests/` |
| Component rendering, route loading | Vitest | `app/tests/` |
| Full browser flows, auth round-trips | Playwright | `tests/e2e/` |
| CI infra validation, file assertions | Vitest | `app/tests/` |

Rule: if the test requires a real browser, it belongs in `tests/e2e/`. If it
can run in Node with JSDOM or just file reads, it belongs in `app/tests/`.

## Layout

```
app/tests/      — Vitest tests (co-located with app logic)
tests/e2e/      — Playwright E2E specs
  fixtures/     — test.extend wrappers (auth.ts)
  .auth/        — storageState files (gitignored, never committed)
  *.spec.ts     — capability spec files
  *.setup.ts    — Playwright setup projects (auth.setup.ts)
  global-setup.ts, global-teardown.ts — PGLite harness lifecycle
```

## Selector Hierarchy

Use selectors in this order. Stop at the first that uniquely identifies the element.

1. `getByRole` — always preferred; accessible name matches user-visible text
2. `getByLabel` — for form inputs bound to `<label>`
3. `getByText` — when no semantic role or label exists
4. `data-testid` — last resort for non-semantic elements; add sparingly

```typescript
// GOOD
await page.getByRole("button", { name: /Entrar/i }).click();
await page.getByLabel("Email").fill("user@example.com");
await page.getByLabel("Senha").fill("password");

// ACCEPTABLE — no better option available
await page.getByText("Dashboard").click();
await page.getByTestId("post-list").waitFor();

// BANNED — CSS selectors
await page.locator(".btn-primary").click();        // banned
await page.locator("#submit-btn").click();         // banned
await page.locator("input[type=password]").fill(); // banned
```

## Wait Strategy

- **BANNED**: `page.waitForTimeout(N)` — never use fixed sleeps.
- Use `page.waitForURL()` after navigation triggers.
- Use `page.waitForLoadState("load")` as the hydration barrier for TanStack
  Start pages — SSR hydration completes on the `load` event.
- Use `expect(element).toBeVisible()` — Playwright's auto-waiting handles retries.
- Use `page.waitForResponse()` only when testing specific API calls.

```typescript
// GOOD — navigation
await page.getByRole("button", { name: /Entrar/i }).click();
await page.waitForURL((url) => !url.pathname.startsWith("/login"));

// GOOD — hydration
await page.goto("/admin");
await page.waitForLoadState("load");
await expect(page.getByRole("heading", { name: /Admin/i })).toBeVisible();

// BANNED
await page.waitForTimeout(2000);
```

## Naming

- Spec files: `<cluster>-<surface>.spec.ts` (e.g., `admin-write.spec.ts`, `public-read.spec.ts`)
- Describe blocks: plain English, reflects the route or feature under test
- Test names: "subject: expected behavior given context" — imperative, no "should"

```typescript
// GOOD
test("login round-trip: seeded credentials → redirect and session cookie set", ...)
test("wrong password → error alert visible and URL stays at /login", ...)

// AVOID
test("should login the user", ...)
test("test that login works", ...)
```

## Tag Taxonomy

Every `test.describe` MUST include `@smoke` plus at least one cluster tag.

| Tag | Meaning | Required on |
|-----|---------|-------------|
| `@smoke` | CI gate — blocks merge if fails | every describe block |
| `@auth` | Touches login, session, logout | auth-related specs |
| `@admin` | Accesses `/admin` routes | admin-related specs |
| `@public` | Anonymous/reader flows | public route specs |
| `@flaky` | Quarantined — SLA tracked | flaky tests only |

```typescript
test.describe("auth flow", { tag: ["@auth", "@smoke"] }, () => { ... });
test.describe("admin dashboard", { tag: ["@admin", "@smoke"] }, () => { ... });
```

## 48h SLA Rule for @flaky

Any test marked `@flaky` or `.skip` MUST have an ISO-date comment on the
preceding line. The `lint-tests` CI step enforces a 48-hour SLA: annotations
older than 48 hours fail the build.

```typescript
// @flaky 2025-11-01 reason: race condition on slow CI runner — tracking issue #42
test.skip("slow network test", async () => { ... });
```

Resolution path: fix the root cause, remove the annotation, re-tag as `@smoke`.
Quarantine is not a permanent state.

## Anti-Patterns

- Never use `waitForTimeout` — it masks real timing problems.
- Never use CSS selectors (`locator(".class")`, `locator("#id")`) — brittle on DOM changes.
- Never commit `.auth/` files or `storageState.json` — see `.agents/rules/auth.md`.
- Never hardcode E2E credentials — use `process.env.E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`.
- Never run E2E tests against the production database or environment.
- Never add route opt-outs to `site-model.server.ts` without documenting the reason.
