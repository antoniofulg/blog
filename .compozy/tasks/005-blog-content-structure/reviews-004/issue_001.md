---
provider: manual
pr:
round: 4
round_created_at: 2026-05-08T19:24:46Z
status: resolved
file: app/routes/__root.tsx
line: 100
severity: medium
author: claude-code
provider_ref:
---

# Issue 001: <html lang> hardcoded "pt-BR" for all locales

## Review Comment

`RootDocument` renders `<html lang="pt-BR">` unconditionally regardless of the route being served. English pages at `/en/react-suspense` and `/en/blog` receive a document declared as Brazilian Portuguese. Screen readers use the `lang` attribute to select a voice and pronunciation engine — an incorrect value means English content is read with a Portuguese voice/accent. Search engines also use it as a secondary language signal alongside `hreflang`.

The root meta description (`__root.tsx` lines 49–54) has the same problem: it is hardcoded in Portuguese and surfaces on any page without a child `head()` override — specifically the `/en/blog` listing, which has no `head()` of its own.

The practical fix within TanStack Start's shell architecture is to detect the locale from the URL during the root `beforeLoad` and inject it into context, then read it in `RootDocument` via a shared signal (or, simpler, pass it through the root route's `loader` and expose it via `Route.useLoaderData` or context):

```typescript
// In root beforeLoad, add locale detection:
const localeFromPath = (location.pathname.split('/')[1]) as Locale;
const lang = LOCALES.includes(localeFromPath) ? localeFromPath : DEFAULT_LOCALE;

// Pass lang in context (extend RouterContext with lang: Locale)
return { auth: { user }, lang };
```

Then in `RootLayout` (which has router access), read `Route.useRouteContext().lang` and pass it to `RootDocument` as a prop:

```tsx
function RootLayout() {
  const { lang } = Route.useRouteContext();
  return (
    <LocaleProvider>
      <ThemeProvider>
        <RootDocument lang={lang}>
          ...
        </RootDocument>
```

And update `<html lang={lang === "pt-br" ? "pt-BR" : "en"}>` and the root meta description conditionally.

Note: TanStack Start's `shellComponent` renders before the route tree, so `RootDocument` itself cannot access router context. The lang must be derived at the shell level from the raw request URL, or the architecture must shift `RootDocument` out of `shellComponent` into a regular route component wrapper.

## Triage

- Decision: `valid`
- Notes: Confirmed. `RootDocument` is the `shellComponent` and hardcodes `lang="pt-BR"` unconditionally. English pages (`/en/blog`, `/en/*`) receive an incorrect language declaration. Root `head()` also hardcodes a Portuguese meta description with no per-locale fallback — `/$lang/blog` has no `head()` override, so English blog listing inherits the wrong description.

  Root cause: `RootDocument` does not consult the current URL to select the BCP 47 lang tag; root `head()` uses a static Portuguese string.

  Fix approach:
  1. In `RootDocument`, call `useLocation()` from `@tanstack/react-router` to read `pathname`, extract first segment, map to BCP 47 tag (`pt-br` → `pt-BR`, anything else → `en`). Works on SSR and client without hydration mismatch because both sides derive lang from the same URL.
  2. Change root `head()` description to English (the DEFAULT_LOCALE fallback); Portuguese-specific pages will override via their own `head()`.
  3. Add `head()` to `/$lang/blog.tsx` using `params.lang` (confirmed available in `AssetFnContextOptions`) to emit a locale-correct `<meta name="description">` that overrides the root fallback.
