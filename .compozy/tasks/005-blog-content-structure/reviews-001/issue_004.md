---
provider: manual
pr:
round: 1
round_created_at: 2026-05-07T18:02:49Z
status: resolved
file: app/routes/$lang/blog.tsx
line: 37
severity: medium
author: claude-code
provider_ref:
---

# Issue 004: Blog listing hardcodes Portuguese copy for all locales

## Review Comment

`$lang/blog.tsx` renders Portuguese text unconditionally on lines 37–43 regardless of the current `lang` param:

- Line 37: `"Artigos sobre desenvolvimento web, React, TypeScript, Bun e mais."` (subtitle)
- Line 42: `"Nenhum artigo encontrado"` (empty state title)
- Line 43: `"Não há artigos publicados ainda."` (empty state description)

English readers visiting `/en/blog` see Portuguese copy. This contradicts PRD F5 ("Each listing page fetches only posts matching its locale") and the implied locale-specific UX.

Add a simple locale-keyed copy map:

```typescript
const copy = {
  en: {
    subtitle: "Articles about web development, React, TypeScript, Bun and more.",
    emptyTitle: "No articles found",
    emptyDesc: "No published articles yet.",
  },
  "pt-br": {
    subtitle: "Artigos sobre desenvolvimento web, React, TypeScript, Bun e mais.",
    emptyTitle: "Nenhum artigo encontrado",
    emptyDesc: "Não há artigos publicados ainda.",
  },
} satisfies Record<string, { subtitle: string; emptyTitle: string; emptyDesc: string }>;
```

Use `copy[lang as keyof typeof copy] ?? copy.en` to render locale-appropriate strings.

## Triage

- Decision: `valid`
- Notes: Confirmed — lines 37-44 in `$lang/blog.tsx` hardcode Portuguese strings unconditionally. English users at `/en/blog` see Portuguese subtitle and empty state. Fix: add locale-keyed `copy` map with `en` and `pt-br` entries; use `copy[lang as keyof typeof copy] ?? copy.en` to select strings.
