---
provider: manual
pr:
round: 16
round_created_at: 2026-05-21T00:12:48Z
status: resolved
file: app/routes/__root.tsx
line: 53
severity: low
author: claude-code
provider_ref:
---

# Issue 002: Canonical default-locale collapse hardcodes `/en/` literal — symmetric drift with the round-15 `buildLocalePath` cleanup

## Review Comment

Commit `b4a1156` (canonical de-duplication) added a default-locale-collapse step to `__root.tsx:49-56`:

```ts
head: ({ matches }) => {
    const siteUrl = import.meta.env.VITE_SITE_URL ?? "";
    const pathname = matches.at(-1)?.pathname ?? "/";
    // Default-locale collapse: `/en/<path>` canonicalizes to `<siteUrl>/<path>`.
    // Any new default-locale prefix in `DEFAULT_LOCALE` should be reflected
    // here. Non-default locales (e.g. /pt-br/...) keep their prefix.
    const canonicalPath = pathname.startsWith("/en/")
        ? pathname.slice(3) || "/"
        : pathname;
    const canonicalUrl = `${siteUrl}${canonicalPath}`;
    // ...
}
```

Three locale literals embedded in this snippet:

| Literal | Reason |
|---|---|
| `"/en/"` | Detect prefix to strip |
| `3` | Length of `"/en"` for `pathname.slice(3)` |
| (implicit) The collapse applies to `en` because `DEFAULT_LOCALE === "en"` |

`DEFAULT_LOCALE` is already exported from `#/lib/locale` and used elsewhere in the codebase. The hardcoded literals duplicate that knowledge in a way the comment acknowledges ("Any new default-locale prefix in `DEFAULT_LOCALE` should be reflected here").

This is the same kind of drift round-15 issue 002 just fixed in `buildLocalePath`:

```ts
// Old (round-15 issue 002, now fixed):
if (path.startsWith("/pt-br/") || path === "/pt-br") return path;
// New:
if (LOCALES.some((l) => path.startsWith(`/${l}/`) || path === `/${l}`)) return path;
```

That fix generalized over `LOCALES`. The canonical-collapse code didn't get the same treatment — it stayed coupled to `"/en/"` even though `DEFAULT_LOCALE` is the conceptual constant.

If `DEFAULT_LOCALE` ever changes (e.g., to `"pt-br"` if the site re-bases):
- `localeHref` (already in `app/lib/locale.tsx`) handles it via `if (locale === DEFAULT_LOCALE) return ...`.
- `buildLocalePath` (post round-15) handles it via `if (locale === "en") return path;` — note: STILL hardcoded "en". Separate concern, not addressed here.
- `__root.tsx`'s canonical-collapse would silently keep collapsing `/en/` while the new default is `pt-br`. Both broken — root would emit `/en/about/` canonical for the en route AND would collapse `/en/about/` to `/about/` even though `/about/` no longer renders en content.

## Why this matters

- **Comment-driven coupling.** The inline comment ("Any new default-locale prefix in `DEFAULT_LOCALE` should be reflected here") is a future-bug magnet. It documents a known pitfall instead of removing it.
- **Asymmetric with round-15 issue 002 outcome.** The same class of bug was just generalized in `buildLocalePath`; leaving it un-fixed here creates inconsistency in the codebase's locale-handling style.
- **Quiet failure mode.** No test catches this — the canonical-collapse logic has no unit coverage at all. The e2e tests assert `expectedCanonical` for `/`, `/en/`, `/pt-br/` but those expectations would also need updating when `DEFAULT_LOCALE` changes, so the regression wouldn't fail any current test.

## Suggested fix

Use `DEFAULT_LOCALE` to compute the prefix dynamically:

```ts
import { DEFAULT_LOCALE } from "#/lib/locale";
// ...
head: ({ matches }) => {
    const siteUrl = import.meta.env.VITE_SITE_URL ?? "";
    const pathname = matches.at(-1)?.pathname ?? "/";
    // Default-locale collapse: `/<DEFAULT_LOCALE>/<path>` canonicalizes to
    // `<siteUrl>/<path>` so the locale-free URL is the canonical form for
    // the default locale.
    const defaultPrefix = `/${DEFAULT_LOCALE}/`;
    const canonicalPath = pathname.startsWith(defaultPrefix)
        ? pathname.slice(defaultPrefix.length - 1) || "/"
        : pathname;
    const canonicalUrl = `${siteUrl}${canonicalPath}`;
    // ...
}
```

`defaultPrefix.length - 1` keeps the leading slash on the residual path (e.g., `/en/about/` → `/about/`, `/en/` → `/`). Slice length math is documented inline rather than via magic number `3`.

Add a unit test in `app/tests/__root-head.test.ts` (or extend `locale.test.ts`) covering:
- `/` → `/`
- `/en/` → `/` (default-locale collapse)
- `/en/about/` → `/about/`
- `/pt-br/` → `/pt-br/` (non-default kept)
- `/pt-br/about/` → `/pt-br/about/`

Test would fail today if `DEFAULT_LOCALE` changed (because the literal `/en/` would no longer match and the expected output would be wrong) — exactly the safety net that's currently missing.

## Acceptance criteria

1. `__root.tsx` canonical-collapse uses `DEFAULT_LOCALE` from `#/lib/locale` instead of the literal `/en/`.
2. The `slice(3)` magic number is replaced with `defaultPrefix.length - 1` or equivalent named expression.
3. A unit test exercises the canonical-collapse logic for all `LOCALES` × representative paths (root, child, non-locale-scoped).
4. Empirical curl-verification matrix from commit `b4a1156` (`/` → `/`, `/en/` → `/`, `/pt-br/` → `/pt-br/`) continues to pass after the refactor.

## Triage

- Decision: `valid`
- Notes: Confirmed. Line 55 hardcodes `"/en/"` and line 56 uses magic number `3` (`"/en".length`). `DEFAULT_LOCALE` is already imported at line 19. Fix: extract `collapseDefaultLocalePath(pathname)` helper to `app/lib/locale.tsx` (minimal change to an out-of-scope file — necessary for unit testability; alternative of replicating the formula in the test file would not test the actual `__root.tsx` code path). Use the helper in `__root.tsx` and test it in `locale.test.ts`. The `DEFAULT_LOCALE` import in `__root.tsx` is kept (still used on lines 109 and 135 for `NotFoundPage` and `RootDocument`).
