# Security Findings Report — TASK-0004

**Audit date:** 2026-05-06
**Codebase state:** post-refactor (tasks 01–04 complete)
**Remediation vehicle:** dedicated future security task (out of V1 scope per ADR-001)

---

## Summary

| ID | Severity | File | Line |
|---|---|---|---|
| SEC-001 | High | `app/lib/auth.ts` | — |
| SEC-002 | Medium | `app/routes/login.tsx` | 46 |
| SEC-003 | High | `app/db/client.ts` | 7 |
| SEC-004 | Medium | `app/routes/admin/index.server.ts` | 39 |
| SEC-005 | Low | `app/routes/api/auth/$.ts` | — |

---

## SEC-001 — No rate limiting on auth endpoints

**Severity:** High
**File:** `app/lib/auth.ts`
**Line:** N/A (entire config)

**Risk:**
Better Auth exposes `/api/auth/sign-in` and related endpoints without any rate limiting. An attacker can issue unlimited login attempts against the endpoint, enabling brute-force and credential-stuffing attacks with no server-side throttle.

**Current code:**
```typescript
export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: { enabled: true },
  plugins: [reactStartCookies()], // MUST be last plugin (ADR-001)
});
```

**Recommended remediation:**
Add the `rateLimit` plugin to the Better Auth config. Replace the default in-memory store with a persistent store (e.g., Redis or the Drizzle adapter) before high-traffic deployment to avoid limits resetting on restart.

---

## SEC-002 — Error message exposes auth failure detail

**Severity:** Medium
**File:** `app/routes/login.tsx`
**Line:** 46

**Risk:**
`result.error.message` from the Better Auth client is rendered directly in the UI. Distinct error messages for "user not found" vs. "wrong password" allow an attacker to enumerate valid email addresses registered in the system.

**Current code:**
```typescript
setError(result.error.message ?? "Login failed");
```

**Recommended remediation:**
Discard the provider-supplied message and always display a generic string regardless of error type:
```typescript
setError("Invalid email or password");
```

---

## SEC-003 — Hardcoded database credentials as fallback

**Severity:** High
**File:** `app/db/client.ts`
**Line:** 7

**Risk:**
`DATABASE_URL` is accessed with a `??` fallback that contains a working connection string with default credentials (`postgres://blog:blog@localhost:5432/blog`). If the environment variable is absent — misconfigured container, CI without secrets, developer machine — the application silently connects to whichever database responds on those credentials instead of failing fast. This can result in data exposure or unintended writes.

**Current code:**
```typescript
const client = postgres(
  process.env.DATABASE_URL ?? "postgres://blog:blog@localhost:5432/blog",
);
```

**Recommended remediation:**
Remove the fallback entirely. Throw a descriptive error at startup when `DATABASE_URL` is absent. Consider adding a lightweight env validation module (e.g., `zod`-based) that validates all required env vars at boot.

---

## SEC-004 — No bounds validation on `id` in togglePublished input

**Severity:** Medium
**File:** `app/routes/admin/index.server.ts`
**Line:** 39

**Note:** Pre-refactor this code lived in `app/routes/admin/index.tsx:47`. After task_04 extracted server functions, the `inputValidator` moved to `index.server.ts:39`.

**Risk:**
The `inputValidator` for `togglePublished` passes input through without checking that `id` is a positive integer. A negative value, zero, or a non-integer float is accepted and forwarded to the Drizzle `WHERE` clause, which may produce unexpected query behaviour or allow an actor to probe row existence patterns.

**Current code:**
```typescript
export const togglePublished = createServerFn({ method: "POST" })
  .inputValidator((input: { id: number; isPublished: boolean }) => input)
  .handler(async ({ data }) => {
    await requireSession();
    return togglePublishedFn(data.id, data.isPublished);
  });
```

**Recommended remediation:**
Validate that `id` is a positive integer before accepting the input. Use Zod or an inline guard:
```typescript
.inputValidator((input: { id: number; isPublished: boolean }) => {
  if (!Number.isInteger(input.id) || input.id < 1) {
    throw new Error("id must be a positive integer");
  }
  return input;
})
```

---

## SEC-005 — No request body size limit on auth handler

**Severity:** Low
**File:** `app/routes/api/auth/$.ts`
**Line:** N/A (entire handler)

**Risk:**
The GET and POST handlers for `/api/auth/$` pass the raw `Request` directly to `auth.handler` without enforcing a body size limit. A client can send an arbitrarily large body, consuming memory and CPU during JSON parsing. At low traffic this is negligible; under targeted load it becomes a DoS vector.

**Current code:**
```typescript
POST: async ({ request }: { request: Request }) => {
  return auth.handler(request);
},
```

**Recommended remediation:**
Add a body size limit via Nitro config (e.g., `nitro.bodySize` in `vite.config.ts`) or implement a lightweight middleware that rejects requests exceeding a defined threshold (e.g., 64 KB) before passing to `auth.handler`.

---

## Remediation plan

All five findings are scoped to a dedicated future security task, per [ADR-001](adrs/adr-001.md). This report is the boundary artifact between the code-organisation phase and the security-hardening phase.

Recommended priority order for the fix task:
1. SEC-003 (High) — immediate fail-fast on missing env; zero false negatives possible
2. SEC-001 (High) — rate limiting; requires persistent store decision
3. SEC-002 (Medium) — one-line fix; low risk of regression
4. SEC-004 (Medium) — input validation; low risk of regression
5. SEC-005 (Low) — body size limit; depends on Nitro config approach
