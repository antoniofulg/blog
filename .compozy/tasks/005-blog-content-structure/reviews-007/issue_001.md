---
provider: manual
pr:
round: 7
round_created_at: 2026-05-11T23:48:11Z
status: resolved
file: app/routes/$lang/blog.server.ts
line: 6
severity: medium
author: claude-code
provider_ref:
---

# Issue 001: getLocalePosts inputValidator accepts any string, bypassing Locale type guarantee

## Review Comment

`getLocalePosts` in `blog.server.ts` uses a pass-through inputValidator:

```typescript
export const getLocalePosts = createServerFn({ method: "GET" })
  .inputValidator((lang: string) => lang)
  .handler(({ data: lang }) => getPublishedPostsFn(lang as Locale));
```

The validator returns the raw `string` unchanged; the handler casts it `as Locale` without runtime verification. Server functions in TanStack Start are callable via direct HTTP POST to their internal endpoint independently of the route tree, meaning the `$lang.tsx` `beforeLoad` guard that validates locale at the route level does not protect this boundary.

A direct call with `lang: "fr"` would reach `getPublishedPostsFn("fr" as Locale)` and execute `eq(posts.lang, "fr")` against the DB, silently returning an empty array with no error. There is no indication to the caller that "fr" is invalid.

The `$lang/$slug.server.ts` sibling already sets the pattern for typed input validators:
```typescript
.inputValidator((data: { slug: string; lang: Locale }) => data)
```

Fix: validate the locale inside the inputValidator and throw on invalid values:

```typescript
import { LOCALES, type Locale } from "#/lib/locale";

export const getLocalePosts = createServerFn({ method: "GET" })
  .inputValidator((lang: string): Locale => {
    if (!(LOCALES as readonly string[]).includes(lang)) {
      throw new Error(`Invalid locale: "${lang}". Expected one of: ${LOCALES.join(", ")}`);
    }
    return lang as Locale;
  })
  .handler(({ data: lang }) => getPublishedPostsFn(lang));
```

The `as Locale` cast in `.handler` can then be dropped since the inputValidator already narrows the type. Add a test to `lang-blog-route.test.ts` verifying that the server fn validator rejects an invalid locale string.

## Triage

- Decision: `valid`
- Notes: Confirmed. `blog.server.ts` line 6 passes the input string through unchanged; line 7 casts `as Locale` with no runtime check. `getPostBySlugWithLang` in `$slug.server.ts` already uses a typed validator as the pattern. Fix: export a pure `validateLocaleFn(lang: string): Locale` from `blog.server.ts`, use it in `.inputValidator()`, drop the `as Locale` cast in the handler. Export makes the function directly unit-testable in `lang-blog-route.test.ts` without changing the `createServerFn` mock.
