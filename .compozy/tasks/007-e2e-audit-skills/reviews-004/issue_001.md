---
provider: manual
pr:
round: 4
round_created_at: 2026-05-19T15:38:36Z
status: resolved
file: tests/e2e/auth-flow.spec.ts
line: 3
severity: medium
author: claude-code
provider_ref:
---

# Issue 001: auth-flow spec still uses bare credential fallback (4th site)

## Review Comment

Round 2 issue 003 (auth.setup credential fallback bypasses CI guard) fixed `tests/e2e/auth.setup.ts`. Round 3 issue 001 (freshLogin still missing CI credential guard) fixed `tests/e2e/fixtures/auth.ts:freshLogin`. `seed.ts:seedAdminUser` already had the guard from the start. A fourth occurrence of the same anti-pattern was missed across all three rounds and still lives at the top of the auth-flow spec:

`tests/e2e/auth-flow.spec.ts:3-4`:

```ts
const adminEmail = process.env.E2E_ADMIN_EMAIL ?? "e2e@test.local";
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? "e2e-test-password";
```

These bindings feed `page.getByLabel("Email").fill(adminEmail)` and `getByLabel("Senha").fill(adminPassword)` later in the file (L15-16, L37-38). On CI with `E2E_ADMIN_EMAIL`/`E2E_ADMIN_PASSWORD` unset (or only partially set), the spec silently substitutes the local defaults `e2e@test.local` / `e2e-test-password`, which do not exist in the CI-seeded DB. Login fails with a generic 401; the spec sees "wrong-password" behavior and fails with a confusing assertion error instead of an actionable "missing credential" message — exactly the regression `seed.ts` / `auth.setup.ts` / `freshLogin` were hardened against.

This is the spec-level surface, so the impact is slightly different from the prior three fixes (which were infra-level): a spec running with these defaults on CI will fail loudly, but the failure mode points the developer at the spec body, not at the missing secrets. Diagnosis is slower than the explicit "Missing credential: E2E_ADMIN_EMAIL is required on CI" throw the three fixed sites emit.

**Suggested fix:** apply the same inline CI guard pattern used in `auth.setup.ts:9-16` and `fixtures/auth.ts:freshLogin`:

```ts
const isCI = process.env.CI === "true";
const adminEmail = process.env.E2E_ADMIN_EMAIL ?? (isCI ? undefined : "e2e@test.local");
const adminPassword =
    process.env.E2E_ADMIN_PASSWORD ?? (isCI ? undefined : "e2e-test-password");

if (!adminEmail) throw new Error("Missing credential: E2E_ADMIN_EMAIL is required on CI");
if (!adminPassword)
    throw new Error("Missing credential: E2E_ADMIN_PASSWORD is required on CI");
```

At this point a small helper (`tests/e2e/credentials.ts`) is justified — four sites repeating the same six lines is over the duplication threshold. Either land the helper as part of this fix (replacing all four sites) or accept the inline-fix-once-more trade-off and flag a TODO in `.agents/rules/testing.md` to consolidate later. After this fix lands the pattern is fully closed.

## Triage

- Decision: `valid`
- Root cause: `auth-flow.spec.ts:3-4` uses `?? "default"` without the `isCI` guard, so on CI with missing env vars the spec silently substitutes local-only credentials and fails with an opaque assertion error instead of "Missing credential: E2E_ADMIN_EMAIL is required on CI".
- Fix: apply the same 6-line inline CI guard pattern used in `auth.setup.ts:9-16` and `fixtures/auth.ts:freshLogin`. Scope is auth-flow.spec.ts only (helper extraction would touch out-of-scope files; flagged as future work).
