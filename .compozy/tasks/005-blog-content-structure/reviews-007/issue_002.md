---
provider: manual
pr:
round: 7
round_created_at: 2026-05-11T23:48:11Z
status: resolved
file: app/components/ui/post-card.tsx
line: 18
severity: low
author: claude-code
provider_ref:
---

# Issue 002: PostCard date fallback defaults to "pt-br" locale when lang is undefined

## Review Comment

`post-card.tsx` line 18 computes the `toLocaleDateString` locale as:

```typescript
dateLocale[lang ?? "pt-br"]
```

When `lang` is `undefined`, the fallback key is `"pt-br"`, which maps to `"pt-BR"` date formatting. Every other locale fallback in the codebase defaults to English (`DEFAULT_LOCALE = "en"`):

- `$lang/blog.tsx:50` — `copy[lang as keyof typeof copy] ?? copy.en`
- `__root.tsx:83` — `LOCALES.includes(segment) ? segment : DEFAULT_LOCALE`
- `__root.tsx:122` — same pattern

Using `"pt-br"` as the date fallback is inconsistent with this convention. The only current call site always provides `lang` (`$lang/blog.tsx:72`), so this has no visible effect today. But the prop signature allows `lang?: Locale` (optional), meaning future callers that omit `lang` will silently get pt-BR date formatting rather than the expected English default.

Fix: change the fallback to `DEFAULT_LOCALE`:

```typescript
import { DEFAULT_LOCALE, type Locale } from "#/lib/locale";

// line 18:
dateLocale[lang ?? DEFAULT_LOCALE]
```

This is a one-character change that makes the fallback consistent with every other locale-sensitive component in the codebase.

## Triage

- Decision: `valid`
- Notes: Confirmed. Line 18 uses `lang ?? "pt-br"` as the dateLocale key. `DEFAULT_LOCALE` is `"en"` and is the universal fallback across `$lang/blog.tsx` and `__root.tsx`. The `lang?: Locale` prop allows undefined, so future callers without lang silently get pt-BR formatting. Fix: import `DEFAULT_LOCALE` from `#/lib/locale` and use it as the fallback key.
