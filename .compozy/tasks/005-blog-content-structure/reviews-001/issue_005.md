---
provider: manual
pr:
round: 1
round_created_at: 2026-05-07T18:02:49Z
status: resolved
file: app/routes/$lang/$slug.tsx
line: 145
severity: medium
author: claude-code
provider_ref:
---

# Issue 005: Post date formatted with hardcoded "pt-BR" locale

## Review Comment

Line 145 formats `post.publishedAt` using a hardcoded `"pt-BR"` locale string regardless of the route's `requestedLang`:

```tsx
new Date(post.publishedAt).toLocaleDateString("pt-BR", {
  day: "numeric",
  month: "long",
  year: "numeric",
})
```

English readers at `/en/react-suspense` see `"2 de maio de 2026"` instead of `"May 2, 2026"`. The `requestedLang` value is already available in the component via `Route.useLoaderData()`.

Map the route locale to a BCP 47 tag:

```typescript
const dateLocale: Record<Locale, string> = { en: "en-US", "pt-br": "pt-BR" };
// then:
new Date(post.publishedAt).toLocaleDateString(dateLocale[requestedLang], { ... })
```

## Triage

- Decision: `valid`
- Notes: Confirmed — line 145 hardcodes `"pt-BR"` in `toLocaleDateString`. `requestedLang` is available from `Route.useLoaderData()`. Fix: add `dateLocale: Record<Locale, string> = { en: "en-US", "pt-br": "pt-BR" }` map and use `dateLocale[requestedLang]` in the `toLocaleDateString` call. Implemented together with issue 003 extraction.
