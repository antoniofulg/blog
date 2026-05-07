---
provider: manual
pr:
round: 1
round_created_at: 2026-05-07T18:02:49Z
status: resolved
file: app/components/layout/header.tsx
line: 21
severity: high
author: claude-code
provider_ref:
---

# Issue 002: Language switcher reads localStorage locale, not URL $lang param

## Review Comment

`useLangSwitcher` derives `locale` from `useLocale()`, which reads from localStorage (default: `'en'`). When a user visits a locale-prefixed URL directly (e.g., `/pt-br/react-suspense`) without a prior localStorage entry, `locale` is `'en'`, so `targetLocale` becomes `'pt-br'` and the button label shows `"PT"` — suggesting a switch to pt-br even though the user is already on a pt-br page. Clicking it falls into the else branch and navigates to `/pt-br/blog`, discarding the current post.

The switcher should derive the current locale from the URL pathname, not from localStorage state:

```typescript
function useLangSwitcher() {
  const { setLocale } = useLocale();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Detect current locale from URL, not localStorage
  const currentLocale: Locale =
    (LOCALES.find((l) => pathname.startsWith(`/${l}/`)) as Locale | undefined)
    ?? DEFAULT_LOCALE;
  const targetLocale = LOCALES.find((l) => l !== currentLocale) as Locale;
  const label = targetLocale === "pt-br" ? "PT" : "EN";
  // ...switchLang uses currentLocale as prefix to strip
}
```

This also keeps the stored locale preference in sync: `setLocale(targetLocale)` should still be called on switch so the next non-locale page redirect uses the correct value.

## Triage

- Decision: `valid`
- Notes: Confirmed — `useLangSwitcher` reads `locale` from `useLocale()` (localStorage-backed, default `'en'`). Visiting `/pt-br/some-slug` directly without prior localStorage sets `locale='en'`, so `targetLocale='pt-br'` and label="PT". `switchLang` prefix check uses `/${locale}/` = `/en/`, which doesn't match `/pt-br/...`, so falls to else branch and navigates to `/pt-br/blog` — user is already there. Fix: derive `currentLocale` from URL pathname via `LOCALES.find((l) => pathname.startsWith(\`/${l}/\`)) ?? DEFAULT_LOCALE`; call `setLocale` on switch to keep localStorage in sync. Tests updated accordingly (header.test.ts label test for pt-br uses pathname mock not localStorage).
