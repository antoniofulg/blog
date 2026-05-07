---
provider: manual
pr:
round: 1
round_created_at: 2026-05-07T18:02:49Z
status: resolved
file: app/db/queries.ts
line: 5
severity: low
author: claude-code
provider_ref:
---

# Issue 006: getPublishedPostsFn param typed string instead of Locale

## Review Comment

`getPublishedPostsFn` is declared with `lang: string` instead of `lang: Locale`:

```typescript
export async function getPublishedPostsFn(lang: string): Promise<Post[]>
```

The TechSpec specifies `lang: Locale` and all callers (`$lang/blog.tsx` server fn, tests) pass known locale values. Using `string` loses compile-time narrowing — an invalid value like `"fr"` would silently produce an empty result set rather than a type error.

Change the signature to:

```typescript
import type { Locale } from "#/lib/locale";
export async function getPublishedPostsFn(lang: Locale): Promise<Post[]>
```

## Triage

- Decision: `valid`
- Notes: Confirmed — `getPublishedPostsFn(lang: string)` in `app/db/queries.ts` line 5. All callers pass known Locale values. `string` loses compile-time narrowing; invalid values like `"fr"` would silently return empty results. Fix: import `Locale` from `#/lib/locale`, change param to `lang: Locale`.
