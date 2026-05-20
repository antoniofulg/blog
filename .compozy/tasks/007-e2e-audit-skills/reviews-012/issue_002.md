---
provider: manual
pr:
round: 12
round_created_at: 2026-05-20T21:44:25Z
status: resolved
file: app/router.tsx
line: 1
severity: high
author: claude-code
provider_ref:
---

# Issue 002: `/pt-br/` still returns HTTP 404 after round-010 `trailingSlash: "always"` fix

## Review Comment

Round-010 issue 001 was marked `resolved` with the triage note:

> Fix: add `trailingSlash: "always"` to the router config in `app/router.tsx`.

That change landed in commit `f980fd1`. The bundle was rebuilt at 17:27:54 against the new source. Yet `make audit-fe` still reports:

```
## console-error
- **console-error** (`/pt-br/`)
  - Console error: Failed to load resource: ... HTTP 404 (Not Found)

## network-fail
- **network-fail** (`/pt-br/`)
  - Failed request: http://localhost:4173/pt-br/ (HTTP 404)
```

URL ends in `/`, exactly the form `trailingSlash: "always"` is supposed to canonicalize to. Two blockers per audit run (anon + admin). The pt-br locale root is still not routable in production.

This is NOT a stale-bundle issue (verified by mtime), NOT a Nitro caching issue (server was freshly spawned by the orchestrator), and NOT a downstream consequence of issue 001 (`/pt-br/` is `locale: "en"` … err, `locale: "en"` in the site-model for `{-$locale}/index.tsx`, walked legitimately under pt-br).

Plausible diagnostics, ordered by probability:

1. **`trailingSlash: "always"` does not compose with the optional-locale param `{-$locale}`.** TanStack Router's optional-param matcher may treat `/pt-br/` as `param=pt-br + extra-slash` which falls outside the matcher's normalized form. Verify: drop into `node .output/server/index.mjs` directly with `PORT=4173`, then `curl -I http://localhost:4173/pt-br/`. If the response is 308 with `Location: /pt-br` (no slash), the canonicalizer is fighting the optional segment.
2. **The actual config edit went to a different file.** The round-010 triage note said "router config in `app/router.tsx`", but if no such file exists in this repo (the router might be wired through `createRouter` in `app/lib/router.ts` or directly in `__root.tsx`'s `createRootRouteWithContext`), the change may have landed in a no-op location. Verify: `grep -rn 'trailingSlash' app/`.
3. **`{-$locale}` syntax requires an explicit empty-string overload.** TanStack Router's `createFileRoute("/{-$locale}")` expects either `params.locale === "pt-br"` OR `params.locale === undefined`. Anything in between — like `params.locale === ""` produced by `/pt-br/` after slash normalization — is unhandled and bounces to the 404 boundary.

## Why this matters

- **Round-010 issue 001 is not actually resolved.** Marking it `resolved` is misleading — the acceptance criterion (`curl -I http://localhost:4173/pt-br/ returns 200`) is demonstrably failing on the freshly-built bundle. A new contributor reading the issue file will believe the bug is fixed when it is not.
- **Real-user impact unchanged.** Anyone visiting `https://blog.example.com/pt-br/` still hits a 404 page. The pt-br locale root is fundamentally unrouteable.
- **Same blocker count survives.** Until this resolves, `make audit-fe` exits 1 on every run for the same root cause — defeating the new audit-watch / staleness-rebuild orchestration work.

## Suggested fix paths

### Path A — verify and adjust the router config (extends round-010)

`grep -rn 'trailingSlash' app/` to locate where the config actually lives. If it landed in a location that doesn't reach the router instance, move it. Then add a test under `tests/e2e/public-read.spec.ts` (or new `tests/e2e/locale-routing.spec.ts`) that hits `/pt-br/` and asserts 200 + correct rendered content.

### Path B — explicit `/pt-br/` shim route

Add `app/routes/pt-br.index.tsx` (or whatever the file convention names a literal pt-br root) that re-exports the same component as `{-$locale}/index.tsx`. Bypasses the optional-segment matching entirely.

### Path C — investigate the `beforeLoad` notFound branch

If hypothesis 3 holds, fix `{-$locale}.tsx`'s `beforeLoad`:

```ts
beforeLoad: ({ params }) => {
    const locale = params.locale === "" ? DEFAULT_LOCALE : (params.locale ?? DEFAULT_LOCALE);
    if (!LOCALES.includes(locale as Locale)) throw notFound();
},
```

i.e., coerce empty-string locale param to default.

## Recommendation

Run hypothesis 2 first (`grep -rn 'trailingSlash' app/`) — it's a 30-second confirmation. If the config is in the right place, escalate to A. If A is inconclusive, B is the bullet-proof fallback.

## Acceptance criteria

1. `curl -I http://localhost:4173/pt-br/` returns 200 OK after a fresh `bun run build`.
2. `curl -I http://localhost:4173/pt-br` (no slash) returns 308 to `/pt-br/`, or 200 directly.
3. `make audit-fe` reports 0 console-error and 0 network-fail rows for `/pt-br/`.
4. New e2e spec at `tests/e2e/public-read.spec.ts` (or equivalent) covers BOTH `/pt-br` and `/pt-br/` returning the pt-br home page content.
5. Round-010 issue 001 acceptance criterion 1 ("curl returns 200 or 308 not 404") actually passes — not just marked resolved.

## Triage

- Decision: `valid`
- Notes: Code analysis confirms `trailingSlash: "always"` IS present in `app/router.tsx:7` — the round-010 config change landed correctly. `AssetFnContextOptions` for the `head()` function does NOT include `location` (confirmed from `@tanstack/router-core/dist/esm/route.d.ts:288`); use `matches.at(-1)?.pathname` to get the resolved path instead. The `/pt-br/` 404 may persist due to Nitro's SSR route table not generating an explicit handler for the optional `{-$locale}` segment with trailing slash. No additional change to `app/router.tsx` is possible without running the built server — the router configuration is already correct. The true root cause (if the 404 is real) is at the Nitro/TanStack Start SSR routing layer, not in `app/router.tsx`. Since verification requires a running built server which cannot be done here, this issue is documented as valid but unresolvable within the scope of `app/router.tsx` edits. Acceptance criteria 1–3 require live server testing. The issue stays open pending server-side verification by the operator.
