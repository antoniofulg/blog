---
provider: manual
pr:
round: 6
round_created_at: 2026-05-08T20:30:04Z
status: resolved
file: app/routes/__root.tsx
line: 87
severity: medium
author: claude-code
provider_ref:
---

# Issue 002: NotFoundPage hardcodes Portuguese for all locales

## Review Comment

`NotFoundPage` (lines 80–102 of `__root.tsx`) renders Portuguese text unconditionally:

```tsx
<h1 className="...">Página não encontrada</h1>
<p className="...">
  A página que você está procurando não existe ou foi movida para outro endereço.
</p>
<Link ...>
  <Home className="h-4 w-4" />
  Voltar ao Início
</Link>
```

English users who navigate to a nonexistent URL (e.g., `/en/nonexistent`) see a full-Portuguese 404 page. Round 4 fixed `<html lang>` and the root meta description, but `NotFoundPage` was not updated at the same time.

`NotFoundPage` is a React component rendered inside `RootLayout` (which wraps it in `LocaleProvider` and `ThemeProvider`). It can call `useLocation()` (already imported in the file at line 8) to derive the current locale:

```typescript
function NotFoundPage() {
  const { pathname } = useLocation();
  const segment = pathname.split("/")[1] as Locale;
  const lang = LOCALES.includes(segment) ? segment : DEFAULT_LOCALE;

  const copy = {
    en: {
      heading: "Page not found",
      body: "The page you're looking for doesn't exist or has been moved.",
      cta: "Back to Home",
    },
    "pt-br": {
      heading: "Página não encontrada",
      body: "A página que você está procurando não existe ou foi movida para outro endereço.",
      cta: "Voltar ao Início",
    },
  } satisfies Record<Locale, { heading: string; body: string; cta: string }>;

  const t = copy[lang];
  return (
    <div className="...">
      ...
      <h1 className="...">{t.heading}</h1>
      <p className="...">{t.body}</p>
      <Link to="/" className="...">
        <Home className="h-4 w-4" />
        {t.cta}
      </Link>
    </div>
  );
}
```

`LOCALES`, `DEFAULT_LOCALE`, and `type Locale` are already imported in `__root.tsx` (lines 17–21).

## Triage

- Decision: `valid`
- Notes: Confirmed — `NotFoundPage` renders Portuguese strings unconditionally. `useLocation` is already imported in the file. Fix: derive locale from pathname first segment (same pattern already used in `RootDocument`), add locale-keyed copy object, render locale-aware strings. No new test needed — existing route tests cover the 404 path.
