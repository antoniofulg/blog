---
provider: manual
pr:
round: 10
round_created_at: 2026-05-20T18:06:08Z
status: resolved
file: app/routes/__root.tsx
line: 46
severity: medium
author: claude-code
provider_ref:
---

# Issue 002: Missing OG and canonical meta tags site-wide

## Review Comment

`make audit-fe` reports 12 `missing-meta` findings — three tags missing per route per auth-state across both locales:

```
## missing-meta
- **missing-meta** (`/`)         - Missing meta tag: og:title
- **missing-meta** (`/`)         - Missing meta tag: og:image
- **missing-meta** (`/`)         - Missing meta tag: canonical
- **missing-meta** (`/pt-br/`)   - Missing meta tag: og:title
- **missing-meta** (`/pt-br/`)   - Missing meta tag: og:image
- **missing-meta** (`/pt-br/`)   - Missing meta tag: canonical
```
(Each listed twice — anon + admin auth states; same root cause.)

Inspecting `app/routes/__root.tsx:46-78` confirms the root `head()` returns only `charset`, `viewport`, `title`, `description`, and font preconnects. No Open Graph properties, no Twitter Card properties, no `<link rel="canonical">`. The `.agents/rules/fe-audit.md` `missing-meta` rule expects `og:title`, `og:image`, `og:title`, `og:image`, `<link rel="canonical">`, `<meta name="viewport">` — three of those (og:title, og:image, canonical) are absent.

Looking at the existing markup:

```ts
head: () => ({
    meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { title: "Antonio Fulgencio Blog" },
        { name: "description", content: "Articles about web development, …" },
    ],
    links: [
        { rel: "stylesheet", href: appCss },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        …
    ],
}),
```

No per-route override either — even post pages inherit just the root tags, so the `/{-$locale}/$slug` route also lacks OG cards (audit walks only `/` for now, but this generalizes the moment more routes are added to `--routes`).

## Why this matters

- **SEO + social sharing.** Without `og:title` / `og:image`, Twitter and LinkedIn previews use the raw URL with no image card. Without `<link rel="canonical">`, search engines may split signal between `/`, `/en/`, and `/pt-br/` versions of equivalent content.
- **Locked into 12 majors on every audit run.** Adds 12 entries to the major column on every CI invocation. While majors don't fail the workflow, they bloat the PR comment table and dilute attention from genuine new findings.
- **One-shot fix has high ROI.** All three tags live in the same `head()` block; one edit knocks out 12 finding rows.

## Suggested fix

Extend the root `head()` to inject `og:title`, `og:image`, `og:type`, `og:url`, `og:locale`, and a canonical link. Pull locale + pathname from the route context so the canonical URL and `og:locale` are locale-aware. Suggested shape:

```ts
head: ({ params, location }) => {
    const locale = (params as { locale?: string }).locale ?? "en";
    const baseUrl = "https://blog.example.com"; // replace with env-driven origin
    const canonicalUrl = `${baseUrl}${location.pathname}`;

    return {
        meta: [
            { charSet: "utf-8" },
            { name: "viewport", content: "width=device-width, initial-scale=1" },
            { title: "Antonio Fulgencio Blog" },
            { name: "description", content: "Articles about web development, React, TypeScript, Bun and international career." },
            // Open Graph
            { property: "og:type", content: "website" },
            { property: "og:title", content: "Antonio Fulgencio Blog" },
            { property: "og:description", content: "Articles about web development, React, TypeScript, Bun and international career." },
            { property: "og:image", content: `${baseUrl}/og-default.png` },
            { property: "og:url", content: canonicalUrl },
            { property: "og:locale", content: locale === "pt-br" ? "pt_BR" : "en_US" },
            // Twitter
            { name: "twitter:card", content: "summary_large_image" },
        ],
        links: [
            { rel: "canonical", href: canonicalUrl },
            { rel: "stylesheet", href: appCss },
            { rel: "preconnect", href: "https://fonts.googleapis.com" },
            // …rest unchanged
        ],
    };
},
```

A static `/og-default.png` (1200×630) committed under `public/` keeps the first iteration scope-bounded; per-post OG images can land later via the post frontmatter pipeline.

## Acceptance criteria

1. `make audit-fe` report shows `## missing-meta\n(none)` for `/` and `/pt-br/`.
2. `curl -s http://localhost:4173/ | grep -E 'og:title|og:image|canonical'` returns three non-empty matches.
3. `curl -s http://localhost:4173/pt-br/ | grep 'og:locale'` returns `content="pt_BR"`.
4. Canonical URL ends without a trailing slash for `/` (or with — pick one and stay consistent with the fix from issue 001).
5. `/og-default.png` exists in `public/` and resolves with HTTP 200 from the preview server.

## Triage

- Decision: `valid`
- Notes: Confirmed. `__root.tsx` head() has no OG or canonical tags. The missing tags are `og:title`, `og:image`, and `canonical`. Fix strategy: (1) Add `og:type` and `og:image` (static defaults) to `__root.tsx` head() — in scope. (2) Add `og:title`, `og:locale`, `og:url`, and `canonical` link to `app/routes/{-$locale}/index.tsx` — minimal out-of-scope touch needed because these require `params.locale` available only in the child route, not the layout or root. (3) Copy `public/logo192.png` to `public/og-default.png` as a placeholder; proper 1200×630 image is a separate task. `{-$locale}/index.tsx` is touched minimally and the reason is documented here.
