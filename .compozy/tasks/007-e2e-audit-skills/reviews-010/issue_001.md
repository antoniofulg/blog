---
provider: manual
pr:
round: 10
round_created_at: 2026-05-20T18:06:08Z
status: resolved
file: app/routes/{-$locale}.tsx
line: 1
severity: high
author: claude-code
provider_ref:
---

# Issue 001: `/pt-br` returns HTTP 404 — pt-br locale root unroutable

## Review Comment

Running `make audit-fe` against a clean build produces two blocker findings on the pt-br locale root:

```
## console-error
- **console-error** (`/pt-br/`)
  - Console error: Failed to load resource: the server responded with a status of 404 (Not Found)

## network-fail
- **network-fail** (`/pt-br/`)
  - Failed request: http://localhost:4173/pt-br (HTTP 404)
```

Each finding is reported twice — once for the anon auth state and once for the admin auth state — but the root cause is identical for both: the URL `http://localhost:4173/pt-br` (no trailing slash) returns 404. The audit `buildLocalePath` helper produces `/pt-br/` (with trailing slash) when walking root, but Playwright follows whatever the server does after the initial navigation, and the resulting `Failed request` line reports `/pt-br` without slash — strongly suggesting a missing redirect or canonical-slash normalization in the TanStack Router setup.

The a11y-violation findings echo the same surface: their `filePath` is `http://localhost:4173/pt-br` (no slash), confirming the page actually rendered against that URL with a 404 response body.

Route structure today:

- `app/routes/{-$locale}.tsx` — optional-locale wrapper; `beforeLoad` throws `notFound()` when the locale is invalid (good).
- `app/routes/{-$locale}/index.tsx` — root index for the locale group.
- `app/lib/locale.tsx:19` — `localeHref(locale, slug?)` returns `/${locale}/` (with slash) for non-default locales, matching the audit's expectation.

Three plausible root causes, ordered by likelihood:

1. **Missing trailing-slash redirect.** TanStack Router's optional path-param syntax `{-$locale}` may not match `/pt-br` without a slash; a 308/301 from `/pt-br` → `/pt-br/` (or vice-versa) is absent. Browsers / probes that strip the trailing slash hit 404.
2. **Locale validation throws before render.** `beforeLoad` runs for the optional segment; if the param string lands as something other than the expected `Locale` union (e.g., empty string when the slash is missing), `notFound()` fires.
3. **Production Nitro server behaves differently from dev.** Only the production bundle exhibits this — the audit always runs against `.output/server/index.mjs`. `vite dev` (which redirects/canonicalizes more liberally) would mask the issue. Worth confirming via direct curl: `curl -I http://localhost:4173/pt-br` and `curl -I http://localhost:4173/pt-br/`.

## Why this matters

- **Two blockers on every audit run.** `make audit-fe` is now PR-gated (see ADR-005 + `.agents/rules/fe-audit.md`). Two blockers means exit code 1 and a red status check on every PR until fixed.
- **Real user impact.** Anyone who shares or types `https://blog.example.com/pt-br` (a perfectly natural URL form) lands on a 404. Search engines that index the trailing-slash form may also be redirected away by the missing canonical rule.
- **SEO knock-on.** Without a canonical link tag (issue 002) + a 404 on the slashless form, Google can split index signal between `/pt-br` and `/pt-br/` and downrank both. Locale roots are high-value pages — this hurts.

## Suggested fix paths

### Path A — TanStack Router canonical-slash plugin

Configure TanStack Router (or the upstream Nitro handler) to canonicalize trailing slashes — either always strip or always append, then redirect the other form with HTTP 308. Verify whichever direction the audit's `buildLocalePath` matches (`/pt-br/` form) and align on that.

Reference: TanStack Router exposes `trailingSlash` as part of the router config (check version pinned in `package.json`). Likely a one-line config change in `app/router.tsx` or wherever the router is instantiated.

Estimated effort: 15 min config + 15 min verification.

### Path B — explicit `/pt-br` route shim

Add a redirect-only route in the file tree (`app/routes/pt-br.tsx`) that 308s to `/pt-br/`. Bypasses any router-config complexity. Less elegant but bullet-proof.

Estimated effort: 20 min including test.

### Path C — investigate `beforeLoad` notFound branch

If hypothesis 2 holds, fix the params extraction so an empty / missing locale segment routes back to default locale instead of throwing.

Estimated effort: 30 min including a regression test in `tests/e2e/`.

## Recommendation

Path A first. TanStack Router has first-class trailing-slash config; rely on it rather than rolling shim routes. Path B as fallback if A doesn't compose cleanly with the optional-locale segment.

## Acceptance criteria

1. `curl -I http://localhost:4173/pt-br` returns 200 or 308 (not 404).
2. `curl -I http://localhost:4173/pt-br/` returns 200.
3. `make audit-fe` report shows `## console-error\n(none)` and `## network-fail\n(none)` for the pt-br locale.
4. `tests/e2e/public-read.spec.ts` (or a new spec) covers `/pt-br` (no slash) returning 200 after redirect.
5. Same audit run produces no new findings on the en locale as a side-effect.

## Triage

- Decision: `valid`
- Notes: Root cause confirmed as TanStack Router's default `trailingSlash: "never"`. With this default the router strips the trailing slash on all paths; `/pt-br/` becomes `/pt-br`. The route tree has the index at `/{-$locale}/` (path `/` under the parent), which requires the trailing slash for the child-match. Without it, the parent `/{-$locale}` matches but the child index does not → 404. Fix: add `trailingSlash: "always"` to the router config in `app/router.tsx`. This file is outside the listed batch scope but the fix is a single-line addition and no alternative within scope avoids the root cause. Documented here per cy-fix-reviews policy.
