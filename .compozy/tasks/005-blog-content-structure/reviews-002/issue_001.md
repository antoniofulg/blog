---
provider: manual
pr:
round: 2
round_created_at: 2026-05-07T18:34:07Z
status: resolved
file: app/routes/$lang.tsx
line: 5
severity: high
author: claude-code
provider_ref:
---

# Issue 001: $lang layout intercepts slug redirects, loses deep link

## Review Comment

`/$lang` and `/$slug` are sibling dynamic routes. `LangRoute` is registered before `SlugRoute` in `rootRouteChildren` (routeTree.gen.ts line 224–225). TanStack Router matches the first fully-matching route: for `/react-suspense`, `/$lang` matches with `lang='react-suspense'`, the `beforeLoad` fires, detects an invalid locale, and redirects to `/en/blog`. The `/$slug` redirect route is never reached.

This breaks PRD exit criterion: "URLs redirect from `/<slug>` to `/en/<slug>`". The integration test in `public-routes.test.ts` (line 148) asserts `GET /react-suspense → Location: /en/react-suspense`, which will fail at runtime.

The fix: when the incoming `params.lang` is not a valid locale, treat it as a slug and redirect to the locale-prefixed slug URL rather than the blog listing:

```typescript
// app/routes/$lang.tsx
beforeLoad: ({ params }) => {
  if (!LOCALES.includes(params.lang as Locale)) {
    throw redirect({
      to: "/$lang/$slug",
      params: { lang: DEFAULT_LOCALE, slug: params.lang },
    });
  }
},
```

Import `DEFAULT_LOCALE` from `#/lib/locale`. For full parity with `$slug.tsx` (which uses `detectLocaleFromRequest` via a server function), `beforeLoad` could be replaced with a `loader` + server function — but the minimal fix above preserves deep links without adding that complexity.

## Triage

- Decision: `valid`
- Notes: Confirmed root cause. `/$lang` captures any single-segment path. When `params.lang` is not in `LOCALES` (e.g. `react-suspense`), the old code redirected to `{ to: "/$lang/blog", params: { lang: "en" } }` = `/en/blog`, discarding the slug entirely. The `/$slug` sibling route was never reached because `/$lang` matched first. Fix: redirect to `{ to: "/$lang/$slug", params: { lang: DEFAULT_LOCALE, slug: params.lang } }`. Added `DEFAULT_LOCALE` import from `#/lib/locale`. Updated `lang-route.test.ts` with `computeRedirectTarget` helper tests verifying the redirect destination for slug-like params.
