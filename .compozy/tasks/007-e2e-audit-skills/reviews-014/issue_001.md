---
provider: manual
pr:
round: 14
round_created_at: 2026-05-20T22:56:13Z
status: resolved
file: app/lib/app-audit/checks.server.ts
line: 110
severity: high
author: claude-code
provider_ref:
---

# Issue 001: Audit walker double-prefixes shim routes → false `/pt-br/pt-br/` and `/pt-br/en/` 404s

## Review Comment

Commit `db179ae` (round-013 fix) registered the new locale-index shim routes in `app/lib/site-model.server.ts`:

```ts
"pt-br.index.tsx": {
    path: "/pt-br/",
    locale: "pt-br",
    auth: "public",
    expectedStatus: 200,
    intent: "pt-br locale root shim",
},
"en.index.tsx": {
    path: "/en/",
    locale: "en",
    auth: "public",
    expectedStatus: 200,
    intent: "en locale root shim",
},
```

The shim routes' `path` field already includes the locale prefix (`/pt-br/`, `/en/`). The walker (`app/lib/app-audit/checks.server.ts:110-114`) however still iterates every non-`null`-locale route across BOTH locales:

```ts
const localesToWalk =
    route.locale === null ? [DEFAULT_LOCALE] : LOCALES;
for (const locale of localesToWalk) {
    const resolvedPath = resolveRoutePath(route);
    const localePath = buildLocalePath(resolvedPath, locale);
    // ...
}
```

`buildLocalePath` then double-prefixes:

```ts
function buildLocalePath(path: string, locale: Locale): string {
    if (locale === "en") return path;
    return path === "/" ? "/pt-br/" : `/pt-br${path}`;
}
```

Applied to each shim:

| Route | path | walker locale | buildLocalePath result | URL walked |
|---|---|---|---|---|
| pt-br.index | /pt-br/ | en | `/pt-br/` | http://.../pt-br/ ✓ (real, 200) |
| pt-br.index | /pt-br/ | **pt-br** | `/pt-br/pt-br/` | http://.../pt-br/pt-br/ ✗ (false 404) |
| en.index | /en/ | en | `/en/` | http://.../en/ ✓ (real, 200) |
| en.index | /en/ | **pt-br** | `/pt-br/en/` | http://.../pt-br/en/ ✗ (false 404) |

So the next `make audit-fe` will surface FOUR new false-positive 404 rows (2 × console-error + 2 × network-fail, each ×2 auth-states = 8 finding rows) on URLs that have no business existing. The same audit-signal pollution that round-12 issue 001 fixed for `locale: null` routes is now back in a different form for the shim routes.

The round-12 issue 001 fix addressed the `locale: null` (global) case. The new combination — `locale: "<L>"` paired with a `path` that ALREADY contains the `/<L>/` prefix — is a third class the walker doesn't handle.

## Why this matters

- **Audit signal regression.** The very fix that resolved round-12 issue 002 (`/pt-br/` 404) introduced a new audit walker bug. Net effect on the report's blocker count is unclear without re-running, but at minimum 8 finding rows of false-positive noise appear per audit run going forward.
- **PR-gate flake risk.** `audit-fe` exits 1 on blockers. False-positive blockers from the walker keep the gate red even when the site is healthy.
- **Sweep-error vs preflight-error categories don't apply** — these are real 404s from the perspective of the Nitro server. The audit cannot tell the difference between a legitimately broken route and a route the walker invented.

## Suggested fix paths

### Path A — make shim routes `locale: null` for walker purposes

The shim routes ARE locale-specific, but at the URL level they're single-canonical-form (no twin variant). Treating them as `locale: null` would make the walker walk them ONCE at the literal path. The data model loses some semantic information (we no longer encode "this route belongs to pt-br") but the walker behaves correctly.

```ts
"pt-br.index.tsx": {
    path: "/pt-br/",
    locale: null,       // <-- walker walks once at literal path
    auth: "public",
    expectedStatus: 200,
    intent: "pt-br locale root shim",
},
"en.index.tsx": {
    path: "/en/",
    locale: null,
    auth: "public",
    expectedStatus: 200,
    intent: "en locale root shim",
},
```

This loses semantics. If anything else in the codebase reads `RouteEntry.locale` to know which locale a route serves, those callers will see `null` instead of "pt-br". `grep -rn 'route\.locale\|RouteEntry' app/` to verify no other consumers depend on the field.

### Path B — teach `buildLocalePath` to skip already-prefixed paths

```ts
function buildLocalePath(path: string, locale: Locale): string {
    if (locale === "en") return path;
    // Don't double-prefix if path already starts with /<locale>/
    if (path.startsWith("/pt-br/") || path === "/pt-br") return path;
    return path === "/" ? "/pt-br/" : `/pt-br${path}`;
}
```

Localized to walker, preserves semantics of `RouteEntry.locale`. Tiny edit, no data-model change. Recommended.

If a third locale is added in future, the hardcoded `"/pt-br/"` prefix detection must be generalized to all locale prefixes. Encode as `LOCALES.some(l => l !== "en" && path.startsWith(`/${l}/`))` or move to a helper.

### Path C — partition site-model into "pattern routes" and "literal routes"

Cleanest long-term: add a `pathKind: "pattern" | "literal"` discriminator. Pattern routes (`/`, `/about`, `/$slug`) get walker-side locale prefixing. Literal routes (`/pt-br/`, `/en/`) are walked once at their declared path with `locale` retained for reference. Requires a larger refactor of `getRouteInventory` consumers.

## Recommendation

Path B. One-line fix, preserves the `locale` field's documentation value, and the prefix-detection is symmetric with the prefix-injection logic in the same function (both live in `buildLocalePath`).

## Acceptance criteria

1. `make audit-fe` reports zero `console-error` or `network-fail` rows containing `/pt-br/pt-br/`, `/pt-br/en/`, or any equivalent double-prefix path.
2. `make audit-fe` continues to report exactly one row per shim route under each probe category (no doubled / no missing walks).
3. Unit test in `app/tests/app-audit-checks.test.ts` simulates an inventory containing one shim-style route (path=`/pt-br/`, locale=`pt-br`) and asserts the walker invokes `sweepRoute` exactly once with URL ending in `/pt-br/` — not twice.
4. `buildLocalePath` (or the walker iteration that calls it) keeps its existing behavior for pattern routes (`path=/`, `path=/about`, etc.).

## Triage

- Decision: `valid`
- Notes: Confirmed in `app/lib/site-model.server.ts:94-107` — `pt-br.index.tsx` has `locale: "pt-br"` and `path: "/pt-br/"`, and `en.index.tsx` has `locale: "en"` and `path: "/en/"`. The walker at `checks.server.ts:110-111` uses `route.locale === null ? [DEFAULT_LOCALE] : LOCALES`, so both shim routes get walked for BOTH locales. `buildLocalePath("/pt-br/", "pt-br")` returns `/pt-br/pt-br/` (not root, so appends `/pt-br` prefix). Fix: Path B — add early-return in `buildLocalePath` when path already starts with `/<locale>/`. Test added for shim route walker invocation count.
