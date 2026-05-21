---
provider: manual
pr:
round: 3
round_created_at: 2026-05-19T15:26:33Z
status: resolved
file: tests/e2e/auth.setup.ts
line: 15
severity: low
author: claude-code
provider_ref:
---

# Issue 002: auth.setup and freshLogin use raw CSS selectors, violating testing.md hierarchy

## Review Comment

`.agents/rules/testing.md` (added in task_08 / round 1) codifies the Playwright selector hierarchy as `getByRole > getByLabel > getByText > data-testid` and explicitly bans raw CSS selectors. The capability specs (`tests/e2e/auth-flow.spec.ts:15-17`, `tests/e2e/admin-write.spec.ts:80-82`) follow this rule using `getByLabel("Email")`, `getByLabel("Senha")`, and `getByRole("button", { name: /Entrar/i })`.

Two infra files deviate from the rule and use raw CSS selectors instead:

`tests/e2e/auth.setup.ts:15-17`:
```ts
await page.locator('input[name="email"]').fill(email);
await page.locator('input[name="password"]').fill(password);
await page.locator('button[type="submit"]').click();
```

`tests/e2e/fixtures/auth.ts:25-27` (`freshLogin` body) — same three CSS selectors.

There is no comment marking these as intentional exceptions, and round 1 issue 009 (closed INVALID) confirmed the login form's labels are hardcoded Portuguese literals not driven by i18n, so the CSS-bypass cannot be justified on locale-resolution grounds. The result is two-tier selector discipline: specs follow the documented hierarchy, infra silently violates it. Future developers extending `auth.setup` or `freshLogin` inherit the violation; a refactor that renames `name="email"` to `name="user-email"` breaks the setup project without breaking any spec.

**Suggested fix:** replace the CSS selectors in both files with the documented hierarchy:

```ts
await page.getByLabel("Email").fill(email);
await page.getByLabel("Senha").fill(password);
await page.getByRole("button", { name: /Entrar/i }).click();
```

Apply identically to `freshLogin` in `tests/e2e/fixtures/auth.ts`. After replacement, re-run `bunx playwright test --project=setup` to verify the storageState save path still completes cleanly. If for some reason `getByLabel` cannot resolve at setup time (e.g. label is not yet hydrated when the test runs), add a `page.waitForLoadState("domcontentloaded")` before the form interaction rather than reverting to CSS.

## Triage

- Decision: `valid`
- Notes: Confirmed — `auth.setup.ts:21-23` and `fixtures/auth.ts:26-28` both use `locator('input[name="email"]')`, `locator('input[name="password"]')`, `locator('button[type="submit"]')`. Testing rules explicitly ban CSS selectors and mandate `getByLabel` / `getByRole`. Replacing all six occurrences across both files.
