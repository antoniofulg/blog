---
provider: manual
pr:
round: 12
round_created_at: 2026-05-20T21:44:25Z
status: resolved
file: app/lib/site-model.server.ts
line: 64
severity: medium
author: claude-code
provider_ref:
---

# Issue 003: E2E fixture slug `e2e-public-fixture` leaks into production audit route inventory

## Review Comment

`make audit` against the dev / prod DB walks `/e2e-public-fixture/` and reports a 404 (4 finding rows: 2 console-error + 2 network-fail):

```
- **console-error** (`/e2e-public-fixture`)
  - Console error: Failed to load resource: HTTP 404

- **network-fail** (`/e2e-public-fixture`)
  - Failed request: http://localhost:4173/e2e-public-fixture/ (HTTP 404)
```

Root cause: `app/lib/site-model.server.ts:64`:

```ts
"{-$locale}/$slug.tsx": {
    path: "/:slug",
    locale: "en",
    auth: "public",
    expectedStatus: 200,
    intent: "post detail",
    sampleSlug: "e2e-public-fixture",     // <-- e2e fixture slug
},
```

`e2e-public-fixture` is the slug seeded by `tests/e2e/seed.ts` during Playwright's `global-setup`. It does NOT exist in the dev or production Postgres database. When `make audit` (which runs against the dev DB by default) resolves the `{-$locale}/$slug` route with this sampleSlug, the Nitro app legitimately returns 404 — there is no post with that slug.

The leak generalizes: any `sampleSlug` in `site-model.server.ts` that references e2e-only content will produce false 404 blockers when the audit runs outside the e2e harness.

## Why this matters

- **4 false blockers per audit run** (counts toward the inflated 12-blocker total — see also issue 001).
- **Cross-environment contamination.** Test fixtures should never appear in production-shaped artifacts. The audit's route inventory is shipped as a reference for what the live site looks like; embedding an e2e slug in it is a category error.
- **Brittle.** The fixture slug literal is also referenced from `tests/e2e/seed.ts`, `tests/e2e/fixtures/e2e-fixture-post.mdx`, and probably the Playwright specs. Renaming the fixture would require touching 4+ files; today the audit silently breaks instead of failing fast at a rename.
- **Audit-correctness regression risk.** If a future contributor "fixes" the 404 by seeding the fixture into the dev DB, that's actually worse — production data now leaks an e2e artifact too.

## Suggested fix paths

### Path A — pull `sampleSlug` from the live DB at audit time (recommended)

Make `getRouteInventory()` async-fetch the most-recent published post slug at runtime and substitute into routes whose path contains `:slug`:

```ts
export async function getRouteInventory(): Promise<RouteEntry[]> {
    const liveSlug = await getLatestPublishedSlug(); // SELECT slug FROM posts WHERE is_published ORDER BY published_at DESC LIMIT 1
    return Object.entries(ROUTE_METADATA)
        .filter(([, meta]) => meta.expectedStatus !== null)
        .map(([, meta]) => ({
            path: meta.path,
            locale: meta.locale,
            auth: meta.auth,
            expectedStatus: meta.expectedStatus as 200 | 302 | 401 | 404,
            intent: meta.intent,
            // Replace `sampleSlug` with the live slug when present.
            ...(meta.sampleSlug !== undefined
                ? { sampleSlug: meta.path.includes(":slug") ? liveSlug : meta.sampleSlug }
                : {}),
        }));
}
```

Edge case: if the DB has no published posts, return the route inventory WITHOUT the `:slug` route (or mark its `expectedStatus` as `null` for that run). Tracked in a new test fixture.

### Path B — env-driven sampleSlug override

Add `AUDIT_SAMPLE_SLUG` env var. The static `ROUTE_METADATA` keeps the e2e fixture as the default for harness runs (`tests/e2e/seed.ts` exports the slug; the spec environment sets the env var to the same value). Dev / prod operators override at the shell:

```bash
AUDIT_SAMPLE_SLUG=my-real-post make audit-fe
```

Lower effort, but pushes a manual step onto every operator. Reasonable as a stop-gap.

### Path C — split metadata: static vs runtime-resolved

Cleanest long-term: `ROUTE_METADATA` only declares the route shape; `sampleSlug` is resolved by an environment-specific provider (`tests/e2e/audit-bridge.ts` for e2e, `app/lib/audit-content-resolver.server.ts` for live). Avoids the e2e/prod literal duality entirely.

## Recommendation

Path A first. It's a single function change + one new DB query helper, and removes the env-coupling problem for good. Path B is a 5-minute fallback if A is somehow blocked.

## Acceptance criteria

1. `make audit-fe` against a dev DB containing real posts walks `/$slug` with one of the live published slugs and gets a 200.
2. If the dev DB has zero published posts, the audit either skips the `:slug` route entirely OR walks it once with a known-empty-state expectation; no false blocker.
3. The `e2e-public-fixture` literal appears in test code (`tests/e2e/seed.ts` etc.) only — `grep -rn 'e2e-public-fixture' app/` returns zero hits.
4. Playwright e2e specs still seed and walk the fixture correctly (the e2e suite must pass post-change).

## Triage

- Decision: `valid`
- Notes: Root cause confirmed at `site-model.server.ts:64`. `sampleSlug: "e2e-public-fixture"` (public post route) and `sampleSlug: "e2e-fixture-post"` (admin preview route) are e2e-only slugs that don't exist in dev/prod DB, causing false 404 blockers. Path A implemented: `getRouteInventory()` now calls `getLatestPublishedSlug()` which queries the live DB for the most recent published post slug. Both slug routes (public + admin) use this live slug. When DB has no published posts, slug routes are excluded from inventory (flatMap returns `[]`). Static `sampleSlug` fields removed from both ROUTE_METADATA entries — `e2e-public-fixture` and `e2e-fixture-post` literals no longer appear in `app/`. `desc` and `eq` imported from `drizzle-orm`. DB mock in `site-model.test.ts` updated to support chaining (`.where().orderBy().limit()`) via thenable chain helper `makeDbChain(rows)`. Acceptance criterion 3 (grep -rn e2e-public-fixture app/ returns zero hits) satisfied. The diagnostic gap for a11y node selectors (acceptance criterion 4 for issue 005) is deferred — `a11y-adapter.server.ts` is outside batch scope.
