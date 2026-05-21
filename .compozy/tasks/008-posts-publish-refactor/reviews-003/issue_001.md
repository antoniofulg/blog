---
provider: manual
pr:
round: 3
round_created_at: 2026-05-21T17:47:13Z
status: resolved
file: app/routes/admin/index.tsx
line: 34
severity: medium
author: claude-code
provider_ref:
---

# Issue 001: Admin View button ignores row's locale when filter is active

## Review Comment

`viewHref(post)` (line 34-36) resolves the public URL strictly by EN-first availability:

```ts
const enSlugs = new Set(
  posts.filter((p: Post) => p.lang === "en").map((p: Post) => p.slug),
);
const viewHref = (post: Post) =>
  enSlugs.has(post.slug) ? `/${post.slug}` : `/pt-br/${post.slug}`;
```

The behavior matches PRD Q-O5's "EN-first default" rule when no filter is active, but it collides with the locale-filter affordance the same page now exposes:

- Author clicks the **"PT-BR"** filter chip. The list re-renders showing only `post.lang === "pt-br"` rows.
- For any post that has an EN twin, the View button on the PT-BR row still points at `/${slug}` (the EN public URL).
- Clicking View opens the EN article in a new tab — despite the row representing the PT-BR version.

The filter is a discoverability tool for the author ("show me the PT-BR translations"), so the contextual expectation is that View on a PT-BR row opens the PT-BR URL. The EN-first default makes sense only when no filter is active or when the row's own locale has no source file.

Fix — use the row's `post.lang` to choose the URL when a filter is active, and fall back to EN-first only on the unfiltered/"Todos" view (or simpler: always honor the row's lang):

```ts
const ptBrSlugs = new Set(
  posts.filter((p: Post) => p.lang === "pt-br").map((p: Post) => p.slug),
);
const viewHref = (post: Post) => {
  // Row's own locale wins when filter is active OR when both variants exist.
  if (locale === "pt-br" || post.lang === "pt-br") {
    return ptBrSlugs.has(post.slug)
      ? `/pt-br/${post.slug}`
      : `/${post.slug}`;
  }
  return enSlugs.has(post.slug) ? `/${post.slug}` : `/pt-br/${post.slug}`;
};
```

Cleaner alternative — drop the EN-first default entirely and link to the row's own locale always (`post.lang === "en" ? `/${slug}` : `/pt-br/${slug}`). The PRD's EN-first rule predates the locale filter and the filter UI changes the user-intent calculus.

Update `app/tests/admin-routes.test.ts` accordingly: add an assertion that, under `?locale=pt-br`, the rendered View hrefs are all `/pt-br/...`.

## Triage

- Decision: `valid`
- Notes: Bug confirmed. `viewHref` uses EN-first logic regardless of `post.lang`. When PT-BR filter is active, a PT-BR row whose slug has an EN twin generates `/slug` (EN URL) instead of `/pt-br/slug`. The fix is simpler than the review suggests: drop `enSlugs` entirely and derive the URL directly from `post.lang`. This is always correct — the EN-first heuristic was only needed because the old code lacked the row's lang. The test helper `postUrl` and the "PT-BR post with EN twin links to EN URL" assertion must be updated to reflect the new behavior, and a new assertion for locale filter parity is added.
