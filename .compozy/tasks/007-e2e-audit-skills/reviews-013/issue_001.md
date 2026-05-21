---
provider: manual
pr:
round: 13
round_created_at: 2026-05-20T22:39:05Z
status: resolved
file: app/routes/pt-br.index.tsx
line: 16
severity: medium
author: claude-code
provider_ref:
---

# Issue 001: `head()` logic duplicated across three locale-index routes

## Review Comment

After commit `ac8ffb1` (round-12 issue 002 fix), the locale-index head metadata now lives in three routes:

- `app/routes/{-$locale}/index.tsx:33-59`
- `app/routes/pt-br.index.tsx:16-38`
- `app/routes/en.index.tsx:16-39`

The three `head()` blocks are 95% identical. Only differences:

| Field | `/` (default) | `/pt-br/` | `/en/` |
|---|---|---|---|
| canonicalUrl pathname | `/` | `/pt-br/` | `/` |
| og:locale | `en_US` / `pt_BR` (derived) | `pt_BR` | `en_US` |
| description language | switches on locale | pt-br copy | en copy |
| og:title | same constant | same constant | same constant |
| alternate hreflang block | same | same | same |

Every change to canonical/OG strategy (e.g., adding `og:image`, `twitter:card`, or per-environment site URLs) now requires three coordinated edits. Worse, the three blocks were written by hand and already drift: the optional-param route's `head()` switches description by locale via a ternary, while the shim routes hardcode the locale's description directly. If the en copy is updated in `{-$locale}/index.tsx`, `en.index.tsx` will silently lag.

Looking at the patterns:

```ts
// {-$locale}/index.tsx
head: ({ params }) => {
    const locale = params.locale ?? DEFAULT_LOCALE;
    const isPtBr = locale === "pt-br";
    const siteUrl = import.meta.env.VITE_SITE_URL ?? "";
    const pathname = isPtBr ? "/pt-br/" : "/";
    const canonicalUrl = `${siteUrl}${pathname}`;
    const description = isPtBr ? "..." : "...";
    return { meta: [...], links: [...] };
},

// pt-br.index.tsx
head: () => {
    const siteUrl = import.meta.env.VITE_SITE_URL ?? "";
    const canonicalUrl = `${siteUrl}/pt-br/`;
    const description = "Artigos sobre...";
    return { meta: [...], links: [...] };
},

// en.index.tsx
head: () => {
    const siteUrl = import.meta.env.VITE_SITE_URL ?? "";
    const canonicalUrl = `${siteUrl}/`;
    const description = "Articles about...";
    return { meta: [...], links: [...] };
},
```

The shim routes were carved out as a tactical fix for the optional-param routing bug. The duplication is a known cost of that approach (see reviews-012/issue_002.md) but should not stay unaddressed.

## Why this matters

- **3× maintenance surface** for every SEO/OG change. Likely future drift.
- **Already drifting**: descriptions are duplicated rather than imported from a single source. The pt-br description in `pt-br.index.tsx` is `"Artigos sobre desenvolvimento web, React, TypeScript, Bun e carreira internacional."` and the same string also appears in `{-$locale}/index.tsx:40`. A copy-edit on one will silently desync the other.
- **Brittle hreflang block**: every shim spreads `LOCALES.map(...)` to produce alternate links. If a third locale is added (e.g., `es`), three files must be updated even though the logic is identical.

## Suggested fix

Extract a shared head builder. Two clean options:

### Option A — `buildLocaleHead(locale: Locale)` helper (recommended)

Add to `app/lib/locale.tsx` (already the canonical home for locale logic):

```ts
type LocaleHeadStrings = { description: string };
const LOCALE_HEAD_STRINGS: Record<Locale, LocaleHeadStrings> = {
    en: { description: "Articles about web development, React, TypeScript, Bun and international career." },
    "pt-br": { description: "Artigos sobre desenvolvimento web, React, TypeScript, Bun e carreira internacional." },
};

const LOCALE_PATHNAME: Record<Locale, string> = {
    en: "/",      // canonical default-locale path
    "pt-br": "/pt-br/",
};

export function buildLocaleHead(locale: Locale) {
    const siteUrl = import.meta.env.VITE_SITE_URL ?? "";
    const canonicalUrl = `${siteUrl}${LOCALE_PATHNAME[locale]}`;
    const { description } = LOCALE_HEAD_STRINGS[locale];
    return {
        meta: [
            { name: "description", content: description },
            { property: "og:title", content: "Antonio Fulgencio Blog" },
            { property: "og:description", content: description },
            { property: "og:url", content: canonicalUrl },
            { property: "og:locale", content: toBcp47(locale).replace("-", "_") },
        ],
        links: [
            { rel: "canonical", href: canonicalUrl },
            ...LOCALES.map((l) => ({ rel: "alternate", hrefLang: toBcp47(l), href: localeHref(l) })),
        ],
    };
}
```

Then each route's `head` becomes one line:

```ts
// {-$locale}/index.tsx
head: ({ params }) => buildLocaleHead((params.locale ?? DEFAULT_LOCALE) as Locale),

// pt-br.index.tsx
head: () => buildLocaleHead("pt-br"),

// en.index.tsx
head: () => buildLocaleHead("en"),
```

### Option B — co-locate the helper with `LocaleBlogPage`

If `app/components/layout/locale-blog-page.tsx` already carries locale-aware copy, the head builder can live alongside it. Slight downside: mixes a presentational component module with non-render head metadata, which is less consistent with the existing `app/lib/locale.tsx` boundary.

Recommendation: Option A.

## Acceptance criteria

1. The three locale-index routes contain a one-line `head:` call after refactor.
2. `app/lib/locale.tsx` (or a sibling) exports `buildLocaleHead(locale)`; descriptions live in one map.
3. `make audit-fe` reports zero `missing-meta` rows for `/`, `/pt-br/`, `/en/`.
4. Adding a third locale (e.g., `es`) requires extending exactly two maps (`LOCALE_HEAD_STRINGS`, `LOCALE_PATHNAME`) plus the existing `LOCALES` array — no route file edits.
5. Unit test in `app/tests/` covers `buildLocaleHead("pt-br")` and `buildLocaleHead("en")` returning the expected canonical URLs and og:locale strings.

## Triage

- Decision: `valid`
- Notes: Three locale-index routes each contain a near-identical `head()` block (~22 lines each). Root cause is the shim routes were written by hand without extracting shared logic. Fix: add `buildLocaleHead(locale: Locale)` to `app/lib/locale.tsx` using two constant maps (`LOCALE_DESCRIPTIONS`, `LOCALE_PATHNAME`) plus a `LOCALE_OG_LOCALE` map for og:locale strings. Then replace each route's `head()` block with a one-liner. Fix touches `app/lib/locale.tsx`, `app/routes/pt-br.index.tsx`, `app/routes/en.index.tsx`, and `app/routes/{-$locale}/index.tsx` — the latter three are outside the stated batch scope but the refactor cannot be done by updating only one of the three routes. Unit test added to `app/tests/locale.test.ts`.
