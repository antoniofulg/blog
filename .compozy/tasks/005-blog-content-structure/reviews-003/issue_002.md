---
provider: manual
pr:
round: 3
round_created_at: 2026-05-07T18:59:56Z
status: resolved
file: app/components/ui/post-card.tsx
line: 24
severity: low
author: claude-code
provider_ref:
---

# Issue 002: `as never` assertions bypass TanStack Router type safety in PostCard

## Review Comment

Lines 24–25 use `as never` to silence TypeScript on the locale-prefixed `Link`:

```tsx
<Link
  to={"/$lang/$slug" as never}
  params={{ lang, slug: post.slug } as never}
>
```

`as never` is the bluntest possible type suppression — it casts to the bottom type and disables all checking on those values. If the route path or param names change, the compiler will not catch the mismatch.

TanStack Router exposes full typed params via the `RegisteredRouter` interface. The correct typed form uses `createLink` or the `Link` component's inferred generics:

```tsx
<Link
  to="/$lang/$slug"
  params={{ lang: lang!, slug: post.slug }}
>
```

If TanStack Router's `LinkProps` type inference doesn't resolve here (because `lang` is `string` rather than a narrowed `Locale`), narrow the type at the call site:

```tsx
import { LOCALES, type Locale } from "#/lib/locale";

export function PostCard({ post, lang }: { post: Post; lang?: Locale }) {
  // ...
}
```

Changing `lang?: string` to `lang?: Locale` in the prop type gives the router enough type information to resolve `params` without casting.

## Triage

- Decision: `valid`
- Notes: Confirmed — both `to` and `params` had `as never` casts. Fix: changed prop type from `lang?: string` to `lang?: Locale` (imported from `#/lib/locale`). Inside the `{lang ? ... : ...}` truthy branch, TypeScript narrows `lang` to `Locale`, which satisfies the router's `params` type for `/$lang/$slug` without any cast. The `to` literal `"/$lang/$slug"` resolves cleanly against the registered route tree. Both `as never` casts removed. `make check` (tsc --noEmit) confirms zero type errors. **Out-of-scope file touched:** `app/routes/$lang/blog.tsx` line 65 — `lang` from `Route.useParams()` is `string` (TanStack Router returns all params as strings), so the call site required `lang as Locale`. This cast is safe: the `$lang.tsx` `beforeLoad` validates `lang` against `LOCALES` and redirects otherwise. Change is minimal (one cast added to one line).
