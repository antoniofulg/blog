---
provider: manual
pr:
round: 12
round_created_at: 2026-05-20T21:44:25Z
status: resolved
file: app/lib/app-audit/checks.server.ts
line: 110
severity: high
author: claude-code
provider_ref:
---

# Issue 001: Audit walker prefixes pt-br locale onto global routes — 8 false-positive 404s per run

## Review Comment

`make audit` reports 24 console-error + network-fail rows on URLs that should never have been walked. Of those, the following are entirely the audit walker's fault — not site bugs:

```
/pt-br/admin                            → HTTP 404
/pt-br/admin/preview/e2e-fixture-post   → HTTP 404
/pt-br/login                            → HTTP 404
```

(Each row appears twice — once for anon auth state, once for admin — so it counts as 4 console-errors + 4 network-fails = **8 false blockers**.)

These routes are declared `locale: null` in `app/lib/site-model.server.ts`:

```ts
"admin/index.tsx":         { path: "/admin",                    locale: null, ... },
"admin/preview.$slug.tsx": { path: "/admin/preview/:slug",       locale: null, ... },
"login.tsx":               { path: "/login",                    locale: null, ... },
```

`locale: null` is the site-model's way of saying "this route exists at a single canonical path; it is not locale-scoped." Admin and login routes do not live under `/pt-br/` — only blog content (`{-$locale}/index`, `{-$locale}/about`, `{-$locale}/$slug`) does.

But the audit walker (`app/lib/app-audit/checks.server.ts:110-114`) loops every route through every locale unconditionally:

```ts
for (const route of routes) {
    for (const locale of LOCALES) {   // <-- ignores route.locale === null
        const resolvedPath = resolveRoutePath(route);
        const localePath = buildLocalePath(resolvedPath, locale);
        // ...sweep, axe, lighthouse...
    }
}
```

`buildLocalePath("/admin", "pt-br")` returns `/pt-br/admin` — a path that has no matching route in the router, so the Nitro server correctly returns 404. The audit records that 404 as a console-error + network-fail blocker, inflating the report by 8 fake blockers on every run.

## Why this matters

- **Audit signal is polluted.** 8 of the 12 current blockers are walker bugs, not site bugs. CI / PR comment shows blocker=12 when the real count is 4. Operators learn to distrust the gate.
- **PR-gate noise.** `make audit-fe` exits 1 when blockers > 0 (ADR-005). Fake blockers from `locale: null` routes force the gate red on every run until either the walker or the site-model is fixed.
- **Architectural drift.** The route metadata already encodes the right answer (`locale: null` vs `locale: "en"`). The walker just isn't reading it. Cheap fix.

## Suggested fix

Make the locale loop conditional on `route.locale`. Two clean options:

### Option A — skip pt-br walk for `locale: null` routes

Inside the loop, short-circuit when the route is global and the loop is on the non-default locale:

```ts
for (const route of routes) {
    const locales = route.locale === null ? [DEFAULT_LOCALE] : LOCALES;
    for (const locale of locales) {
        const resolvedPath = resolveRoutePath(route);
        const localePath = buildLocalePath(resolvedPath, locale);
        // ...rest unchanged...
    }
}
```

(Import `DEFAULT_LOCALE` from `#/lib/locale`; the existing import already exposes `LOCALES`.)

### Option B — partition the inventory before the loop

```ts
const localeScoped = routes.filter((r) => r.locale !== null);
const global = routes.filter((r) => r.locale === null);

for (const route of localeScoped) {
    for (const locale of LOCALES) { /* ... */ }
}
for (const route of global) {
    // walk once at canonical path
    const path = resolveRoutePath(route);
    // ...
}
```

Option A is the smaller diff; Option B is more readable for future contributors.

Either way, `buildLocalePath` itself does not need to change — the bug is in the caller's iteration policy.

## Acceptance criteria

1. `make audit-fe` against current `main` reports **zero** console-error or network-fail rows containing `/pt-br/admin`, `/pt-br/login`, or `/pt-br/admin/preview/*`.
2. Adding a route with `locale: null` to `site-model.server.ts` does not generate additional locale-prefixed walks.
3. Adding a route with `locale: "en"` still walks both en and pt-br.
4. Unit test in `app/tests/app-audit-checks.test.ts` asserts: an inventory containing one `locale: null` route + one `locale: "en"` route triggers exactly 3 sweep invocations (1 global + 2 locale-scoped).
5. The audit's blocker count drops by ~8 (or whatever the equivalent count is in the operator's tree) after the fix lands — proven by `git stash` + audit vs `git stash pop` + audit diff.

## Triage

- Decision: `valid`
- Notes: Root cause confirmed at `checks.server.ts:110`. The inner `for (const locale of LOCALES)` loop is unconditional — it iterates all locales regardless of `route.locale`. Routes with `locale: null` (admin, login, admin/preview) are walked at `/pt-br/admin`, `/pt-br/login`, `/pt-br/admin/preview/:slug` which have no Nitro handlers, producing legitimate 404s counted as false blockers. Fix: derive `localesToWalk = route.locale === null ? [DEFAULT_LOCALE] : LOCALES` before the inner loop. `DEFAULT_LOCALE` is already exported from `#/lib/locale`; just needs to be imported alongside `LOCALES`. All existing test counts hold because FIXTURE_ROUTES both use `locale: "en"` (still walk 2 locales each). New test added for the `locale: null` + `locale: "en"` mixed inventory case.
