---
provider: manual
pr:
round: 9
round_created_at: 2026-05-12T00:16:59Z
status: resolved
file: app/routes/$lang/$slug.server.ts
line: 94
severity: medium
author: claude-code
provider_ref:
---

# Issue 001: getPostBySlugWithLang inputValidator accepts any string as lang

## Review Comment

`getPostBySlugWithLang` in `$slug.server.ts` uses a type-annotated but runtime-transparent inputValidator:

```typescript
export const getPostBySlugWithLang = createServerFn({ method: "GET" })
  .inputValidator((data: { slug: string; lang: Locale }) => data)
  .handler(async ({ data: { slug, lang } }) => {
    const { renderMdx } = await import("#/lib/mdx/renderer.server");
    return getPostBySlugWithLangFn(slug, lang, renderMdx);
  });
```

The TypeScript annotation `lang: Locale` is erased at runtime. Any string passes through to `getPostBySlugWithLangFn`. This is the same root cause as round-007 issue 001 (`blog.server.ts`), which only covered the listing server fn. Round 007 also incorrectly cited `$slug.server.ts` as a positive model — the typed annotation there does not provide runtime protection.

The impact here is broader than the listing case. With an invalid `lang` like `"fr"`:

1. The exact-match query (`WHERE slug=? AND lang='fr'`) returns nothing.
2. The fallback query runs and may return an `en` or `pt-br` post.
3. The result carries `requestedLang: "fr" as Locale`.
4. `getPostBySlugWithLangFn` computes `otherLang: Locale = requestedLang === "en" ? "pt-br" : "en"` — returns `"en"` for any non-`"en"` value, including `"fr"`, so the alternate-lang query is wrong.
5. In `$lang/$slug.tsx`, `dateLocale[requestedLang]` where `requestedLang = "fr"` resolves to `undefined`; `toLocaleDateString(undefined, ...)` falls back to the runtime's default locale rather than throwing.

Fix: apply runtime locale validation in the inputValidator, consistent with the fix suggested in round-007 issue 001:

```typescript
export const getPostBySlugWithLang = createServerFn({ method: "GET" })
  .inputValidator((data: { slug: string; lang: string }): { slug: string; lang: Locale } => {
    if (!(LOCALES as readonly string[]).includes(data.lang)) {
      throw new Error(`Invalid locale: "${data.lang}". Expected one of: ${LOCALES.join(", ")}`);
    }
    return { slug: data.slug, lang: data.lang as Locale };
  })
  .handler(async ({ data: { slug, lang } }) => {
    const { renderMdx } = await import("#/lib/mdx/renderer.server");
    return getPostBySlugWithLangFn(slug, lang, renderMdx);
  });
```

Import `LOCALES` from `#/lib/locale`. Add a test in `lang-slug-route.test.ts` verifying the validator rejects an invalid locale string.

## Triage

- Decision: `valid`
- Notes: Runtime pass-through confirmed at line 94 — `(data: { slug: string; lang: Locale }) => data` returns data unmodified; TypeScript annotations erased at runtime. Invalid `lang` values silently corrupt `otherLang` computation and resolve `dateLocale[lang]` to `undefined`. Fix: export named `validateLocaleInput` function that checks `LOCALES.includes(data.lang)`, throw on invalid, narrow to `Locale` on valid. Export for direct testability since `createServerFn` mock swallows the validator chain.
