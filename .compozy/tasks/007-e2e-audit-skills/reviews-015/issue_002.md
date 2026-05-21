---
provider: manual
pr:
round: 15
round_created_at: 2026-05-20T23:57:31Z
status: resolved
file: app/lib/app-audit/checks.server.ts
line: 33
severity: low
author: claude-code
provider_ref:
---

# Issue 002: `buildLocalePath` hardcodes `/pt-br/` literal — won't scale beyond two locales

## Review Comment

Commit `c57f8bf` (round-014 fix for the shim-route double-prefix bug) added a defensive early-return inside `buildLocalePath` to catch already-prefixed shim paths:

```ts
function buildLocalePath(path: string, locale: Locale): string {
    if (locale === "en") return path;
    // Skip double-prefixing for shim routes whose path already contains the locale prefix.
    // e.g. pt-br.index.tsx has path="/pt-br/" and locale="pt-br"; prefixing again → /pt-br/pt-br/.
    if (path.startsWith("/pt-br/") || path === "/pt-br") return path;
    return path === "/" ? "/pt-br/" : `/pt-br${path}`;
}
```

The check is correct for the two-locale catalog today (`en` + `pt-br`). But the helper is symmetric with the walker's `isShimRoute` detection in the same commit:

```ts
const isShimRoute =
    route.locale !== null &&
    LOCALES.some(
        (l) => route.path.startsWith(`/${l}/`) || route.path === `/${l}`,
    );
```

The walker iterates `LOCALES` and matches any locale prefix. `buildLocalePath` only catches `/pt-br/`. The walker is the primary safety net — for shim routes, `localesToWalk` is `[DEFAULT_LOCALE]`, so `buildLocalePath` is invoked with `locale === "en"` (the first-branch early-return), and the `/pt-br/` hardcoded check is dead today.

If a third locale `es` is added in the future:

1. `LOCALES = ["en", "pt-br", "es"]`
2. Shim route `app/routes/es.index.tsx` registered with `path: "/es/"`, `locale: "es"`
3. Walker's `isShimRoute` check correctly detects the new shim and walks once at DEFAULT_LOCALE
4. `buildLocalePath` invoked: `locale === "en"` → first-branch return → no issue
5. **But**: if the walker logic ever regresses or someone calls `buildLocalePath("/es/", "pt-br")` from elsewhere, the function silently returns `/pt-br/es/` — wrong, and there's no detection.

The hardcoded `/pt-br/` literal in `buildLocalePath` is also an asymmetric design: the function's "add prefix" logic generalizes across paths, but the "don't double-add" logic singles out one locale.

## Why this matters

- **Future-locale fragility.** The audit was scoped to en + pt-br. The PRD does not commit to a third locale, but the codebase's `Locale` type is open-ended via the literal union. Adding `es` later will work for the walker but leave `buildLocalePath` with a stale hardcode.
- **Asymmetric helper invites bugs.** A reader scanning `buildLocalePath` sees `if (path.startsWith("/pt-br/"))` and may not realize the walker has its own (correct) detection. Worst case: someone "improves" the helper by removing the check ("only pt-br? why not generalize?") and introduces a subtle regression.
- **Defensive code that's dead is hardest to maintain.** The check fires zero times in current execution paths. When it eventually does fire (regression), no test will catch it because no test exercises the regression scenario.

## Suggested fix

Generalize the early-return symmetric with the walker:

```ts
function buildLocalePath(path: string, locale: Locale): string {
    if (locale === "en") return path;
    // Defensive: never double-prefix a path that already starts with a known locale segment.
    // The walker's isShimRoute detection should make this branch unreachable in practice,
    // but the helper stays correct even if called directly with an already-prefixed path.
    if (LOCALES.some((l) => path.startsWith(`/${l}/`) || path === `/${l}`)) {
        return path;
    }
    return path === "/" ? "/pt-br/" : `/pt-br${path}`;
}
```

(Note: the `/pt-br${path}` final branch is itself hardcoded — a third locale would need a path-template per locale. Out of scope for this issue. Track separately if/when adding a third locale.)

Add a unit test asserting `buildLocalePath` is idempotent for already-prefixed paths across all members of `LOCALES`:

```ts
for (const l of LOCALES) {
    expect(buildLocalePath(`/${l}/`, l)).toBe(`/${l}/`);
    expect(buildLocalePath(`/${l}/`, "en")).toBe(`/${l}/`);
}
```

Will fail today (will pass after the generalization) — pins the contract.

## Acceptance criteria

1. `buildLocalePath` uses `LOCALES.some(...)` (or equivalent locale-agnostic detection) instead of the hardcoded `/pt-br/` literal.
2. Unit test in `app/tests/app-audit-checks.test.ts` (or sibling) covers idempotency for both `en` and `pt-br` locale prefixes — current implementation passes after the generalization.
3. The walker's `isShimRoute` detection is unchanged (already locale-agnostic).
4. Existing audit-fe behavior is unchanged: shim routes walk once, non-shim routes walk twice (en + pt-br).

## Triage

- Decision: `valid`
- Notes: `buildLocalePath` line 36 checks `path.startsWith("/pt-br/") || path === "/pt-br"` — hardcoded to a single locale while the walker's `isShimRoute` uses `LOCALES.some(...)`. The defensive branch is dead in current execution paths (walker handles shims first), but for any future third locale `es`, `buildLocalePath("/es/", "pt-br")` would silently return `/pt-br/es/`. Fix: replace the hardcoded check with `LOCALES.some(l => path.startsWith(\`/${l}/\`) || path === \`/${l}\`)` and export the function so it can be unit-tested.
