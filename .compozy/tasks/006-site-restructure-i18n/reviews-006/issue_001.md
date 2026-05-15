---
provider: manual
pr:
round: 6
round_created_at: 2026-05-15T13:50:40Z
status: resolved
file: app/components/ui/translation-notice.tsx
line: 13
severity: medium
author: claude-code
provider_ref:
---

# Issue 001: TranslationNotice copy is hardcoded as "post" but is reused on About

## Review Comment

`app/components/ui/translation-notice.tsx:13-18` hardcodes the noun "post" / "post" in both locale strings:

```
const messages: Record<Locale, (availableName: string) => string> = {
  en: (availableName) =>
    `This post is not available in English — showing ${availableName} version`,
  "pt-br": (availableName) =>
    `Este post não está disponível em Português — mostrando versão em ${availableName}`,
};
```

The component was originally written for the post-detail route (`$lang/$slug.tsx` → `{-$locale}/$slug.tsx`), where the word "post" is correct. Task_13 added the About migration and **reused the same component** on the About fallback path at `app/routes/{-$locale}/about.tsx:42-46`:

```
{fallbackLocale && (
  <div className="mb-6">
    <TranslationNotice
      requestedLang={requestedLang}
      availableLang={fallbackLocale}
    />
  </div>
)}
```

When a visitor hits `/pt-br/about` before `content/pt-br/about.mdx` exists, the loader falls back to en and renders the About content with this banner. The visible message is:

> Este post não está disponível em Português — mostrando versão em English

But the visitor is on `/about`, not a post. The word "post" / "post" is wrong for the About context. The banner contradicts the page the user is reading.

This is the only fallback path on the About route, so any pt-br visitor who lands on About before pt-br is authored sees the incorrect copy. It is also the entire user-facing rationale for ADR-006's fallback design ("the fallback is acceptable because the banner sets expectations clearly") — and the banner does not actually set expectations clearly when it names the wrong content type.

**Suggested fix** (two reasonable options):

1. **Generalize the copy.** Replace "post" / "post" with a content-neutral term:

   ```
   en: (availableName) =>
     `This content is not yet available in English — showing the ${availableName} version`,
   "pt-br": (availableName) =>
     `Este conteúdo ainda não está disponível em Português — exibindo a versão em ${availableName}`,
   ```

   Simplest fix, no component API change.

2. **Add a `kind` prop** that selects the right noun:

   ```
   type Props = {
     requestedLang: Locale;
     availableLang: Locale;
     kind?: "post" | "page"; // default "post" for back-compat
   };
   ```

   Pass `kind="page"` from About, keep default at the post-detail call site. Explicit but more code.

Option 1 has the best signal-to-noise ratio for V1 — the message is just as clear and works for both surfaces. Option 2 is the right pattern if more content types (categories, series indexes, etc.) get added in V2.

ADR-001 deferred full UI string extraction to V2 but explicitly **scoped the TranslationNotice copy** into V1's surface area (the banner is the fallback UX for ADR-005/ADR-006). The string fix is in-scope for this PRD's quality bar, not a V2 concern. The unit test at `app/tests/lang-slug-route.test.ts:344-348` exercises the banner on post-detail fallback (where "post" is correct); a parallel test on About should be added that asserts the rendered banner copy does **not** contain the literal word `"post"` / `"post"` (or asserts the generalized phrasing once the fix lands).

## Triage

- Decision: `valid`
- Notes: Root cause confirmed — `messages` object in `translation-notice.tsx` hardcodes "post"/"post" in both locale strings. Component is now used on About route where "post" is wrong. Fix: Option 1 (generalize copy) — replaced "post" with content-neutral "content" in both strings, no API change. Also updated 2 existing unit test assertions that matched the old strings, and added new unit test asserting banner copy contains no word "post" in either locale direction.
