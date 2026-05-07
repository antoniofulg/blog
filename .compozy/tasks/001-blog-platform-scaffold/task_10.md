---
status: completed
title: Better Auth Integration
type: backend
complexity: medium
dependencies:
  - task_03
  - task_04
---

# Task 10: Better Auth Integration

## Overview

Wire up Better Auth for admin session management: create the `auth` instance with the Drizzle adapter and email/password provider, add the catch-all API route handler, and update the root route's `beforeLoad` to load session state into the router context. The `tanstackStartCookies` plugin must be the last plugin registered (ADR-001). This task creates the authentication foundation that the admin routes (task_11) depend on.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST create `app/lib/auth.ts` with the Better Auth instance configured with the Drizzle adapter, email/password enabled, and `tanstackStartCookies` as the last plugin
- MUST create `app/routes/api/auth/$.ts` as the catch-all handler forwarding `GET` and `POST` requests to `auth.handler(request)`
- MUST update `app/routes/__root.tsx` `beforeLoad` to call `auth.api.getSession({ headers: getRequestHeaders() })` and return `{ auth: { user } }` in the router context
- MUST run Better Auth's schema migration to create `user`, `session`, and `account` tables (or use the Drizzle adapter's auto-schema)
- MUST register `app/lib/auth.ts` in `vite-env-only` to prevent the Better Auth server instance from bundling on the client
- MUST ensure session cookies are HttpOnly — never expose session tokens to client-side JavaScript
- SHOULD export an `authClient` created with `createAuthClient()` for use in client-side login forms
</requirements>

## Subtasks

- [x] 10.1 Install `better-auth` package
- [x] 10.2 Create `app/lib/auth.ts` with `betterAuth({ database, emailAndPassword, plugins: [reactStartCookies()] })`
- [x] 10.3 Create `app/routes/api/auth/$.ts` catch-all handler with `GET` and `POST` handlers
- [x] 10.4 Update `app/routes/__root.tsx` `beforeLoad` to load session via `getRequest()` + `auth.api.getSession()`
- [x] 10.5 Run Better Auth migrations (or verify Drizzle adapter creates tables) and confirm `user`, `session`, `account` tables exist
- [x] 10.6 Register `app/lib/auth.ts` in `vite-env-only` in `vite.config.ts`

## Implementation Details

See TechSpec "Integration Points" (Better Auth) for the full `auth` configuration snippet and the `__root.tsx` session-loading pattern. See TechSpec "API Endpoints" for the `/api/auth/*` handler specification. Critical: `tanstackStartCookies()` MUST be the last element in the `plugins` array — placing it earlier silently breaks cookie handling.

### Relevant Files

- `app/lib/auth.ts` — new file; Better Auth instance and `authClient` export
- `app/routes/api/auth/$.ts` — new file; catch-all GET/POST handler
- `app/routes/__root.tsx` (task_01) — modified; add `beforeLoad` session loading
- `app.config.ts` (task_01) — modified; add `auth.ts` to `vite-env-only`
- `app/db/client.ts` (task_03) — `db` passed to Drizzle adapter
- `app/db/schema.ts` (task_03) — Better Auth adapter may need to reference existing schema

### Dependent Files

- `app/routes/admin/index.tsx` (task_11) — checks `context.auth.user` in `beforeLoad`
- `app/routes/admin/preview.$slug.tsx` (task_11) — same auth guard pattern

### Related ADRs

- [ADR-001: Scaffold Scope — Full Starter Kit](adrs/adr-001.md) — `tanstackStartCookies` must be last plugin; auth handler at `app/routes/api/auth/$.ts`

## Deliverables

- `app/lib/auth.ts` — Better Auth instance (server-only)
- `app/routes/api/auth/$.ts` — API catch-all handler
- Updated `app/routes/__root.tsx` with session loading
- `user`, `session`, `account` tables in Postgres
- Unit tests with 80%+ coverage **(REQUIRED)**
- Integration tests for auth round trip **(REQUIRED)**

## Tests

- Unit tests:
  - [x] `auth` instance has `emailAndPassword` enabled
  - [x] `reactStartCookies` is the last element in the `plugins` array
  - [x] `app/routes/api/auth/$.ts` exports both `GET` and `POST` handler functions
  - [x] `app/lib/auth.ts` is not present in the client JavaScript bundle
- Integration tests:
  - [x] `POST /api/auth/sign-in` with seeded `ADMIN_EMAIL` / `ADMIN_PASSWORD` returns 200 and a `Set-Cookie` header
  - [x] `GET /api/auth/get-session` with the session cookie returns the user object
  - [x] `GET /api/auth/get-session` without a cookie returns `null` user
  - [x] `POST /api/auth/sign-out` invalidates the session; subsequent `get-session` returns `null`
  - [x] `__root.tsx` `beforeLoad` returns `{ auth: { user: null } }` for unauthenticated requests
  - [x] `__root.tsx` `beforeLoad` returns `{ auth: { user: { email } } }` for authenticated requests
- Test coverage target: >=80%
- All tests must pass

## Success Criteria

- All tests passing
- Test coverage >=80%
- Login flow works end-to-end: `POST /api/auth/sign-in` → session cookie → `GET /admin` returns 200
- `auth.ts` server instance is absent from the client bundle
