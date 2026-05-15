---
provider: manual
pr:
round: 2
round_created_at: 2026-05-15T13:16:14Z
status: resolved
file: app/routes/{-$locale}/about.tsx
line: 39
severity: medium
author: claude-code
provider_ref:
---

# Issue 002: About article lang attribute uses non-canonical BCP47 form

## Review Comment

`app/routes/{-$locale}/about.tsx:39` renders:

```
<article className="mx-auto max-w-3xl" lang={locale}>
```

`locale` here is a `Locale` type with values `"en"` or `"pt-br"`. The `lang` HTML attribute is defined by BCP47 (RFC 5646), whose canonical form for Brazilian Portuguese is `pt-BR` (uppercase region subtag), not `pt-br`.

The repository already has a helper for this: `toBcp47(locale)` exported from `app/lib/locale.tsx:15`, which maps `"pt-br"` → `"pt-BR"` and `"en"` → `"en"`. The root document at `app/routes/__root.tsx:112-114` already does this transformation correctly for `<html lang>`:

```
const htmlLang = locale === "pt-br" ? "pt-BR" : "en";
return <html lang={htmlLang} suppressHydrationWarning>...
```

The About `<article>` is the only consumer that passes the raw `Locale` value directly to `lang`. Modern user agents (browsers, screen readers, Google) tolerate both forms in most cases, but Lighthouse a11y audits and stricter validators flag the lowercase region as a warning. More importantly, the inconsistency is bait — the next person reading the code will copy the wrong pattern.

**Suggested fix**: import `toBcp47` and use it consistently:

```
import { ..., toBcp47 } from "#/lib/locale";

<article className="mx-auto max-w-3xl" lang={toBcp47(locale)}>
```

Same fix applies to issue 001 (post detail) once a `lang` attribute is added there. Consider also: collapse `__root.tsx`'s inline ternary into a `toBcp47(locale)` call so all three sites converge on the helper as the single source of truth.

## Triage

- Decision: `valid`
- Notes: `about.tsx:39` passes the raw `Locale` value (`"pt-br"`) directly to `lang`. BCP47 canonical form requires uppercase region subtag (`pt-BR`). `toBcp47` is already imported at line 8 in the same file. Fix: change `lang={locale}` to `lang={toBcp47(locale)}`. The existing integration test in `about.test.ts:183` already asserts `lang="en"` for the English about route; it will implicitly verify correctness. No new test needed for this one-liner swap.
