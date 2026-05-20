---
provider: manual
pr:
round: 7
round_created_at: 2026-05-20T04:43:24Z
status: resolved
file: app/lib/site-model.server.ts
line: 1
severity: high
author: claude-code
provider_ref:
---

# Issue 004: Parameterized routes (`:slug`) iterated literally — every `page.goto` rejects

## Review Comment

The first real `make audit` execution (`docs/_reports/app-audit-2026-05-20.md`) shows `sweep-error` findings against literal parameterized URLs:

```
goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/:slug
goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/pt-br/:slug
goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/admin/preview/:slug
goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/pt-br/admin/preview/:slug
```

`getRouteInventory()` from `app/lib/site-model.server.ts` returns `RouteEntry` values with `path` as the TanStack Router pattern (e.g., `"/:slug"`, `"/admin/preview/:slug"`). The app-audit orchestrator iterates these directly via `page.goto(fullUrl)` without resolving the `:slug` placeholder to a real slug. Browsers treat `:slug` as literal path text → 404 (or connection refused, in this run's case where the server wasn't up).

Even with a running preview server, these routes would 404 → `network-fail` blocker finding per parameterized route. The audit cannot meaningfully test slug-based routes today.

PRD-007 and ADR-005 specify "28 inspections (routes × locales × auth-state)" as the V1 coverage matrix. The current orchestrator counts parameterized routes toward that 28 but the inspections always fail, deflating the actionable coverage to ~16 inspections (the static routes: `/`, `/about`, `/admin`, `/login`, ×2 locales ×2 auth-states).

**Suggested fix** — extend `RouteEntry` shape with sample slug data, OR resolve at audit time:

### Option A: Static `sampleSlug` field on RouteEntry

Add `sampleSlug?: string` to `RouteEntry` in `app/lib/site-model.server.ts`. For each parameterized route, the static metadata map provides a real slug from seeded fixture posts:

```ts
{
  path: "/:slug",
  sampleSlug: "e2e-public-fixture",  // matches FIXTURE_PUBLIC_SLUG from tests/e2e/seed.ts
  // ...
},
{
  path: "/admin/preview/:slug",
  sampleSlug: "e2e-fixture-post",    // matches FIXTURE_POST_SLUG
  // ...
}
```

The orchestrator expands `:slug` → `sampleSlug` before `page.goto`. ADR-005 deliberately said "RouteEntry shape stays unchanged" — adding this field is a controlled extension; document in ADR-007 (new ADR for this round's fix).

### Option B: Resolve at audit time from indexed posts

Orchestrator queries the `posts` DB table for one published slug per locale + uses it to substitute `:slug`. Couples app-audit to DB state; works only when audit runs against a PGLite-seeded test DB (current setup).

### Option C: Skip parameterized routes entirely

Filter `getRouteInventory()` to routes without `:` in the path. Audit only static routes. Documented as a known gap; revisit if dynamic-route coverage matters.

**Recommend Option A** — explicit, documented, and decouples app-audit from DB state. Add Vitest test asserting `:slug` routes expand to real URLs before `page.goto`.

## Triage

- Decision: `valid`
- Root cause: `getRouteInventory()` returns raw TanStack Router patterns (`/:slug`, `/admin/preview/:slug`). Orchestrator passes them to `page.goto` without substituting `:slug` with a real slug → 404/connection refused on every parameterized route.
- Fix: add `sampleSlug?: string` to `RouteEntry` type; populate for parameterized routes using fixture slugs (`e2e-public-fixture` for `/:slug`, `e2e-fixture-post` for `/admin/preview/:slug`); expand in orchestrator before `page.goto`.
