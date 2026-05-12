---
provider: manual
pr:
round: 6
round_created_at: 2026-05-08T20:30:04Z
status: resolved
file: app/components/layout/header.tsx
line: 7
severity: medium
author: claude-code
provider_ref:
---

# Issue 001: navLinks hardcode Portuguese labels for all locales

## Review Comment

`navLinks` in `header.tsx` lines 7–14 mixes Portuguese and English labels unconditionally:

```typescript
const navLinks = [
  { label: "Home", to: "/" },
  { label: "Blog", to: "/blog" },
  { label: "Tutoriais", to: "/tutorials" },
  { label: "Projetos", to: "/projects" },
  { label: "Sobre", to: "/about" },
  { label: "Newsletter", to: "/newsletter" },
] as const;
```

English readers on `/en/blog` see "Tutoriais", "Projetos", "Sobre" — Portuguese labels — in the desktop and mobile nav. The mobile menu compounds this with two additional Portuguese-only labels: `"Fechar menu"` (line 135, screen-reader text for the close button — an accessibility issue) and `"Alternar tema"` / `"Idioma"` (lines 162, 171, descriptive labels for the theme and language controls).

`useLangSwitcher` already derives `currentLocale` from the URL pathname (fixed in round 2). The same pattern can drive nav label selection.

Fix: replace the static `as const` array with a locale-keyed map and read `currentLocale` from `useLangSwitcher` (or a shared `useCurrentLocale` helper extracted from it):

```typescript
const NAV_LABELS: Record<Locale, typeof NAV_LINKS_EN> = {
  en: [
    { label: "Home", to: "/" },
    { label: "Blog", to: "/blog" },
    { label: "Tutorials", to: "/tutorials" },
    { label: "Projects", to: "/projects" },
    { label: "About", to: "/about" },
    { label: "Newsletter", to: "/newsletter" },
  ],
  "pt-br": [
    { label: "Home", to: "/" },
    { label: "Blog", to: "/blog" },
    { label: "Tutoriais", to: "/tutorials" },
    { label: "Projetos", to: "/projects" },
    { label: "Sobre", to: "/about" },
    { label: "Newsletter", to: "/newsletter" },
  ],
};
```

Apply the same locale-keyed approach to the mobile menu's `"Fechar menu"`, `"Alternar tema"`, and `"Idioma"` strings.

Note: The nav link `to` values point to routes that exist (e.g., `/tutorials`, `/projects`, `/about`) — this is a label-only issue, not a routing issue.

## Triage

- Decision: `valid`
- Notes: Confirmed — `navLinks` array is static with mixed PT/EN labels. `useLangSwitcher` computes `currentLocale` but doesn't expose it. Fix: add `NAV_LABELS` locale-keyed map, expose `currentLocale` from `useLangSwitcher`, use it in both `Header` (desktop nav) and `MobileMenu` (mobile nav + fix "Fechar menu" sr-only, "Alternar tema", "Idioma" strings). No new test needed — existing `header.test.ts` covers nav rendering and locale switching behavior.
