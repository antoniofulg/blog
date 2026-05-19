---
provider: manual
pr:
round: 3
round_created_at: 2026-05-19T15:26:33Z
status: resolved
file: tests/e2e/fixtures/auth.ts
line: 22
severity: medium
author: claude-code
provider_ref:
---

# Issue 001: freshLogin helper still missing CI credential guard

## Review Comment

Round 2's issue 003 (auth.setup credential fallback bypasses CI guard) fixed the missing CI guard in `tests/e2e/auth.setup.ts:9-16` but explicitly deferred the parallel violation in `tests/e2e/fixtures/auth.ts:22-23` as out of batch scope ("`fixtures/auth.ts:22-23` (`freshLogin`) has the identical DRY violation and is out of batch scope. It should be addressed in a follow-up task."). The follow-up is the right place to land it.

Current state of `freshLogin` (`tests/e2e/fixtures/auth.ts:21-30`):

```ts
export async function freshLogin(page: Page): Promise<void> {
    const email = process.env.E2E_ADMIN_EMAIL ?? "e2e@test.local";
    const password = process.env.E2E_ADMIN_PASSWORD ?? "e2e-test-password";

    await page.goto("/login");
    ...
}
```

The two fallbacks at L22-23 silently substitute local defaults when env vars are unset. On CI with partial credentials (e.g. only `E2E_ADMIN_EMAIL` set, no password) or both absent, `freshLogin` proceeds with credentials that do not exist in the seeded DB. The login fails, the spec sees a 401, the developer chases a phantom auth bug instead of the real misconfiguration. This is exactly the regression `seed.ts` and `auth.setup.ts` already guard against — `freshLogin` is the last surface left exposed.

The duplication across three sites (`seed.ts:8-9`, `auth.setup.ts:9-10`, `fixtures/auth.ts:22-23`) also invites drift; rounds 1+2 already had to handle this anti-pattern twice.

**Suggested fix:** centralize credential resolution in a single helper (e.g. `tests/e2e/credentials.ts` exporting `getE2EAdminCredentials(env): { email: string; password: string }`) that enforces the CI guard once and is imported by `seed.ts`, `auth.setup.ts`, and `freshLogin`. Add a unit test that asserts the helper throws "Missing credential: …" when `process.env.CI === "true"` and either env var is unset. As a less invasive alternative, inline the same CI guard pattern used in `auth.setup.ts:9-16` directly into `freshLogin` before the goto.

## Triage

- Decision: `valid`
- Notes: Confirmed — `freshLogin` at L22-23 uses bare `?? "e2e@test.local"` / `?? "e2e-test-password"` with no CI guard. `auth.setup.ts` already uses `isCI ? undefined : "fallback"` + explicit throws. Applying the same inline guard pattern to `freshLogin`. No new helper file — keeps the fix minimal and avoids out-of-scope file creation.
