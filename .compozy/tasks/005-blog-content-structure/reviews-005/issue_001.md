---
provider: manual
pr:
round: 5
round_created_at: 2026-05-08T20:14:47Z
status: resolved
file: app/routes/$lang/$slug.tsx
line: 37
severity: low
author: claude-code
provider_ref:
---

# Issue 001: hreflang emits "pt-br" instead of BCP 47 canonical "pt-BR"

## Review Comment

Lines 37 and 42 emit `hrefLang` values directly from the DB columns `post.lang` and `alternateLang`, which store `"pt-br"` (lowercase). BCP 47 (RFC 5646) canonically represents this tag as `"pt-BR"` with uppercase region subtag.

This creates an internal inconsistency: the round 4 fix to `__root.tsx` correctly emits `<html lang="pt-BR">` using a mapping function, but the `hreflang` link elements on the same page emit `"pt-br"`. Google's crawlers accept both forms, but W3C validators and SEO audit tools flag lowercase region subtags as non-canonical, and the inconsistency is confusing.

The fix mirrors what `__root.tsx` already does — define a mapping from DB locale to BCP 47 tag and apply it at emit time:

```typescript
const toBcp47: Record<string, string> = { en: "en", "pt-br": "pt-BR" };

links: loaderData?.alternateLang
  ? [
      {
        rel: "alternate",
        hrefLang: toBcp47[loaderData.post.lang] ?? loaderData.post.lang,
        href: `/${loaderData.post.lang}/${loaderData.post.slug}`,
      },
      {
        rel: "alternate",
        hrefLang: toBcp47[loaderData.alternateLang] ?? loaderData.alternateLang,
        href: `/${loaderData.alternateLang}/${loaderData.post.slug}`,
      },
    ]
  : [],
```

Alternatively, export a `toBcp47` helper from `#/lib/locale` alongside the existing `LOCALES` and `DEFAULT_LOCALE` exports to centralise the mapping.

## Triage

- Decision: `valid`
- Notes: Lines 37 and 42 pass raw DB locale strings (`post.lang`, `alternateLang`) directly into `hrefLang`. DB stores `"pt-br"` (lowercase); BCP 47 canonical form is `"pt-BR"`. `__root.tsx:108` already normalizes inline (`locale === "pt-br" ? "pt-BR" : "en"`), so this is a real inconsistency. Fix: export a `toBcp47(locale: Locale): string` helper from `#/lib/locale.tsx` to centralize the mapping (avoids duplicating the inline map that already exists in `__root.tsx`), then apply it to both `hrefLang` emit sites in `$slug.tsx`.
