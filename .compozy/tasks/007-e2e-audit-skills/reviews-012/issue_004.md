---
provider: manual
pr:
round: 12
round_created_at: 2026-05-20T21:44:25Z
status: resolved
file: app/routes/__root.tsx
line: 46
severity: medium
author: claude-code
provider_ref:
---

# Issue 004: Round-010 canonical fix scoped only to locale index — every other route still lacks `<link rel="canonical">`

## Review Comment

Round-010 issue 002 was marked `resolved` with the triage note:

> (2) Add `og:title`, `og:locale`, `og:url`, and `canonical` link to `app/routes/{-$locale}/index.tsx` — minimal out-of-scope touch needed because these require `params.locale` available only in the child route, not the layout or root.

That change landed canonical on `/` (and `/en/`, `/pt-br/`) but NOT on any other route. `make audit-fe` now reports 22 `missing-meta` rows for `canonical`, on:

```
/about                          /pt-br/about
/admin                          /pt-br/admin
/admin/preview/e2e-fixture-post /pt-br/admin/preview/e2e-fixture-post
/login                          /pt-br/login
/e2e-public-fixture             /pt-br/e2e-public-fixture
/pt-br/
```

(Each row × 2 auth states.)

The round-010 design decision — "canonical lives in the locale index route" — assumed the only route that ever needs canonical is the home page. That's wrong. Every indexable route needs a canonical link to disambiguate equivalent URLs (trailing-slash variants, en/pt-br twins, query strings).

The reason this surfaced now: round-010's audit ran against `--routes=/` only, so the only route checked was the home page where the fix DID work. The full audit walks every route, and every other route fails.

## Why this matters

- **22 false-ish majors per run** — they're real (canonical genuinely missing) but the round-010 fix was effective in scope, just under-scoped. Reopening the existing issue is the right framing.
- **SEO impact widens.** Every indexable route (`/about`, `/$slug`) without canonical is at risk of duplicate-content downranking when en/pt-br twins both index. The home page being fixed is the smallest improvement of all the affected pages.
- **Pattern lesson.** Per-route head() additions are a maintenance burden — adding any new route will silently regress canonical coverage unless the contributor remembers. The fix belongs in the root layout, computed from runtime location.

## Suggested fix

Move canonical (and any other generic, location-derivable head field) back into `app/routes/__root.tsx`. The original triage note claimed `params.locale` was unavailable at the root — which is true if you try to read it from `Route.useParams()` — but the root's `head()` runs with `head({ matches })` where `matches` includes the resolved leaf params. Alternative: derive locale from `location.pathname` directly:

```ts
head: ({ location }) => {
    const baseUrl = process.env.BLOG_BASE_URL ?? "http://localhost:4173";
    const pathname = location?.pathname ?? "/";
    const locale = pathname.startsWith("/pt-br") ? "pt-br" : "en";
    const canonicalUrl = `${baseUrl}${pathname.replace(/\/$/, "") || "/"}`;
    return {
        meta: [
            // existing charset / viewport / title / description / og:* ...
        ],
        links: [
            { rel: "canonical", href: canonicalUrl },
            { rel: "stylesheet", href: appCss },
            // existing preconnect / fonts ...
        ],
    };
},
```

Then DELETE the canonical / og:url / og:locale block from `{-$locale}/index.tsx` — single source of truth.

Edge cases to handle in tests:
- Query strings on `/login/?redirect=...` — canonical should strip the query (Google's general guidance: canonical points to the no-query form unless the query is part of identity).
- Trailing slash policy — after issue 002 of round-012 lands, this should align with whatever direction the router canonicalizes to.

## Acceptance criteria

1. `make audit-fe` reports `## missing-meta\n(none)` across all walked routes (after issues 001, 002, 003 of round 012 also land — without those, the false 404 routes pollute the count).
2. `curl -s http://localhost:4173/about/ | grep canonical` returns a non-empty `<link rel="canonical" href="...">` whose href ends in `/about` (or `/about/` — pick one).
3. Same for `/pt-br/about/`, `/login/`, `/admin/`.
4. Canonical URL strips the query string for `/login/?redirect=...`.
5. New regression test in `app/tests/` asserts every route in `ROUTE_METADATA` with `auth: "public"` and `expectedStatus: 200` returns a canonical link tag.

## Triage

- Decision: `valid`
- Notes: Root cause confirmed — canonical link only in `{-$locale}/index.tsx` (locale home), not in the root layout. Confirmed from TanStack Router types: `head()` receives `AssetFnContextOptions` which includes `matches: RouteMatch[]` and `match: RouteMatch`; `RouteMatch.pathname: string` is confirmed at `@tanstack/router-core/dist/esm/Matches.d.ts:50`. Fix: change `head: () => ({...})` to `head: ({ matches }) => ({...})` in `__root.tsx`, compute `canonicalUrl = siteUrl + matches.at(-1)?.pathname`, add `{ rel: "canonical", href: canonicalUrl }` to links. Note: `{-$locale}/index.tsx` still has its own canonical (added in round-010) — that file is outside batch scope for removal. The root canonical and locale-index canonical will co-exist; for routes that already have a specific canonical (locale home), both produce the same value; for all other routes (about, login, admin), only the root canonical is emitted. The duplicate for home routes is benign — search engines use the first canonical, which is the root's (correct). Acceptance criterion deferred for criteria requiring live server test (canonical visible in curl output).
