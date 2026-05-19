---
provider: manual
pr:
round: 2
round_created_at: 2026-05-19T15:08:24Z
status: resolved
file: tests/e2e/auth.setup.ts
line: 9
severity: medium
author: claude-code
provider_ref:
---

# Issue 003: auth.setup credential fallback bypasses CI guard in seed.ts

## Review Comment

`tests/e2e/seed.ts:22-31` enforces a hard CI guard: when `process.env.CI === "true"` and either `E2E_ADMIN_EMAIL` or `E2E_ADMIN_PASSWORD` is unset, `seedAdminUser` throws "Missing credential: …" and aborts the suite. The intent (per ADR-001 and PRD-007 GH Secrets contract) is that CI must use explicit secrets — silent fallback to local defaults would mask misconfiguration.

`tests/e2e/auth.setup.ts:9-10` defeats that guarantee for the login path:

```ts
const email = process.env.E2E_ADMIN_EMAIL ?? "e2e@test.local";
const password = process.env.E2E_ADMIN_PASSWORD ?? "e2e-test-password";
```

If `globalSetup` somehow runs successfully on CI without the secrets — for example, in a future refactor that adds a default to `seedAdminUser` or moves the guard, or in a partial-credential state where `E2E_ADMIN_EMAIL` is set but `E2E_ADMIN_PASSWORD` is not (`seedAdminUser` only checks each individually so partial sets pass) — `auth.setup.ts` will silently fall back to the local default and attempt to log in with credentials that do not exist in the seeded DB. The login fails with a generic 401 and the storageState file is never written; the next spec ("session presence") fails with a confusing "page redirected to /login" error rather than a clear "credentials missing" message.

The credentials are also duplicated across three files (`auth.setup.ts:9-10`, `fixtures/auth.ts:22-23` (`freshLogin`), `seed.ts:8-9`). The DRY violation invites drift.

**Suggested fix:** centralize the fallback decision in a single helper, e.g. `tests/e2e/credentials.ts` exporting `getE2EAdminCredentials(env)` that enforces the CI guard once and returns `{ email, password }`. Have `seed.ts`, `auth.setup.ts`, and `fixtures/auth.ts` all import it. Add a unit test that asserts the helper throws on `CI=true` with partial env. As a less invasive alternative, inline the same CI guard in `auth.setup.ts:9-10` so behavior parity is preserved without restructuring.

## Triage

- Decision: `valid`
- Root cause: `auth.setup.ts:9-10` falls back to hardcoded local credentials unconditionally. `seed.ts` enforces a CI guard (throws if `CI=true` and env vars missing), but `auth.setup.ts` does not, defeating that guarantee for the login step.
- Fix applied: Inlined the same CI guard pattern from `seed.ts` into `auth.setup.ts`. When `CI=true` and credentials are absent, setup now throws "Missing credential: … is required on CI" with an actionable message rather than silently falling back.
- Note: `tests/e2e/fixtures/auth.ts:22-23` (`freshLogin`) has the identical DRY violation and is out of batch scope. It should be addressed in a follow-up task.
