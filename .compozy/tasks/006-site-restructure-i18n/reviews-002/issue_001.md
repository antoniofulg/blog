---
provider: manual
pr:
round: 2
round_created_at: 2026-05-15T13:16:14Z
status: resolved
file: app/routes/{-$locale}/$slug.tsx
line: 81
severity: high
author: claude-code
provider_ref:
---

# Issue 001: Post detail article missing lang attribute on fallback

## Review Comment

The post detail route at `app/routes/{-$locale}/$slug.tsx:81` renders:

```
<article className="mx-auto max-w-3xl">
```

The `<article>` element does **not** carry a `lang` attribute. When a visitor lands on `/pt-br/<slug>` and the translation does not exist, the loader (`{-$locale}/$slug.server.ts:84-93`) falls back to the available locale's post and returns `notTranslated: true` plus `availableLang`. The route then renders the en MDX body inside an article whose ancestor `<html lang>` (set in `__root.tsx:114`) is `pt-BR` for the URL locale.

Result: screen readers and search engines see `<html lang="pt-BR">` wrapping an `<article>` with English text. Screen readers pronounce English using Portuguese phonetic rules; search engines may downgrade indexing for inconsistent language signals.

The sister route `app/routes/{-$locale}/about.tsx:39` correctly handles this by setting `lang={locale}` on its `<article>` (where `locale` is the actual content language returned by `loadAbout`, not the requested URL locale). Post detail is the outlier.

ADR-005 implementation notes specify "fallback-locale content sets `lang='en'` on the article wrapper" but the actual `$slug.tsx` route was not updated to honor that contract. The `TranslationNotice` banner renders correctly, but the a11y annotation is missing.

**Suggested fix**: set `lang` on the `<article>` element using the post's actual language, and convert to BCP47 canonical form via the existing helper:

```
<article className="mx-auto max-w-3xl" lang={toBcp47(post.lang as Locale)}>
```

Import `toBcp47` from `#/lib/locale` (already exported). Use `post.lang` (the actual content locale from the DB row) rather than `requestedLang` so the attribute reflects the language a screen reader will encounter in the body. Add an integration test that asserts the `lang` attribute on the article when `notTranslated: true`.

Related: see issue 002 (round 002) about the canonical BCP47 form in `about.tsx` — same `toBcp47` helper should be used there too.

## Triage

- Decision: `valid`
- Notes: Root cause confirmed. `$slug.tsx:81` renders `<article>` with no `lang` attribute. When `notTranslated: true`, the page HTML root carries the URL locale (e.g. `pt-BR`) while the article body is English. `toBcp47` is already imported at line 5; `post.lang` is the actual content locale from the DB row. Fix: add `lang={toBcp47(post.lang as Locale)}` to the `<article>` element. Also add a unit test asserting the rendered HTML contains `lang="en"` on the article when the loader returns a fallback English post.
