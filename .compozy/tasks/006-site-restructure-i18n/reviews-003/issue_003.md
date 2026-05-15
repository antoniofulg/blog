---
provider: manual
pr:
round: 3
round_created_at: 2026-05-15T13:24:44Z
status: resolved
file: app/routes/{-$locale}/index.tsx
line: 46
severity: low
author: claude-code
provider_ref:
---

# Issue 003: redirect uses href instead of typed `to:` form

## Review Comment

`app/routes/{-$locale}/index.tsx:46`:

```
throw redirect({ href: `/${detected}/`, statusCode: 302 });
```

TanStack Router's `redirect()` accepts two distinct navigation modes (per `node_modules/@tanstack/router-core/dist/esm/redirect.d.ts:48-56`):

- `href: string` — absolute URL for external redirects; the docs note "When an absolute `href` is supplied and `reloadDocument` is not set, a full-document navigation is inferred."
- `to: <typed route>` plus `params` — internal, type-safe routing.

The string `\`/${detected}/\`` is an internal site-relative path, not an external URL. The other redirect call sites in the codebase consistently use the typed form:

- `app/routes/admin/index.tsx:11-15` — `redirect({ to: "/login", search: { redirect: location.href } })`
- `app/routes/admin/preview.$slug.tsx:9-...` — same pattern.

`href` for an internal path is misuse of the API: it bypasses TanStack Router's typed route table, prevents the compiler from catching typos (e.g., `/${detected}` without trailing slash, or referencing a route that no longer exists), and may trigger `reloadDocument` semantics that cause a full-document refresh on the client when a client-side fallback fires. For the SSR `beforeLoad` path the impact is negligible (the server emits a raw 302 either way), but the call site is the wrong pattern for the next dev to copy.

**Suggested fix**: use the typed form with the `{-$locale}` route and resolved param:

```
throw redirect({
  to: "/{-$locale}",
  params: { locale: detected },
  statusCode: 302,
  headers: { Vary: "Cookie, Accept-Language" }, // see issue 002
});
```

This keeps the route reference type-checked, aligns with the rest of the codebase's redirect style, and avoids the "absolute href ⇒ reloadDocument" inference path entirely. The `params.locale` value is the resolved `Locale`, which TanStack will format into the optional-param URL correctly (resolving to `/pt-br/` for `detected === "pt-br"`).

If for some reason the typed form does not work with the optional-param idiom — e.g., because TanStack's type inference for `{-$locale}` is incomplete — fall back to `href` but document the reason inline with a comment so the next reader does not assume style drift.

## Triage

- Decision: `valid` — typed form attempted; fell back to `href` with inline comment
  as prescribed by reviewer for the opt-param failure case.
- Notes: Tried `to: "/{-$locale}/"` + `params: { locale: detected }`. TypeScript
  rejected both (TS2820: `/{-$locale}/` excluded from redirect `to` union;
  TS2353: `locale` not in inferred params type for optional segment). Confirmed
  `/{-$locale}` (no trailing slash) is in the union but `locale` still fails in
  params. TanStack Router's type inference for optional-segment routes is incomplete
  for redirect, as the reviewer anticipated. Resolution: kept `href` form per
  reviewer fallback prescription, added inline comment documenting the reason, and
  added `headers: { Vary: "Cookie, Accept-Language" }` (issue 002 fix) to the
  same redirect call. SSR-only path so `reloadDocument` semantics are irrelevant.
