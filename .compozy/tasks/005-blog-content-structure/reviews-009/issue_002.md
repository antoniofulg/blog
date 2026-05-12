---
provider: manual
pr:
round: 9
round_created_at: 2026-05-12T00:16:59Z
status: resolved
file: app/routes/$lang/$slug.tsx
line: 49
severity: low
author: claude-code
provider_ref:
---

# Issue 002: notFoundComponent hardcodes English for all locales

## Review Comment

`$lang/$slug.tsx` lines 49–53 define a route-level `notFoundComponent`:

```typescript
notFoundComponent: () => (
  <main>
    <h1>Post not found</h1>
  </main>
),
```

When `getPostBySlugWithLangFn` throws `notFound()` (no post found in any locale), TanStack Router renders this component. It hardcodes `"Post not found"` in English regardless of the route's `$lang` param. A Portuguese reader who visits `/pt-br/nonexistent-slug` sees an English 404 message.

This is the same pattern fixed for `NotFoundPage` in `__root.tsx` (round-006 issue 002). The route-level `notFoundComponent` was not updated at that time.

The `$lang` param is accessible inside `notFoundComponent` via `Route.useParams()`:

```typescript
notFoundComponent: () => {
  const { lang } = Route.useParams();
  const copy = {
    en: "Post not found",
    "pt-br": "Post não encontrado",
  } satisfies Record<Locale, string>;
  const message = copy[lang as Locale] ?? copy.en;
  return (
    <main>
      <h1>{message}</h1>
    </main>
  );
},
```

Alternatively, if the component is extracted to a named function for readability, `Route.useParams()` still works.

## Triage

- Decision: `valid`
- Notes: `notFoundComponent` at line 49–53 hardcodes "Post not found" (English only). `Route.useParams()` is accessible inside `notFoundComponent` — fix uses inline `copy` object satisfying `Record<Locale, string>` to show locale-aware message. Same pattern used in `__root.tsx` `NotFoundPage`.
