---
provider: manual
pr:
round: 6
round_created_at: 2026-05-08T20:30:04Z
status: resolved
file: app/lib/locale.tsx
line: 50
severity: medium
author: claude-code
provider_ref:
---

# Issue 003: detectLocaleFromRequest ignores stored locale preference

## Review Comment

`detectLocaleFromRequest` (lines 50–53) only reads `Accept-Language` and ignores any stored locale preference:

```typescript
export function detectLocaleFromRequest(request: Request): Locale {
  const acceptLang = request.headers.get("Accept-Language") ?? "";
  return /\bpt\b/i.test(acceptLang) ? "pt-br" : DEFAULT_LOCALE;
}
```

The TechSpec's specification comment for this function explicitly includes a stored-preference check first:

```typescript
// const stored = /* read from cookie or session if available */;
// if (stored && LOCALES.includes(stored)) return stored;
```

The omission breaks the expected UX for users with a pt-BR browser locale who explicitly switched to English: when they follow an old link to `/blog` or `/` (the legacy redirect routes), the server calls `detectLocaleFromRequest`, sees `Accept-Language: pt-BR`, and redirects them to `/pt-br/blog` — overriding their explicit English preference stored in localStorage.

Since `localStorage` is not accessible server-side, the fix requires syncing the locale preference to a cookie whenever `setLocale` is called:

```typescript
// In LocaleProvider.setLocale:
const setLocale = useCallback((l: Locale) => {
  setLocaleState(l);
  localStorage.setItem("locale", l);
  document.cookie = `locale=${l}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
}, []);

// In detectLocaleFromRequest:
export function detectLocaleFromRequest(request: Request): Locale {
  const cookieHeader = request.headers.get("Cookie") ?? "";
  const match = cookieHeader.match(/(?:^|;\s*)locale=([^;]+)/);
  const stored = match?.[1] as Locale | undefined;
  if (stored && LOCALES.includes(stored)) return stored;

  const acceptLang = request.headers.get("Accept-Language") ?? "";
  return /\bpt\b/i.test(acceptLang) ? "pt-br" : DEFAULT_LOCALE;
}
```

The locale cookie should be a simple session preference, not HttpOnly (it is set by client JS). No sensitive data is involved.

This also requires updating `locale.test.ts` to add a test case: `detectLocaleFromRequest` with `Cookie: locale=en` and `Accept-Language: pt-BR` should return `'en'`.

## Triage

- Decision: `valid`
- Notes: Confirmed — `detectLocaleFromRequest` reads only `Accept-Language`, ignoring stored preference. `setLocale` writes only to `localStorage`, inaccessible server-side. Fix: (1) add `document.cookie` write in `setLocale`, (2) read `Cookie` header in `detectLocaleFromRequest` and return stored value if valid locale. Update `locale.test.ts` to add cookie-priority test cases. The `makeRequest` helper needs a `cookie` parameter. Existing tests unaffected since they pass no Cookie header.
